const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Gerencie seus benefícios VIP")
    // Subcomando: Info
    .addSubcommand(sub => 
      sub.setName("info")
         .setDescription("Ver seus benefícios e validade do VIP"))
    // Subcomando: Call
    .addSubcommand(sub => 
      sub.setName("call")
         .setDescription("Mudar o nome da sua call VIP")
         .addStringOption(opt => 
            opt.setName("nome")
               .setDescription("Novo nome para a call")
               .setRequired(true)))
    // Subcomando: Dar (Cotas)
    .addSubcommand(sub => 
      sub.setName("dar")
         .setDescription("Dar um VIP da sua cota para alguém")
         .addUserOption(opt => 
            opt.setName("membro")
               .setDescription("Membro que receberá o benefício")
               .setRequired(true)))
    // Subcomando: Customizar
    .addSubcommand(sub => 
      sub.setName("customizar")
         .setDescription("Editar seu cargo personalizado")
         .addStringOption(opt => 
            opt.setName("nome")
               .setDescription("Novo nome do cargo"))
         .addStringOption(opt => 
            opt.setName("cor")
               .setDescription("Nova cor em HEX (Ex: #FF0000)"))),

  async execute(interaction) {
    const { vip: vipService, vipRole, vipChannel } = interaction.client.services;
    
    // Verificação de segurança para os serviços
    if (!vipService || !vipRole || !vipChannel) {
        return interaction.reply({ content: "❌ Erro: Serviços VIP não carregados corretamente no index.", ephemeral: true });
    }

    const tier = await vipService.getMemberTier(interaction.member);
    if (!tier) {
        return interaction.reply({ content: "❌ Você não possui um VIP ativo para usar este comando.", ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    // Lógica: INFO
    if (sub === "info") {
      const settings = await vipService.getSettings(interaction.guildId, interaction.user.id) || {};
      const vipsDados = settings.vipsDados || [];
      
      const embed = new EmbedBuilder()
        .setTitle(`💎 Seus Benefícios: ${tier.name}`)
        .setColor("Gold")
        .addFields(
          { name: "👨‍👩‍👧 Vagas Família", value: `${tier.vagas_familia || 0}`, inline: true },
          { name: "✨ Cotas Usadas", value: `${vipsDados.length}/${tier.primeiras_damas || 0}`, inline: true },
          { name: "💰 Bônus Daily", value: `+${tier.daily_bonus || 0}`, inline: true }
        )
        .setFooter({ text: "WDA-BOT VIP System" });

      return interaction.reply({ embeds: [embed] });
    }

    // Lógica: CALL
    if (sub === "call") {
      if (!tier.canCall) return interaction.reply({ content: "❌ Seu VIP não permite gerenciar calls.", ephemeral: true });
      
      await interaction.deferReply({ ephemeral: true });
      const novoNome = interaction.options.getString("nome");
      
      const res = await vipChannel.updateChannelName(interaction.user.id, novoNome, { guildId: interaction.guildId });
      return interaction.editReply(res.ok ? `✅ Canal renomeado para **${novoNome}**!` : `❌ ${res.reason}`);
    }

    // Lógica: DAR (Cotas)
    if (sub === "dar") {
      const target = interaction.options.getMember("membro");
      if (target.user.bot) return interaction.reply("❌ Você não pode dar VIP para bots.");
      
      const settings = await vipService.getSettings(interaction.guildId, interaction.user.id) || {};
      const dados = settings.vipsDados || [];

      if (dados.length >= (tier.primeiras_damas || 0)) {
        return interaction.reply("❌ Você já atingiu seu limite de cotas de VIP (Damas).");
      }

      if (!tier.cotaRoleId) {
        return interaction.reply("❌ A Staff ainda não configurou o cargo de cota para este Tier.");
      }

      await target.roles.add(tier.cotaRoleId).catch(() => {});
      dados.push(target.id);
      
      await vipService.setSettings(interaction.guildId, interaction.user.id, { vipsDados: dados });
      return interaction.reply(`✅ Você deu o cargo VIP para ${target}!`);
    }

    // Lógica: CUSTOMIZAR
    if (sub === "customizar") {
      if (!tier.hasCustomRole) return interaction.reply({ content: "❌ Seu VIP não permite ter um cargo personalizado.", ephemeral: true });
      
      await interaction.deferReply({ ephemeral: true });
      const nome = interaction.options.getString("nome");
      const cor = interaction.options.getString("cor");

      const res = await vipRole.updatePersonalRole(interaction.user.id, { 
        roleName: nome, 
        roleColor: cor 
      }, { guildId: interaction.guildId });

      return interaction.editReply(res.ok ? "✅ Cargo atualizado com sucesso!" : "❌ Ocorreu um erro ao atualizar seu cargo.");
    }
  }
};
