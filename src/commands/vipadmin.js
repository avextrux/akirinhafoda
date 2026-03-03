const { 
    SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, EmbedBuilder, ChannelType 
} = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Administração total do sistema VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    // --- SUBCOMANDO: TIER ---
    .addSubcommand(s => s.setName("tier").setDescription("Configura um tipo de VIP (ex: black, gold)")
        .addStringOption(o => o.setName("id").setDescription("ID do VIP (ex: black)").setRequired(true))
        .addRoleOption(o => o.setName("cargo").setDescription("Cargo deste VIP").setRequired(true)))
    // --- SUBCOMANDO: SETUP (INFRAESTRUTURA) ---
    .addSubcommand(s => s.setName("setup").setDescription("Configura a infraestrutura do servidor")
        .addRoleOption(o => o.setName("cargo_base").setDescription("Cargo VIP principal (geral)"))
        .addRoleOption(o => o.setName("cargo_fantasma").setDescription("Cargo que vê canais bloqueados"))
        .addChannelOption(o => o.setName("categoria_vip").setDescription("Onde os canais VIP serão criados").addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption(o => o.setName("sep_vip").setDescription("Cargo separador de VIPs"))),

  async execute(interaction) {
    const { vipConfig } = interaction.client.services;
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
        const data = {
            vipRoleId: interaction.options.getRole("cargo_base")?.id,
            cargoFantasmaId: interaction.options.getRole("cargo_fantasma")?.id,
            vipCategoryId: interaction.options.getChannel("categoria_vip")?.id,
            personalSeparatorRoleId: interaction.options.getRole("sep_vip")?.id
        };

        // Salva as configurações globais do servidor no banco
        await interaction.client.services.vip.setGuildConfig(interaction.guildId, data);
        return interaction.reply({ embeds: [createSuccessEmbed("✅ Configuração de infraestrutura salva com sucesso!")], ephemeral: true });
    }

    if (sub === "tier") {
      const id = interaction.options.getString("id").toLowerCase();
      const role = interaction.options.getRole("cargo");
      
      await vipConfig.setGuildTier(interaction.guildId, id, { roleId: role.id, name: role.name });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`vipadmin_tier_category_${interaction.guildId}_${id}`)
        .setPlaceholder("O que deseja configurar neste VIP?")
        .addOptions(
          { label: "💰 Economia (Daily/Midas)", value: "economy", emoji: "💰" },
          { label: "👥 Social (Cotas/Família)", value: "social", emoji: "👥" },
          { label: "⚡ Técnico (Fantasma/Call)", value: "tech", emoji: "⚡" }
        );

      return interaction.reply({ 
        content: `### 🛠️ Configurando VIP: **${id.toUpperCase()}**\nSelecione uma categoria abaixo para definir os benefícios específicos.`, 
        components: [new ActionRowBuilder().addComponents(menu)], 
        ephemeral: true 
      });
    }
  },

  // --- HANDLER DO MENU DE SELEÇÃO ---
  async handleSelectMenu(interaction) {
    const [,,, guildId, tierId] = interaction.customId.split("_");
    const category = interaction.values[0];

    if (category === "economy") {
      const modal = new ModalBuilder().setCustomId(`vipadmin_mod_eco_${guildId}_${tierId}`).setTitle(`Economia: ${tierId}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("daily").setLabel("Bônus Daily Fixo").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 1000")),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("midas").setLabel("Mão de Midas? (sim/nao)").setStyle(TextInputStyle.Short).setMaxLength(3).setPlaceholder("Digite 'sim' para dobrar o bônus"))
      );
      return interaction.showModal(modal);
    }

    if (category === "social") {
        const modal = new ModalBuilder().setCustomId(`vipadmin_mod_soc_${guildId}_${tierId}`).setTitle(`Social: ${tierId}`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("familia").setLabel("Vagas na Família").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 5")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("vips_dar").setLabel("Qtd de VIPs para dar (Cotas)").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 2")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("tipo_cota").setLabel("Qual ID do VIP ele pode dar?").setStyle(TextInputStyle.Short).setPlaceholder("Ex: classic"))
        );
        return interaction.showModal(modal);
    }
  },

  // --- HANDLER DOS MODAIS (SALVAMENTO) ---
  async handleModal(interaction) {
    const { vipConfig } = interaction.client.services;
    const parts = interaction.customId.split("_");
    const guildId = parts[3];
    const tierId = parts[4];

    if (interaction.customId.startsWith("vipadmin_mod_eco_")) {
        const daily = interaction.fields.getTextInputValue("daily");
        const midas = interaction.fields.getTextInputValue("midas").toLowerCase() === "sim";

        await vipConfig.updateTierBenefits(guildId, tierId, "economy", {
            valor_daily_extra: parseInt(daily) || 0,
            mao_de_midas: midas
        });
        return interaction.reply({ content: `✅ Economia do VIP **${tierId}** salva!`, ephemeral: true });
    }

    if (interaction.customId.startsWith("vipadmin_mod_soc_")) {
        const familia = interaction.fields.getTextInputValue("familia");
        const cotas = interaction.fields.getTextInputValue("vips_dar");
        const tipo = interaction.fields.getTextInputValue("tipo_cota");

        await vipConfig.updateTierBenefits(guildId, tierId, "social", {
            limite_familia: parseInt(familia) || 0,
            vips_para_dar: parseInt(cotas) || 0,
            tipo_cota: tipo
        });
        return interaction.reply({ content: `✅ Benefícios sociais do VIP **${tierId}** salvos!`, ephemeral: true });
    }
  }
};
