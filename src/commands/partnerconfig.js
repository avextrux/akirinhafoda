const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getGuildConfig, setGuildConfig } = require("../config/guildConfig");
const { createDataStore } = require("../store/dataStore");

const partnersStore = createDataStore("partners.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("partnerconfig")
    .setDescription("Configurações administrativas de parceria")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("set")
        .setDescription("Configurar canais e cargos")
        .addChannelOption(o => o.setName("logs").setDescription("Canal de logs"))
        .addRoleOption(o => o.setName("staff").setDescription("Cargo da staff"))
        .addBooleanOption(o => o.setName("ativo").setDescription("Abrir para o público?"))
    )
    .addSubcommand(sub =>
      sub.setName("ranks")
        .setDescription("Configurar cargos de ranking")
        .addRoleOption(o => o.setName("bronze").setDescription("350+").setRequired(true))
        .addRoleOption(o => o.setName("prata").setDescription("750+").setRequired(true))
        .addRoleOption(o => o.setName("ouro").setDescription("1000+").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("info")
        .setDescription("Ver detalhes de uma parceria")
        .addStringOption(o => o.setName("id").setDescription("ID da parceria").setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { guildId } = interaction;
    let guildConfig = await getGuildConfig(guildId) || {};
    let pConfig = guildConfig.partnership || { staffRoles: [] };

    if (sub === "set") {
      const logChan = interaction.options.getChannel("logs");
      const role = interaction.options.getRole("staff");
      const active = interaction.options.getBoolean("ativo");

      if (logChan) pConfig.logChannelId = logChan.id;
      if (active !== null) pConfig.enabledForAll = active;
      if (role) {
        pConfig.staffRoles = pConfig.staffRoles.includes(role.id) ? pConfig.staffRoles.filter(id => id !== role.id) : [...pConfig.staffRoles, role.id];
      }

      await setGuildConfig(guildId, { partnership: pConfig });
      return interaction.reply({ content: "✅ Configurações atualizadas!", ephemeral: true });
    }

    if (sub === "ranks") {
      pConfig.ranks = {
        bronze: interaction.options.getRole("bronze").id,
        prata: interaction.options.getRole("prata").id,
        ouro: interaction.options.getRole("ouro").id
      };
      await setGuildConfig(guildId, { partnership: pConfig });
      return interaction.reply({ content: "✅ Rankings configurados!", ephemeral: true });
    }

    if (sub === "info") {
      const partners = await partnersStore.load();
      const data = partners[interaction.options.getString("id").toUpperCase()];
      if (!data) return interaction.reply({ content: "❌ ID inválido.", ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`Parceria: ${data.id}`)
        .addFields(
          { name: "Servidor", value: data.serverName, inline: true },
          { name: "Membros", value: `${data.memberCount}`, inline: true },
          { name: "Status", value: data.status, inline: true }
        );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};
