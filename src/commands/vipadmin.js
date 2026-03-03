const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Gestão Total VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("setup").setDescription("Configura canais/cargos")
        .addRoleOption(o => o.setName("fantasma").setDescription("Cargo que vê canais VIP"))
        .addRoleOption(o => o.setName("separador").setDescription("Onde ficam os cargos personalizados"))
        .addChannelOption(o => o.setName("categoria").setDescription("Categoria de criação de calls").addChannelTypes(ChannelType.GuildCategory)))
    .addSubcommand(s => s.setName("tier").setDescription("Configura um Tier").addStringOption(o => o.setName("id").setRequired(true).setDescription("Ex: black")).addRoleOption(o => o.setName("cargo").setRequired(true)))
    .addSubcommand(s => s.setName("add").setDescription("Dá VIP a um usuário")
        .addUserOption(o => o.setName("user").setRequired(true))
        .addStringOption(o => o.setName("id").setRequired(true))
        .addIntegerOption(o => o.setName("dias").setRequired(true))),

  async execute(interaction) {
    const { vip: vipService, vipConfig } = interaction.client.services;
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      await vipService.setGuildConfig(interaction.guildId, {
        cargoFantasmaId: interaction.options.getRole("fantasma")?.id,
        personalSeparatorRoleId: interaction.options.getRole("separador")?.id,
        vipCategoryId: interaction.options.getChannel("categoria")?.id
      });
      return interaction.reply("✅ Infraestrutura salva!");
    }

    if (sub === "add") {
      const target = interaction.options.getMember("user");
      const tid = interaction.options.getString("id").toLowerCase();
      const tConf = await vipConfig.getTierConfig(interaction.guildId, tid);
      if (!tConf) return interaction.reply("❌ Tier não existe.");
      
      await vipService.addVip(interaction.guildId, target.id, { days: interaction.options.getInteger("dias"), tierId: tid });
      if (tConf.roleId) await target.roles.add(tConf.roleId).catch(() => {});
      return interaction.reply({ embeds: [createSuccessEmbed(`✅ ${target.user.username} agora é ${tid}!`)] });
    }

    if (sub === "tier") {
      const id = interaction.options.getString("id").toLowerCase();
      const role = interaction.options.getRole("cargo");
      await vipConfig.setGuildTier(interaction.guildId, id, { roleId: role.id, name: role.name });
      const menu = new StringSelectMenuBuilder().setCustomId(`va_${interaction.guildId}_${id}`).addOptions({ label: "💰 Economia", value: "eco" }, { label: "⚡ Técnico", value: "tec" });
      return interaction.reply({ content: `Configurando **${id}**`, components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }
  },

  async handleSelectMenu(interaction) {
    const [,, gid, tid] = interaction.customId.split("_");
    const modal = new ModalBuilder().setCustomId(`vm_${interaction.values[0]}_${gid}_${tid}`).setTitle("Config Tier");
    if (interaction.values[0] === "eco") {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("p").setLabel("Preço Shop").setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("d").setLabel("Daily Extra").setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("m").setLabel("Midas? (sim/nao)").setStyle(TextInputStyle.Short))
        );
    } else {
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cp").setLabel("Cargo Perso? (sim/nao)").setStyle(TextInputStyle.Short)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ft").setLabel("Fantasma? (sim/nao)").setStyle(TextInputStyle.Short))
        );
    }
    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const [, type, gid, tid] = interaction.customId.split("_");
    const check = (id) => interaction.fields.getTextInputValue(id).toLowerCase() === "sim";
    if (type === "eco") {
        await interaction.client.services.vipConfig.updateTierBenefits(gid, tid, "economy", {
            preco_shop: parseInt(interaction.fields.getTextInputValue("p")) || 0,
            valor_daily_extra: parseInt(interaction.fields.getTextInputValue("d")) || 0,
            mao_de_midas: check("m")
        });
    } else {
        await interaction.client.services.vipConfig.updateTierBenefits(gid, tid, "tech", {
            hasSecondRole: check("cp"),
            fantasma: check("ft")
        });
    }
    return interaction.reply("✅ Salvo!");
  }
};
