const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder } = require("discord.js");
const { createEmbed, createErrorEmbed, createSuccessEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Painel e ferramentas VIP")
    .addSubcommand(s => s.setName("painel").setDescription("Abre o painel VIP"))
    .addSubcommand(s => s.setName("customizar").setDescription("Muda nome/cor do seu cargo")
        .addStringOption(o => o.setName("nome").setDescription("Novo nome"))
        .addStringOption(o => o.setName("cor").setDescription("Cor HEX (ex: #FF0000)")))
    .addSubcommand(s => s.setName("status").setDescription("Tempo restante")),

  async execute(interaction) {
    const { vip: vipService, vipRole } = interaction.client.services;
    const sub = interaction.options.getSubcommand();
    const entry = vipService.getVip(interaction.guildId, interaction.user.id);

    if (!entry) return interaction.reply({ embeds: [createErrorEmbed("Você não possui um VIP ativo.")], ephemeral: true });
    const tier = await vipService.getMemberTier(interaction.member);

    if (sub === "painel") {
      const embed = createEmbed({
        title: "💎 Seu Status VIP",
        description: `Plano: **${tier?.name || "VIP"}**\nFamília: \`${tier?.limite_familia || 0}\` vagas\nCotas: \`${tier?.vips_para_dar || 0}\` vips`,
        color: 0x9b59b6
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("vip_manage_role").setLabel("Meu Cargo").setStyle(ButtonStyle.Primary).setDisabled(!tier?.hasSecondRole),
        new ButtonBuilder().setCustomId("vip_manage_family").setLabel("Família").setStyle(ButtonStyle.Success).setDisabled(!(tier?.limite_familia > 0))
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (sub === "customizar") {
      if (!tier?.hasSecondRole) return interaction.reply({ embeds: [createErrorEmbed("Seu VIP não permite cargo personalizado.")], ephemeral: true });
      await interaction.deferReply({ ephemeral: true });
      const res = await vipRole.updatePersonalRole(interaction.user.id, { 
        roleName: interaction.options.getString("nome"), 
        roleColor: interaction.options.getString("cor") 
      }, { guildId: interaction.guildId });
      return interaction.editReply(res.ok ? { embeds: [createSuccessEmbed("🎨 Cargo atualizado!")] } : { embeds: [createErrorEmbed(`Erro: ${res.reason}`)] });
    }

    if (sub === "status") {
      const remaining = entry.expiresAt ? Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 86400000)) : "Permanente";
      return interaction.reply({ content: `⏳ Dias restantes: **${remaining}**`, ephemeral: true });
    }
  },

  async handleButton(interaction) {
    const { vip: vipService } = interaction.client.services;
    const tier = await vipService.getMemberTier(interaction.member);

    if (interaction.customId === "vip_manage_role") {
        const select = new UserSelectMenuBuilder().setCustomId("vip_sel_role").setPlaceholder("Convidar para seu cargo").setMaxValues(5);
        return interaction.reply({ content: "Selecione membros para compartilhar seu cargo:", components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }
    // Outros handlers de botão (família, etc) seguem a mesma lógica...
  }
};
