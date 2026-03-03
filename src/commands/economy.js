const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Comandos de economia")
    .addSubcommand(sub => sub.setName("balance").setDescription("Verifica seu saldo").addUserOption(opt => opt.setName("usuario").setDescription("Usuário (opcional)")))
    .addSubcommand(sub => sub.setName("work").setDescription("Trabalha para ganhar moedas"))
    .addSubcommand(sub => sub.setName("daily").setDescription("Resgata seu bônus diário"))
    .addSubcommand(sub => sub.setName("pay").setDescription("Transfere moedas").addUserOption(opt => opt.setName("usuario").setRequired(true)).addIntegerOption(opt => opt.setName("quantidade").setMinValue(1).setRequired(true)))
    .addSubcommand(sub => sub.setName("add").setDescription("Adiciona moedas (Admin)").addUserOption(opt => opt.setName("usuario").setRequired(true)).addIntegerOption(opt => opt.setName("quantidade").setRequired(true)))
    .addSubcommand(sub => sub.setName("remove").setDescription("Remove moedas (Admin)").addUserOption(opt => opt.setName("usuario").setRequired(true)).addIntegerOption(opt => opt.setName("quantidade").setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { economy: eco, vip: vipService } = interaction.client.services;
    const { guildId, user } = interaction;

    if (sub === "balance") {
      const target = interaction.options.getUser("usuario") || user;
      const bal = await eco.getBalance(guildId, target.id);
      return interaction.reply({ embeds: [createEmbed({ title: `💰 Saldo de ${target.username}`, fields: [{ name: "Carteira", value: `${bal.coins || 0} 🪙`, inline: true }, { name: "Banco", value: `${bal.bank || 0} 🏦`, inline: true }], color: 0xF1C40F })] });
    }

    if (sub === "work") {
      const data = await eco.getBalance(guildId, user.id);
      if (Date.now() - (data.lastWork || 0) < 3600000) return interaction.reply({ embeds: [createErrorEmbed("Descanse um pouco! Volte em 1 hora.")], ephemeral: true });
      const gain = Math.floor(Math.random() * 200) + 50;
      await eco.work(guildId, user.id, gain);
      return interaction.reply({ embeds: [createSuccessEmbed(`Você ganhou **${gain} 🪙**!`)] });
    }

    if (sub === "daily") {
      const data = await eco.getBalance(guildId, user.id);
      if (Date.now() - (data.lastDaily || 0) < 86400000) return interaction.reply({ embeds: [createErrorEmbed("Você já resgatou seu daily hoje!")], ephemeral: true });
      
      const base = 500;
      const tier = await vipService.getMemberTier(interaction.member);
      const extra = tier?.valor_daily_extra || 0;
      const mult = tier?.mao_de_midas ? 2 : 1;
      const total = base + (extra * mult);

      await eco.daily(guildId, user.id, total);
      let msg = `Você resgatou **${total} 🪙**!`;
      if (tier?.mao_de_midas) msg += "\n✨ **Mão de Midas:** Seu bônus VIP foi dobrado!";
      return interaction.reply({ embeds: [createSuccessEmbed(msg)] });
    }

    if (sub === "pay") {
      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getInteger("quantidade");
      if (target.id === user.id) return interaction.reply({ embeds: [createErrorEmbed("Auto-pagamento negado.")], ephemeral: true });
      const ok = await eco.transfer(guildId, user.id, target.id, amount);
      return interaction.reply(ok ? { embeds: [createSuccessEmbed(`Enviado **${amount} 🪙** para ${target}!`)] } : { embeds: [createErrorEmbed("Saldo insuficiente.")], ephemeral: true });
    }

    if (sub === "add" || sub === "remove") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ embeds: [createErrorEmbed("Sem permissão.")], ephemeral: true });
      const target = interaction.options.getUser("usuario");
      const amount = interaction.options.getInteger("quantidade");
      sub === "add" ? await eco.addCoins(guildId, target.id, amount) : await eco.removeCoins(guildId, target.id, amount);
      return interaction.reply({ embeds: [createSuccessEmbed(`Alterado **${amount} 🪙** de ${target}.`)] });
    }
  }
};
