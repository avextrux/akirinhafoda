const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
    ChannelType 
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("👑 Painel Supremo de Administração VIP e Família")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    
    // INFRAESTRUTURA
    .addSubcommand(s => s.setName("setup").setDescription("Configura a estrutura técnica do VIP")
        .addChannelOption(o => o.setName("logs").setDescription("Canal de auditoria").setRequired(true))
        .addChannelOption(o => o.setName("categoria").setDescription("Categoria para canais VIP").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        .addRoleOption(o => o.setName("separador").setDescription("Cargo que fica ACIMA dos personalizados").setRequired(true))
        .addRoleOption(o => o.setName("fantasma").setDescription("Cargo Fantasma (Vigilante)").setRequired(false)))

    // GESTÃO DE TIERS
    .addSubcommand(s => s.setName("tier").setDescription("Define benefícios de um cargo")
        .addStringOption(o => o.setName("id").setDescription("ID (ex: supremo, diamante)").setRequired(true))
        .addRoleOption(o => o.setName("cargo").setDescription("Cargo correspondente").setRequired(true)))

    // CONTROLE DE MEMBROS
    .addSubcommand(s => s.setName("add").setDescription("Ativa o VIP para um usuário")
        .addUserOption(o => o.setName("membro").setDescription("Destinatário").setRequired(true))
        .addStringOption(o => o.setName("tier").setDescription("ID do Tier").setRequired(true))
        .addIntegerOption(o => o.setName("dias").setDescription("Tempo em dias").setRequired(true)))

    .addSubcommand(s => s.setName("remove").setDescription("Remove o VIP de um usuário imediatamente")
        .addUserOption(o => o.setName("membro").setDescription("Usuário a ser removido").setRequired(true)))

    // LISTAGEM E MONITORAMENTO
    .addSubcommand(s => s.setName("list").setDescription("Lista Tiers configurados e Membros VIP ativos"))

    // GESTÃO DE FAMÍLIA (ADMIN FORCE)
    .addSubcommandGroup(g => g.setName("family").setDescription("Comandos administrativos para clãs")
        .addSubcommand(s => s.setName("info").setDescription("Detalhes técnicos de uma família")
            .addUserOption(o => o.setName("dono").setDescription("Dono da família").setRequired(true)))
        .addSubcommand(s => s.setName("delete").setDescription("Apaga uma família e limpa cargos/canais")
            .addUserOption(o => o.setName("dono").setDescription("Dono da família").setRequired(true)))
        .addSubcommand(s => s.setName("limit").setDescription("Altera o limite de vagas na força")
            .addUserOption(o => o.setName("dono").setDescription("Dono da família").setRequired(true))
            .addIntegerOption(o => o.setName("vagas").setDescription("Novo limite").setRequired(true)))),

  async execute(interaction) {
    const { vip: vipService, vipConfig, family: familyService, vipChannel, vipRole } = interaction.client.services;
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();

    // --- GRUPO FAMÍLIA ---
    if (group === "family") {
      const targetOwner = interaction.options.getUser("dono");
      if (sub === "info") {
        const family = await familyService.getFamilyByOwner(targetOwner.id);
        if (!family) return interaction.reply("❌ Este usuário não lidera uma família.");
        const embed = new EmbedBuilder()
          .setTitle(`🏠 Família: ${family.name}`).setColor("Purple")
          .addFields(
            { name: "Líder", value: `<@${family.ownerId}>`, inline: true },
            { name: "Ocupação", value: `👥 ${family.members.length} / ${family.maxMembers} membros`, inline: true },
            { name: "ID Interno", value: `\`${family.id}\``, inline: false }
          );
        return interaction.reply({ embeds: [embed] });
      }
      if (sub === "delete") {
        await familyService.deleteFamily(interaction.guild, targetOwner.id);
        return interaction.reply(`🗑️ Família de <@${targetOwner.id}> deletada e canais limpos.`);
      }
      if (sub === "limit") {
        const vagas = interaction.options.getInteger("vagas");
        const family = await familyService.getFamilyByOwner(targetOwner.id);
        if (!family) return interaction.reply("❌ Família não localizada.");
        await familyService.updateMaxMembers(family.id, vagas);
        return interaction.reply(`✅ Limite de **${family.name}** atualizado para **${vagas}**.`);
      }
    }

    // --- SUBCOMANDOS DIRETOS ---
    if (sub === "setup") {
      await vipService.setGuildConfig(interaction.guildId, {
        logChannelId: interaction.options.getChannel("logs").id,
        vipCategoryId: interaction.options.getChannel("categoria").id,
        separatorId: interaction.options.getRole("separador").id,
        cargoFantasmaId: interaction.options.getRole("fantasma")?.id || null
      });
      return interaction.reply("⚙️ Configurações globais salvas com sucesso.");
    }

    if (sub === "add") {
      const target = interaction.options.getMember("membro");
      const tid = interaction.options.getString("tier").toLowerCase();
      const dias = interaction.options.getInteger("dias");
      const tier = await vipConfig.getTierConfig(interaction.guildId, tid);

      if (!tier) return interaction.reply(`❌ O Tier \`${tid}\` não existe.`);
      
      const expiresAt = Date.now() + (dias * 24 * 60 * 60 * 1000);
      await target.roles.add(tier.roleId).catch(() => {});
      
      await vipService.addVip(interaction.guildId, target.id, {
        tierId: tid,
        expiresAt: expiresAt,
        addedBy: interaction.user.id
      });

      if (tier.canCall || tier.chat_privado) {
        await vipChannel.ensureVipChannels(target.id, { guildId: interaction.guildId });
      }

      return interaction.reply(`✅ **${target.user.username}** agora é **${tid.toUpperCase()}** por ${dias} dias.`);
    }

    if (sub === "remove") {
        const target = interaction.options.getMember("membro");
        // Cleanup completo usando seus serviços existentes
        await vipChannel.deleteVipChannels(target.id, { guildId: interaction.guildId });
        await vipRole.deletePersonalRole(target.id, { guildId: interaction.guildId });
        
        const data = await vipService.getVipData(interaction.guildId, target.id);
        if (data?.tierId) {
            const tier = await vipConfig.getTierConfig(interaction.guildId, data.tierId);
            if (tier) await target.roles.remove(tier.roleId).catch(() => {});
        }

        await vipService.removeVip(interaction.guildId, target.id);
        return interaction.reply(`🚫 VIP de ${target} removido e ativos deletados.`);
    }

    if (sub === "list") {
        const tiers = await vipConfig.getGuildTiers(interaction.guildId);
        const report = await vipService.getFullVipReport(interaction.guildId); // Certifique-se que essa função existe ou liste do store

        const embed = new EmbedBuilder().setTitle("📊 Dashboard VIP").setColor("Blue");
        
        const tierText = Object.keys(tiers).map(t => `• **${t.toUpperCase()}**: <@&${tiers[t].roleId}>`).join("\n") || "Nenhum";
        embed.addFields({ name: "Cargos Configurados", value: tierText });

        const activeVips = report.activeVips || [];
        const vipText = activeVips.map(v => `<@${v.userId}> - \`${v.tierId}\` (Expira: <t:${Math.floor(v.expiresAt/1000)}:d>)`).join("\n") || "Nenhum membro ativo.";
        embed.addFields({ name: "Membros Ativos", value: vipText });

        return interaction.reply({ embeds: [embed] });
    }

    if (sub === "tier") {
      const tid = interaction.options.getString("id").toLowerCase();
      const role = interaction.options.getRole("cargo");
      await vipConfig.setBase(interaction.guildId, tid, role.id, role.name);

      const menu = new StringSelectMenuBuilder().setCustomId(`vipadmin_tier_${interaction.guildId}_${tid}`)
        .addOptions(
          { label: "Economia", value: "eco", description: "Daily e Midas", emoji: "💰" },
          { label: "Social", value: "soc", description: "Família e Cotas", emoji: "👨‍👩‍👧" },
          { label: "Técnico", value: "tec", description: "Calls e Cargos", emoji: "⚡" },
          { label: "Loja", value: "shop", description: "Venda no /shop e /vipbuy", emoji: "🛒" }
        );
      return interaction.reply({ content: `Configurando benefícios de <@&${role.id}>`, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }
  },

  async handleSelectMenu(interaction) {
    if (!interaction.customId?.startsWith("vipadmin_tier_")) return;

    const parts = interaction.customId.split("_");
    const guildId = parts[2];
    const tierId = parts.slice(3).join("_");
    const section = interaction.values?.[0];

    if (!guildId || !tierId || !section) {
      return interaction.reply({ content: "Seleção inválida.", ephemeral: true });
    }

    if (interaction.guildId !== guildId) {
      return interaction.reply({ content: "Este menu pertence a outro servidor.", ephemeral: true });
    }

    if (section !== "shop") {
      return interaction.reply({ content: "Esta seção ainda não foi implementada neste painel.", ephemeral: true });
    }

    const vipConfig = interaction.client.services?.vipConfig;
    const tier = await vipConfig?.getTierConfig(guildId, tierId);
    if (!tier) {
      return interaction.reply({ content: `Tier \`${tierId}\` não encontrado.`, ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId(`vipadmin_modal_shop_${guildId}_${tierId}`)
      .setTitle(`Loja VIP: ${tier.name || tier.id}`);

    const enabledInput = new TextInputBuilder()
      .setCustomId("shop_enabled")
      .setLabel("Habilitar compra no bot? (1=sim, 0=não, vazio=auto)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(tier.shop_enabled === true ? "1" : (tier.shop_enabled === false ? "0" : ""));

    const pricePerDayInput = new TextInputBuilder()
      .setCustomId("shop_price_per_day")
      .setLabel("Preço por dia (moedas). Vazio para não usar")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(Number.isFinite(tier.shop_price_per_day) ? String(tier.shop_price_per_day) : "");

    const fixedPriceInput = new TextInputBuilder()
      .setCustomId("shop_fixed_price")
      .setLabel("Preço fixo do plano (moedas). Vazio para não usar")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(Number.isFinite(tier.shop_fixed_price) ? String(tier.shop_fixed_price) : "");

    const defaultDaysInput = new TextInputBuilder()
      .setCustomId("shop_default_days")
      .setLabel("Dias padrão se preço fixo (ex: 30). Vazio=usar tier.days")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(Number.isFinite(tier.shop_default_days) ? String(tier.shop_default_days) : "");

    modal.addComponents(
      new ActionRowBuilder().addComponents(enabledInput),
      new ActionRowBuilder().addComponents(pricePerDayInput),
      new ActionRowBuilder().addComponents(fixedPriceInput),
      new ActionRowBuilder().addComponents(defaultDaysInput)
    );

    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    if (!interaction.customId?.startsWith("vipadmin_modal_shop_")) return;

    const parts = interaction.customId.split("_");
    const guildId = parts[3];
    const tierId = parts.slice(4).join("_");

    const vipConfig = interaction.client.services?.vipConfig;
    if (!vipConfig) {
      return interaction.reply({ content: "Serviço vipConfig indisponível.", ephemeral: true });
    }

    const enabledRaw = (interaction.fields.getTextInputValue("shop_enabled") || "").trim();
    const pricePerDayRaw = (interaction.fields.getTextInputValue("shop_price_per_day") || "").trim();
    const fixedPriceRaw = (interaction.fields.getTextInputValue("shop_fixed_price") || "").trim();
    const defaultDaysRaw = (interaction.fields.getTextInputValue("shop_default_days") || "").trim();

    const shop_enabled = enabledRaw === "" ? null : (enabledRaw === "1" || enabledRaw.toLowerCase() === "sim" || enabledRaw.toLowerCase() === "true");
    const shop_price_per_day = pricePerDayRaw === "" ? null : Number(pricePerDayRaw);
    const shop_fixed_price = fixedPriceRaw === "" ? null : Number(fixedPriceRaw);
    const shop_default_days = defaultDaysRaw === "" ? null : Number(defaultDaysRaw);

    if (shop_price_per_day !== null && (!Number.isFinite(shop_price_per_day) || shop_price_per_day < 0)) {
      return interaction.reply({ content: "Preço por dia inválido.", ephemeral: true });
    }
    if (shop_fixed_price !== null && (!Number.isFinite(shop_fixed_price) || shop_fixed_price < 0)) {
      return interaction.reply({ content: "Preço fixo inválido.", ephemeral: true });
    }
    if (shop_default_days !== null && (!Number.isFinite(shop_default_days) || shop_default_days < 0)) {
      return interaction.reply({ content: "Dias padrão inválidos.", ephemeral: true });
    }

    await vipConfig.updateTier(guildId, tierId, "shop", {
      shop_enabled,
      shop_price_per_day,
      shop_fixed_price,
      shop_default_days,
    });

    return interaction.reply({ content: `✅ Configuração de loja do tier \`${tierId}\` atualizada.`, ephemeral: true });
  }
};