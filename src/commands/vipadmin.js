const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ChannelType } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Administração VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName("setup").setDescription("Configura logs e categoria")
        .addChannelOption(o => o.setName("logs").setDescription("Canal de Logs").setRequired(true))
        .addChannelOption(o => o.setName("categoria").setDescription("Categoria VIP").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        .addRoleOption(o => o.setName("separador").setDescription("Cargo separador").setRequired(true))
        .addRoleOption(o => o.setName("fantasma").setDescription("Cargo Fantasma")))
    .addSubcommand(s => s.setName("tier").setDescription("Configura um Tier VIP")
        .addStringOption(o => o.setName("id").setDescription("ID do Tier (ex: supremo)").setRequired(true))
        .addRoleOption(o => o.setName("cargo").setDescription("Cargo no Discord").setRequired(true)))
    .addSubcommand(s => s.setName("list").setDescription("Lista configs")),

  async execute(interaction) {
    const { vip: vipService, vipConfig } = interaction.client.services;
    const sub = interaction.options.getSubcommand();

    if (sub === "setup") {
      await vipService.setGuildConfig(interaction.guildId, {
        logChannelId: interaction.options.getChannel("logs").id,
        vipCategoryId: interaction.options.getChannel("categoria").id,
        separatorId: interaction.options.getRole("separador").id,
        cargoFantasmaId: interaction.options.getRole("fantasma")?.id
      });
      return interaction.reply("✅ Infraestrutura VIP configurada.");
    }

    if (sub === "tier") {
      const tid = interaction.options.getString("id").toLowerCase();
      const role = interaction.options.getRole("cargo");

      // Agora o setBase existe no Manager!
      await vipConfig.setBase(interaction.guildId, tid, role.id, role.name);

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`va_${interaction.guildId}_${tid}`)
        .addOptions(
          { label: "Economia", value: "eco", emoji: "💰" },
          { label: "Social", value: "soc", emoji: "👨‍👩‍👧" },
          { label: "Técnico", value: "tec", emoji: "⚡" }
        );

      return interaction.reply({ 
        content: `Configurando benefícios para <@&${role.id}> (\`${tid}\`)`, 
        components: [new ActionRowBuilder().addComponents(menu)], 
        ephemeral: true 
      });
    }

    if (sub === "list") {
        const tiers = await vipConfig.getGuildTiers(interaction.guildId);
        const embed = new EmbedBuilder().setTitle("📋 Tiers Configurados").setColor("Blue");
        const list = Object.keys(tiers).map(t => `**${t.toUpperCase()}**: <@&${tiers[t].roleId}>`).join("\n") || "Nenhum";
        embed.setDescription(list);
        return interaction.reply({ embeds: [embed] });
    }
  },

  async handleSelectMenu(interaction) {
    const [,, guildId, tierId] = interaction.customId.split("_");
    const val = interaction.values[0];
    const modal = new ModalBuilder().setCustomId(`vm_${val}_${guildId}_${tierId}`).setTitle(`Configurar ${tierId}`);

    if (val === "eco") {
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("d").setLabel("Bônus Daily").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 1000")),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("m").setLabel("Mão de Midas? (sim/nao)").setStyle(TextInputStyle.Short))
      );
    } else if (val === "soc") {
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("v").setLabel("Vagas Família").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("da").setLabel("Cotas de VIP (Damas)").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cr").setLabel("ID do Cargo que o VIP dá").setStyle(TextInputStyle.Short))
      );
    } else {
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cc").setLabel("Cria Call? (sim/nao)").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("cp").setLabel("Chat Privado? (sim/nao)").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("crp").setLabel("Cargo Custom? (sim/nao)").setStyle(TextInputStyle.Short)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("hq").setLabel("Voz 96kbps? (sim/nao)").setStyle(TextInputStyle.Short))
      );
    }
    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const { vipConfig } = interaction.client.services;
    const [, type, guildId, tierId] = interaction.customId.split("_");
    const isSim = (id) => interaction.fields.getTextInputValue(id).toLowerCase() === "sim";

    let updateData = {};
    if (type === "eco") {
      updateData = { 
        daily_bonus: parseInt(interaction.fields.getTextInputValue("d")) || 0, 
        midas: isSim("m") 
      };
    } else if (type === "soc") {
      updateData = { 
        vagas_familia: parseInt(interaction.fields.getTextInputValue("v")) || 0, 
        primeiras_damas: parseInt(interaction.fields.getTextInputValue("da")) || 0, 
        cotaRoleId: interaction.fields.getTextInputValue("cr") 
      };
    } else {
      updateData = { 
        canCall: isSim("cc"), 
        chat_privado: isSim("cp"), 
        hasCustomRole: isSim("crp"), 
        high_quality_voice: isSim("hq") 
      };
    }

    await vipConfig.updateTier(guildId, tierId, type, updateData);
    return interaction.reply({ content: `✅ Benefícios de \`${tierId}\` atualizados!`, ephemeral: true });
  }
};
