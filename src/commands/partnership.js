const { 
  SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, 
  ButtonBuilder, ButtonStyle, EmbedBuilder 
} = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");
const { getGuildConfig, setGuildConfig } = require("../config/guildConfig");

const partnersStore = createDataStore("partners.json");
const staffStatsStore = createDataStore("staff_stats.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("partnership")
    .setDescription("Sistema completo de parcerias")

    .addSubcommand(sub =>
      sub.setName("solicitar")
        .setDescription("Solicite uma parceria (Mínimo 350 membros)")
        .addStringOption(o => o.setName("servidor").setDescription("Nome do seu servidor").setRequired(true))
        .addStringOption(o => o.setName("convite").setDescription("Link de convite").setRequired(true))
        .addStringOption(o => o.setName("descricao").setDescription("Descrição do servidor").setRequired(true))
        .addIntegerOption(o => o.setName("membros").setDescription("Número de membros").setRequired(true).setMinValue(350))
        .addStringOption(o => o.setName("banner").setDescription("Link da imagem/banner (opcional)"))
    )

    .addSubcommand(sub =>
      sub.setName("consultar")
        .setDescription("Consulta os detalhes de uma parceria pelo ID")
        .addStringOption(o => o.setName("id").setDescription("ID da parceria").setRequired(true))
    )

    .addSubcommand(sub =>
      sub.setName("listar")
        .setDescription("Lista todas as parcerias ativas")
    )

    .addSubcommand(sub =>
      sub.setName("config")
        .setDescription("Configurar canais e cargos de staff")
        .addChannelOption(o => o.setName("canal_logs").setDescription("Canal de solicitações da staff"))
        .addRoleOption(o => o.setName("cargo_staff").setDescription("Adicionar/Remover cargo da staff"))
        .addBooleanOption(o => o.setName("ativo").setDescription("Sistema aberto ao público?"))
    )

    .addSubcommand(sub =>
      sub.setName("setup")
        .setDescription("Configurar cargos de Ranking")
        .addRoleOption(o => o.setName("bronze").setDescription("Bronze (350+)").setRequired(true))
        .addRoleOption(o => o.setName("prata").setDescription("Prata (750+)").setRequired(true))
        .addRoleOption(o => o.setName("ouro").setDescription("Ouro (1000+)").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId, user, member, guild } = interaction;
    
    const partners = await partnersStore.load();
    const guildConfig = await getGuildConfig(guildId) || {};
    
    // Inicialização ultra segura para evitar erros de undefined
    const pConfig = guildConfig.partnership || {};
    if (!pConfig.staffRoles) pConfig.staffRoles = [];
    if (pConfig.enabledForAll === undefined) pConfig.enabledForAll = false;

    const isStaff = member.roles.cache.some(role => pConfig.staffRoles.includes(role.id)) || member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (sub === "solicitar") {
      if (!isStaff && !pConfig.enabledForAll) {
        return interaction.reply({ embeds: [createErrorEmbed("O sistema está desativado no momento.")], ephemeral: true });
      }
      
      if (!pConfig.logChannelId) {
        return interaction.reply({ embeds: [createErrorEmbed("O canal de moderação não foi configurado.")], ephemeral: true });
      }

      let desc = interaction.options.getString("descricao");
      desc = desc.replace(/(https?:\/\/[^\s]+)/gi, "`[LINK]`").replace(/@/g, "(at)").replace(/\n\s*\n\s*\n/g, '\n\n');

      const data = {
        id: `PARC${Math.floor(Math.random() * 90000) + 10000}`,
        requesterId: user.id,
        serverName: interaction.options.getString("servidor"),
        inviteLink: interaction.options.getString("convite"),
        description: desc,
        memberCount: interaction.options.getInteger("membros"),
        banner: interaction.options.getString("banner"),
        status: "pending",
        date: new Date().toISOString() // Salva formato ISO para o Checker ler sem erros
      };

      await partnersStore.update(data.id, () => data);

      const logChan = guild.channels.cache.get(pConfig.logChannelId);
      if (!logChan) return interaction.reply({ content: "Erro: Canal de logs não encontrado.", ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`partnership_approve_${data.id}`).setLabel("Aprovar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`partnership_reject_${data.id}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle("📩 Nova Solicitação")
        .setColor(0xFFFF00)
        .addFields(
            { name: "ID", value: `\`${data.id}\``, inline: true },
            { name: "Servidor", value: data.serverName, inline: true },
            { name: "Membros", value: `${data.memberCount}`, inline: true },
            { name: "Representante", value: `<@${user.id}>` }
        )
        .setDescription(`**Descrição:**\n${data.description}`);

      if (data.banner) embed.setImage(data.banner);

      const pings = pConfig.staffRoles.length > 0 ? pConfig.staffRoles.map(id => `<@&${id}>`).join(" ") : "Staff";
      await logChan.send({ content: pings, embeds: [embed], components: [row] });

      return interaction.reply({ embeds: [createSuccessEmbed(`✅ Solicitação enviada! ID: \`${data.id}\``)], ephemeral: true });
    }

    // A partir daqui apenas staff
    if (!isStaff) return interaction.reply({ embeds: [createErrorEmbed("Sem permissão.")], ephemeral: true });

    if (sub === "consultar") {
      const id = interaction.options.getString("id").toUpperCase();
      const data = partners[id];
      if (!data) return interaction.reply({ content: "❌ ID não encontrado.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Consulta: ${data.id}`)
        .setColor(data.status === "accepted" ? 0x00FF00 : 0xFFFF00)
        .addFields(
          { name: "Servidor", value: data.serverName, inline: true },
          { name: "Status", value: data.status.toUpperCase(), inline: true },
          { name: "Membros", value: `${data.memberCount}`, inline: true },
          { name: "Responsável", value: data.processedBy ? `<@${data.processedBy}>` : "Aguardando", inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "listar") {
      const active = Object.values(partners).filter(p => p.status === "accepted");
      if (active.length === 0) return interaction.reply({ content: "Sem parcerias ativas.", ephemeral: true });
      const embed = new EmbedBuilder().setTitle("🤝 Parcerias Ativas").setDescription(active.map(p => `\`${p.id}\` - ${p.serverName}`).join("\n"));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "config") {
      const logChan = interaction.options.getChannel("canal_logs");
      const role = interaction.options.getRole("cargo_staff");
      const active = interaction.options.getBoolean("ativo");

      if (logChan) pConfig.logChannelId = logChan.id;
      if (active !== null) pConfig.enabledForAll = active;
      
      if (role) {
        // Correção do erro de undefined (reading 'includes')
        if (!pConfig.staffRoles) pConfig.staffRoles = [];
        
        if (pConfig.staffRoles.includes(role.id)) {
          pConfig.staffRoles = pConfig.staffRoles.filter(id => id !== role.id);
        } else {
          pConfig.staffRoles.push(role.id);
        }
      }

      await setGuildConfig(guildId, { partnership: pConfig });
      return interaction.reply({ content: "✅ Configurações de parceria salvas com sucesso!", ephemeral: true });
    }

    if (sub === "setup") {
      const ranks = { 
        bronze: interaction.options.getRole("bronze").id, 
        prata: interaction.options.getRole("prata").id, 
        ouro: interaction.options.getRole("ouro").id 
      };
      pConfig.ranks = ranks;
      await setGuildConfig(guildId, { partnership: pConfig });
      return interaction.reply({ content: "✅ Rankings de membros configurados!", ephemeral: true });
    }
  },

  async handleButton(interaction) {
    const [command, action, id] = interaction.customId.split("_");
    if (command !== "partnership") return;

    const partners = await partnersStore.load();
    const data = partners[id];
    const guildConfig = await getGuildConfig(interaction.guildId);
    const pConfig = guildConfig.partnership || { ranks: {} };

    if (!data || data.status !== "pending") return interaction.reply({ content: "Já processado.", ephemeral: true });

    if (action === "reject") {
        await partnersStore.update(id, c => ({ ...c, status: "rejected", processedBy: interaction.user.id }));
        return interaction.update({ content: `❌ Recusada por: <@${interaction.user.id}>`, components: [], embeds: [interaction.message.embeds[0].setColor(0xFF0000)] });
    }

    if (action === "approve") {
      await interaction.reply({ content: "Mencione o canal de postagem abaixo:", ephemeral: true });
      const collector = interaction.channel.createMessageCollector({ filter: m => m.author.id === interaction.user.id, max: 1, time: 20000 });

      collector.on('collect', async m => {
        const targetChan = m.mentions.channels.first();
        if (!targetChan) return m.reply("Canal inválido.");

        let rName = "Bronze", rId = pConfig.ranks?.bronze;
        if (data.memberCount >= 1000) { rName = "Ouro"; rId = pConfig.ranks?.ouro; }
        else if (data.memberCount >= 750) { rName = "Prata"; rId = pConfig.ranks?.prata; }

        const memberReq = await interaction.guild.members.fetch(data.requesterId).catch(() => null);
        if (memberReq && rId) await memberReq.roles.add(rId).catch(() => null);
        
        await partnersStore.update(id, c => ({ ...c, status: "accepted", processedBy: interaction.user.id, acceptedAt: new Date().toISOString() }));
        await staffStatsStore.update(interaction.user.id, c => ({ ...c, approved: (c?.approved || 0) + 1, name: interaction.user.username }));

        const postEmbed = new EmbedBuilder().setColor(0x00FF00).setDescription(data.description);
        if (data.banner) postEmbed.setImage(data.banner);

        const postContent = 
          `--- ❴✠❵ NOVA PARCERIA ❴✠❵ ---\n` +
          `✅ **Servidor:** ${data.serverName}\n` +
          `👤 **Representante:** <@${data.requesterId}>\n` +
          `🏆 **Ranking:** ${rName}\n` +
          `🔗 **Link:** ${data.inviteLink}\n` +
          `👮 **Responsável:** <@${interaction.user.id}>\n` +
          `❴✠❵┅━━━━╍⊶⊰ 🤝 ⊱⊷╍━━━━┅❴✠❵`;

        await targetChan.send({ content: postContent, embeds: [postEmbed] });
        await interaction.message.edit({ content: `✅ Aprovada por: <@${interaction.user.id}> | ID: \`${data.id}\``, components: [] });
        m.delete().catch(() => null);
      });
    }
  }
};
