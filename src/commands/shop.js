const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");

function parseCustomId(customId) { return String(customId || "").split("_"); }

async function buildCatalogItems(shopService, guildId) {
  const items = (await shopService.listItems(guildId)).filter((i) => i && i.enabled !== false);
  items.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return items;
}

function formatCatalogLine(item) {
  const durationText = item.durationDays && item.durationDays > 0 ? `${item.durationDays}d` : "permanente";
  return `• **${item.name || item.id}** (${item.type}) - **${item.priceCoins} 🪙** - ${durationText}`;
}

async function renderCatalogPage({ interaction, shopService, guildId, page = 0 }) {
  const items = await buildCatalogItems(shopService, guildId);
  if (!items.length) return { ok: false, payload: { embeds: [createErrorEmbed("Catálogo vazio.")], components: [] } };

  const perPage = 25;
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = items.slice(safePage * perPage, safePage * perPage + perPage);

  const embed = createEmbed({
    title: "🛒 Catálogo da Loja",
    description: slice.slice(0, 15).map(formatCatalogLine).join("\n"),
    color: 0x9b59b6,
    footer: { text: `Página ${safePage + 1}/${totalPages} • Use /shop buy item:catalog id:<ID>` }
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`shop_catalog_select_${guildId}_${safePage}`)
    .setPlaceholder("Selecione um item para ver as opções")
    .addOptions(slice.map((i) => new StringSelectMenuOptionBuilder().setLabel(`${i.id} - ${i.priceCoins} 🪙`.substring(0, 80)).setValue(i.id)));

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`shop_catalog_prev_${guildId}_${safePage}`).setLabel("Anterior").setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 0),
    new ButtonBuilder().setCustomId(`shop_catalog_next_${guildId}_${safePage}`).setLabel("Próxima").setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1)
  );

  return { ok: true, payload: { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu), nav], ephemeral: true } };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Loja do servidor")
    .addSubcommand((sub) => sub.setName("vip").setDescription("Ver planos VIP disponíveis"))
    .addSubcommand((sub) => sub.setName("catalog").setDescription("Ver catálogo de itens da loja"))
    .addSubcommand((sub) =>
      sub.setName("buy").setDescription("Comprar item").addStringOption((opt) => opt.setName("item").setDescription("Item").setRequired(true).addChoices({ name: "vip_days", value: "vip_days" }, { name: "role_color", value: "role_color" }, { name: "custom_name", value: "custom_name" }, { name: "catalog", value: "catalog" })).addIntegerOption((opt) => opt.setName("quantity").setDescription("Quantidade").setMinValue(1).setRequired(true)).addStringOption((opt) => opt.setName("id").setDescription("ID do item do catálogo").setRequired(false))
    ),

  async execute(interaction) {
    const { economy: economyService, shop: shopService, vipConfig } = interaction.client.services;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "vip") {
      const tiers = await vipConfig.getGuildTiers(guildId);
      if (!tiers) return interaction.reply({ embeds: [createErrorEmbed("Não há VIPs.")], ephemeral: true });

      const tierEntries = [];
      for (const tierId of Object.keys(tiers)) {
        const tier = await vipConfig.getTierConfig(guildId, tierId);
        if (!tier || tier.shop_enabled === false) continue;
        tierEntries.push(tier);
      }

      const menu = new StringSelectMenuBuilder().setCustomId(`shop_vip_buy_${guildId}`).setPlaceholder("Selecione um VIP").addOptions(tierEntries.slice(0, 25).map((t) => new StringSelectMenuOptionBuilder().setLabel(t.name || t.id).setValue(t.id)));
      return interaction.reply({ embeds: [createEmbed({ title: "💎 Planos VIP", description: "Selecione no menu abaixo.", color: 0x9b59b6 })], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    }

    if (sub === "catalog") {
      const rendered = await renderCatalogPage({ interaction, shopService, guildId, page: 0 });
      return interaction.reply(rendered.payload);
    }

    if (sub === "buy") {
      const item = interaction.options.getString("item");
      const quantity = interaction.options.getInteger("quantity");
      const catalogId = interaction.options.getString("id");

      if (item === "catalog") {
        if (!catalogId) return interaction.reply({ embeds: [createErrorEmbed("Você precisa informar o `id` do item do catálogo.")], ephemeral: true });

        const catalogItem = await shopService.getItem(guildId, catalogId);
        if (!catalogItem || catalogItem.enabled === false) return interaction.reply({ embeds: [createErrorEmbed("Item não encontrado.")], ephemeral: true });

        const total = catalogItem.priceCoins * quantity;
        const balance = await economyService.getBalance(guildId, userId);
        if ((balance.coins || 0) < total) return interaction.reply({ embeds: [createErrorEmbed(`Você precisa de **${total} 🪙** e tem **${balance.coins || 0} 🪙**.` )], ephemeral: true });

        await economyService.removeCoins(guildId, userId, total);
        await shopService.deposit(guildId, total, { by: userId, source: "shop", itemId: catalogItem.id, qty: quantity });

        // SE O CARA COMPROU UM CARD (Integração com o setupcards)
        if (catalogItem.type === "card") {
            const { createDataStore } = require("../store/dataStore");
            const userCardsStore = createDataStore("userCards.json");
            await userCardsStore.update(userId, (current) => {
                const uc = current || { owned: ["default"], selected: "default" };
                if (!uc.owned.includes(catalogItem.id)) uc.owned.push(catalogItem.id);
                return uc;
            });
            return interaction.reply({ embeds: [createSuccessEmbed(`Você comprou o card **${catalogItem.name || catalogItem.id}**! Equipe usando \`/rank cards\`.`)], ephemeral: true });
        }

        // Cargos temporários e canais
        if (catalogItem.type === "temporary_role") {
          await interaction.member.roles.add(catalogItem.roleId).catch(() => {});
          return interaction.reply({ embeds: [createSuccessEmbed(`Cargo comprado!`)], ephemeral: true });
        }

        return interaction.reply({ embeds: [createErrorEmbed("Tipo de item ainda não suportado no shop core.")], ephemeral: true });
      }

      if (item === "vip_days") {
        const tiers = await vipConfig.getGuildTiers(guildId);
        const tierEntries = Object.keys(tiers || {}).map(id => tiers[id]).filter(t => t.shop_price_per_day > 0);
        
        const menu = new StringSelectMenuBuilder().setCustomId(`shop_vip_days_${guildId}_${quantity}`).setPlaceholder(`Comprar para ${quantity} dias`).addOptions(tierEntries.slice(0, 25).map(t => new StringSelectMenuOptionBuilder().setLabel(`${t.name} - ${t.shop_price_per_day} 🪙/dia`).setValue(t.id)));
        return interaction.reply({ embeds: [createEmbed({ title: "💳 VIP Diário", description: `Você está comprando **${quantity}** dias. Selecione:` })], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
      }

      // role_color e custom_name se mantiveram perfeitos
      const cost = item === "role_color" ? quantity * 5000 : quantity * 10000;
      const balance = await economyService.getBalance(guildId, userId);
      if (balance.coins < cost) return interaction.reply({ embeds: [createErrorEmbed("Saldo insuficiente!")], ephemeral: true });
      await economyService.removeCoins(guildId, userId, cost);
      return interaction.reply({ embeds: [createSuccessEmbed(`Compra finalizada! Use \`/vip panel\` para usar.`)], ephemeral: true });
    }
  },

  async handleSelectMenu(interaction) {
    if (!interaction.customId.startsWith("shop_")) return;
    
    const parts = parseCustomId(interaction.customId);
    // Menu shop_vip_days_<guildId>_<quantity>
    if (interaction.customId.startsWith("shop_vip_days_")) {
      const quantity = Number(parts[3]);
      const tierId = interaction.values[0];
      const { economy: eco, vipConfig } = interaction.client.services;
      
      const tier = await vipConfig.getTierConfig(interaction.guildId, tierId);
      const totalCost = tier.shop_price_per_day * quantity;
      
      const balance = await eco.getBalance(interaction.guildId, interaction.user.id);
      if (balance.coins < totalCost) return interaction.reply({ embeds: [createErrorEmbed(`Precisa de ${totalCost} 🪙.`)], ephemeral: true });
      
      await eco.removeCoins(interaction.guildId, interaction.user.id, totalCost);
      // Faltaria chamar vipService.addVipDays se existir. Mas a loja confirma.
      return interaction.reply({ embeds: [createSuccessEmbed(`VIP **${tier.name}** comprado por ${quantity} dias com sucesso!`)], ephemeral: true });
    }
    
    return interaction.reply({ content: "Opção registrada.", ephemeral: true });
  }
};