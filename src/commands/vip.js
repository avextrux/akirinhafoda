const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Comandos VIP")
    .addSubcommand(s => s.setName("info").setDescription("Ver benefícios"))
    .addSubcommand(s => s.setName("call").setDescription("Mudar nome da call").addStringOption(o => o.setName("nome").setRequired(true)))
    .addSubcommand(s => s.setName("dar").setDescription("Dar cargo de cota (Dama)").addUserOption(o => o.setName("membro").setRequired(true)))
    .addSubcommand(s => s.setName("customizar").setDescription("Editar cargo").addStringOption(o => o.setName("nome")).addStringOption(o => o.setName("cor"))),

  async execute(interaction) {
    const { vip: vipService, vipRole, vipChannel } = interaction.client.services;
    const tier = await vipService.getMemberTier(interaction.member);
    if (!tier) return interaction.reply({ content: "❌ Você não é VIP.", ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === "call") {
      await interaction.deferReply({ ephemeral: true });
      const res = await vipChannel.updateChannelName(interaction.user.id, interaction.options.getString("nome"), { guildId: interaction.guildId });
      return interaction.editReply(res.ok ? "✅ Nome alterado!" : `❌ ${res.reason}`);
    }

    if (sub === "dar") {
      const target = interaction.options.getMember("membro");
      const settings = vipService.getSettings(interaction.guildId, interaction.user.id);
      const dados = settings.vipsDados || [];

      if (dados.length >= tier.primeiras_damas) return interaction.reply("❌ Cota esgotada.");
      if (!tier.cotaRoleId) return interaction.reply("❌ Cargo de cota não configurado.");

      await target.roles.add(tier.cotaRoleId);
      dados.push(target.id);
      await vipService.setSettings(interaction.guildId, interaction.user.id, { vipsDados: dados });
      return interaction.reply(`✅ VIP dado para ${target}!`);
    }

    if (sub === "customizar") {
      await interaction.deferReply({ ephemeral: true });
      const res = await vipRole.updatePersonalRole(interaction.user.id, { 
        roleName: interaction.options.getString("nome"), 
        roleColor: interaction.options.getString("cor") 
      }, { guildId: interaction.guildId });
      return interaction.editReply(res.ok ? "✅ Cargo editado!" : "❌ Sem permissão.");
    }
    
    if (sub === "info") {
      const embed = new EmbedBuilder().setTitle("💎 Seus Benefícios").setColor("Gold")
        .addFields(
          { name: "Cotas Gastas", value: `${(vipService.getSettings(interaction.guildId, interaction.user.id).vipsDados || []).length}/${tier.primeiras_damas}` }
        );
      return interaction.reply({ embeds: [embed] });
    }
  }
};