const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder
} = require("discord.js");
const { createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { setGuildConfig } = require("../config/guildConfig");
const { checkCommandPermissions } = require("../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vipadmin")
    .setDescription("Administração total do sistema VIP")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) => 
      s.setName("list").setDescription("Lista VIPs ativos e Tiers configurados")
    )
    .addSubcommand((s) =>
      s
        .setName("tier")
        .setDescription("Configura um Tier VIP (interativo)")
        .addStringOption((o) => o.setName("id").setDescription("ID único (ex: gold)").setRequired(true))
        .addRoleOption((o) => o.setName("cargo").setDescription("Cargo do Tier VIP").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription("Configura cargos de separador e categorias")
        .addRoleOption((o) => o.setName("cargo_base").setDescription("Cargo VIP principal"))
        .addChannelOption((o) => o.setName("categoria_vip").addChannelTypes(ChannelType.GuildCategory).setDescription("Categoria para canais VIP"))
        .addChannelOption((o) => o.setName("categoria_familia").addChannelTypes(ChannelType.GuildCategory).setDescription("Categoria para famílias"))
        .addRoleOption((o) => o.setName("sep_vip").setDescription("Cargo separador de VIPs"))
        .addRoleOption((o) => o.setName("sep_familia").setDescription("Cargo separador de Famílias"))
        .addRoleOption((o) => o.setName("sep_personalizados").setDescription("Cargo separador de Personalizados"))
    )
    .addSubcommand((s) => 
      s.setName("config-staff").setDescription("Define cargos autorizados a gerenciar VIP")
    )
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Concede VIP manualmente a um usuário")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuário que receberá o VIP").setRequired(true))
        .addIntegerOption((o) => o.setName("dias").setDescription("Duração em dias (0 para permanente)").setRequired(true))
        .addStringOption((o) => o.setName("tier").setDescription("ID do Tier (ex: bronze)").setRequired(false))
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove o status VIP de um usuário")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuário a remover").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("delete-family")
        .setDescription("Exclui permanentemente a família de um usuário")
        .addUserOption((o) => o.setName("usuario").setDescription("Dono da família").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("delete-vip-assets")
        .setDescription("Limpa todos os cargos e canais VIP de um usuário")
        .addUserOption((o) => o.setName("usuario").setDescription("Usuário alvo").setRequired(true))
    ),

  async execute(interaction) {
    const permissionCheck = await checkCommandPermissions(interaction, { checkStaff: true, checkChannel: true });
    if (!permissionCheck.allowed) return interaction.reply({ embeds: [createErrorEmbed(permissionCheck.reason)], ephemeral: true });

    const { vip: vipService, vipConfig, family: familyService, vipRole: vipRoleManager, vipChannel: vipChannelManager, log: logService } = interaction.client.services;
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const { tiers, activeVips } = await vipService.getFullVipReport(interaction.guildId);
      const embed = new EmbedBuilder().setTitle("📊 Painel de Controle VIP").setColor("#5865F2").setTimestamp();

      const tierEntries = Object.entries(tiers);
      const tierText = tierEntries.length > 0 
        ? tierEntries.map(([id, data]) => 
            `• **${id.toUpperCase()}**: <@&${data.roleId}>\n  └ 💰 Preço: \`${data.benefits?.economy?.preco_shop || 0}\` | 👥 Vagas: \`${data.benefits?.social?.limite_familia || 0}\``
          ).join('\n\n')
        : "Nenhum tier configurado.";

      const vipsText = activeVips.length > 0
        ? activeVips.map(v => 
            `• <@${v.userId}> | \`${v.tierId || 'padrão'}\` | <t:${Math.floor(v.expiresAt / 1000)}:R>`
          ).join('\n')
        : "Nenhum VIP ativo.";

      embed.addFields(
        { name: "💎 Configurações de Tiers", value: tierText.length > 1024 ? tierText.substring(0, 1021) + "..." : tierText },
        { name: "👥 Usuários Ativos", value: vipsText.length > 1024 ? vipsText.substring(0, 1021) + "..." : vipsText }
      );
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === "tier") {
      const id = interaction.options.getString("id");
      const role = interaction.options.getRole("cargo");
      await vipConfig.setGuildTier(interaction.guildId, id, { roleId: role.id, name: role.name });

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`vipadmin_tier_category_${interaction.guildId}_${id}`)
        .setPlaceholder("Selecione a categoria para configurar")
        .addOptions(
          { label: "💰 Economia & Loja", value: "economy" },
          { label: "👥 Social & Limites", value: "social" },
          { label: "⚡ Permissões Técnicas", value: "tech" }
        );

      return interaction.reply({
        embeds: [createSuccessEmbed(`Tier **${id}** iniciado com o cargo ${role}. Escolha uma categoria abaixo:`)],
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }

    if (sub === "add") {
      const alvo = interaction.options.getUser("usuario");
      const dias = interaction.options.getInteger("dias");
      const tierId = interaction.options.getString("tier");
      try {
        await vipService.addVip(interaction.guildId, alvo.id, { days: dias, tierId });
        return interaction.reply({ embeds: [createSuccessEmbed(`VIP concedido para ${alvo} por ${dias === 0 ? "tempo indeterminado" : `${dias} dias`}.`) ] });
      } catch (e) {
        return interaction.reply({ embeds: [createErrorEmbed("Erro ao adicionar VIP.")] });
      }
    }

    if (sub === "remove") {
      const alvo = interaction.options.getUser("usuario");
      try {
        await vipService.removeVip(interaction.guildId, alvo.id);
        return interaction.reply({ embeds: [createSuccessEmbed(`VIP removido de ${alvo}.`) ] });
      } catch (e) {
        return interaction.reply({ embeds: [createErrorEmbed("Erro ao remover VIP.")] });
      }
    }

    // Outros subcomandos (delete-family, setup, etc.) podem seguir a mesma lógica de permissão acima.
  },

  async handleSelectMenu(interaction) {
    if (interaction.customId === "vipadmin_staff_roles") {
      await setGuildConfig(interaction.guildId, { authorizedVipStaff: interaction.values });
      return interaction.update({ embeds: [createSuccessEmbed("Cargos de staff atualizados.")], components: [] });
    }

    if (interaction.customId.startsWith("vipadmin_tier_category_")) {
      const [,,, guildId, tierId] = interaction.customId.split("_");
      const category = interaction.values[0];

      if (category === "economy") {
        const modal = new ModalBuilder().setCustomId(`vipadmin_tier_modal_economy_${guildId}_${tierId}`).setTitle("Economia & Loja");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("valor_daily_extra").setLabel("Moedas extras no Daily").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 500")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("preco_shop").setLabel("Preço na Loja").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 10000")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("bonus_inicial").setLabel("Bônus ao Ativar").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 2000"))
        );
        return interaction.showModal(modal);
      }

      if (category === "social") {
        const modal = new ModalBuilder().setCustomId(`vipadmin_tier_modal_social_${guildId}_${tierId}`).setTitle("Social & Limites");
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("limite_familia").setLabel("Vagas na Família").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 5")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("limite_damas").setLabel("Vagas de Damas").setStyle(TextInputStyle.Short).setPlaceholder("Ex: 3"))
        );
        return interaction.showModal(modal);
      }
    }
  }
};
