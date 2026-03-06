const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");
const { getGuildConfig } = require("../config/guildConfig");

const partnersStore = createDataStore("partners.json");
const staffStatsStore = createDataStore("staff_stats.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("partnership")
    .setDescription("sistema de parcerias para membros")
    .addSubcommand(sub =>
      sub.setName("solicitar")
        .setDescription("solicite uma parceria (minimo 350 membros)")
        .addStringOption(o => o.setName("servidor").setDescription("nome do seu servidor").setRequired(true))
        .addStringOption(o => o.setName("convite").setDescription("link de convite").setRequired(true))
        .addStringOption(o => o.setName("descricao").setDescription("descricao do servidor").setRequired(true))
        .addIntegerOption(o => o.setName("membros").setDescription("numero de membros").setRequired(true).setMinValue(350))
        .addStringOption(o => o.setName("banner").setDescription("link da imagem opcional"))
    )
    .addSubcommand(sub =>
      sub.setName("listar").setDescription("lista todas as parcerias ativas")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId, user, guild } = interaction;
    
    if (sub === "solicitar") {
      // 1. Atrasa a resposta IMEDIATAMENTE para matar o erro "O aplicativo não respondeu"
      await interaction.deferReply({ ephemeral: true });

      const guildConfig = await getGuildConfig(guildId) || {};
      const pConfig = guildConfig.partnership || { enabledForAll: false };

      if (!pConfig.enabledForAll) {
        return interaction.editReply({ embeds: [createErrorEmbed("O sistema de parcerias está desativado.")] });
      }

      // Lógica de Cooldown (24h)
      const allPartners = await partnersStore.load();
      const userRequests = Object.values(allPartners).filter(p => p.requesterId === user.id);
      if (userRequests.length > 0) {
        const lastReq = userRequests.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        const cooldown = 24 * 60 * 60 * 1000;
        if (Date.now() - new Date(lastReq.date).getTime() < cooldown) {
          return interaction.editReply({ embeds: [createErrorEmbed("Você já enviou uma solicitação recentemente. Tente novamente em 24h.")] });
        }
      }

      const data = {
        id: `PARC${Math.floor(Math.random() * 90000) + 10000}`,
        requesterId: user.id,
        serverName: interaction.options.getString("servidor"),
        inviteLink: interaction.options.getString("convite"),
        description: interaction.options.getString("descricao").replace(/@/g, ""),
        memberCount: interaction.options.getInteger("membros"),
        banner: interaction.options.getString("banner"),
        status: "pending",
        date: new Date().toISOString()
      };

      await partnersStore.update(data.id, () => data);
      const logChan = guild.channels.cache.get(pConfig.logChannelId);

      const embed = new EmbedBuilder()
        .setTitle("Nova Solicitação de Parceria")
        .setColor(0xFFFF00)
        .addFields(
          { name: "ID", value: data.id, inline: true },
          { name: "Representante", value: `<@${user.id}>`, inline: true },
          { name: "Servidor", value: data.serverName, inline: true },
          { name: "Link Enviado", value: data.inviteLink, inline: false }
        )
        .setDescription(`**Descrição:**\n${data.description}`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`partnership_approve_${data.id}`).setLabel("Aprovar").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`partnership_reject_${data.id}`).setLabel("Recusar").setStyle(ButtonStyle.Danger)
      );

      if (logChan) await logChan.send({ embeds: [embed], components: [row] });
      // 2. Trocamos o .reply() por .editReply() porque já usamos o deferReply() lá no topo
      return interaction.editReply({ embeds: [createSuccessEmbed("Solicitação enviada com sucesso!")] });
    }
  },

  async handleButton(interaction) {
    // 3. CORREÇÃO CRÍTICA DO BUG DO SPLIT: Pegando os dados de forma correta
    const parts = interaction.customId.split("_");
    const action = parts[1]; // "approve" ou "reject"
    const id = parts[2];     // "PARC12345"

    const partners = await partnersStore.load();
    const data = partners[id];

    if (!data || data.status !== "pending") return interaction.reply({ content: "Pedido não encontrado ou já processado.", ephemeral: true });

    if (action === "reject") {
      // Abre o modal na hora (não podemos usar deferUpdate antes de um modal)
      const modal = new ModalBuilder().setCustomId(`partnership_modal_reject_${id}`).setTitle("Recusar Parceria");
      const input = new TextInputBuilder().setCustomId("reason").setLabel("Motivo").setStyle(TextInputStyle.Paragraph).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return await interaction.showModal(modal);
    }

    if (action === "approve") {
      // Responde pedindo o canal (isso já mata o timeout de 3 segundos)
      await interaction.reply({ content: "Mencione o canal para postagem.", ephemeral: true });
      const filter = m => m.author.id === interaction.user.id && m.mentions.channels.size > 0;
      const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 30000 });

      collector.on('collect', async m => {
        const targetChan = m.mentions.channels.first();
        const guildConfig = await getGuildConfig(interaction.guildId);
        
        // Correção de Link e Descrição
        let finalLink = data.inviteLink.trim();
        if (!finalLink.startsWith('http')) finalLink = `https://${finalLink}`;
        const cleanDesc = data.description.replace(/(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[^\s]+/gi, "[Link Removido]");

        const postEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setDescription(`--- {☩} NOVA PARCERIA FECHADA! {☩} ---\n\n✅ **Server:** ${data.serverName}\n👤 **Representante:** <@${data.requesterId}>\n🛡️ **Responsável:** <@${interaction.user.id}>\n\n${cleanDesc}\n\n{☩}----------multimap 🤝 multimap----------{☩}`);

        if (data.banner?.startsWith("http")) postEmbed.setImage(data.banner);

        const ping = guildConfig.partnership?.pingRole ? `<@&${guildConfig.partnership.pingRole}>` : "@everyone";
        await targetChan.send({ content: `${ping}\n**Convite:** ${finalLink}`, embeds: [postEmbed] });
        
        await partnersStore.update(id, c => ({ ...c, status: "accepted", processedBy: interaction.user.id }));
        await staffStatsStore.update(interaction.user.id, c => ({ ...c, approved: (c?.approved || 0) + 1 }));

        await interaction.message.edit({ content: `✅ Aprovada por <@${interaction.user.id}>`, components: [], embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00FF00)] });
        m.delete().catch(() => null);
      });
    }
  },

  async handleModal(interaction) {
    const id = interaction.customId.split("_")[3];
    
    // 4. EVITANDO O 10062 AQUI TAMBÉM: Deferimos a atualização pois mandar DM para usuário pode demorar
    await interaction.deferUpdate();

    const reason = interaction.fields.getTextInputValue("reason");
    const partners = await partnersStore.load();
    const data = partners[id];

    await partnersStore.update(id, c => ({ ...c, status: "rejected", processedBy: interaction.user.id, reason }));
    
    const user = await interaction.client.users.fetch(data.requesterId).catch(() => null);
    if (user) await user.send(`Sua parceria com **${data.serverName}** foi recusada. Motivo: ${reason}`).catch(() => null);

    const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xFF0000).addFields({ name: "Motivo", value: reason });
    
    // Como usamos deferUpdate(), finalizamos editando a resposta
    return interaction.editReply({ content: `❌ Recusada por <@${interaction.user.id}>`, components: [], embeds: [embed] });
  }
};