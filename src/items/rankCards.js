// Itens de Cards para a Loja
// Estes itens podem ser adicionados ao sistema de loja existente

const rankCards = [
  {
    id: "premium_card",
    name: "Card Premium",
    description: "Card de rank exclusivo com tema azul premium",
    type: "rank_card",
    priceCoins: 500,
    durationDays: null, // permanente
    cardId: "premium",
    enabled: true,
    metadata: {
      colors: ["#7289da", "#4a5568"],
      style: "premium"
    }
  },
  {
    id: "gold_card",
    name: "Card Gold",
    description: "Card de rank dourado com estilo luxuoso",
    type: "rank_card",
    priceCoins: 750,
    durationDays: null, // permanente
    cardId: "gold",
    enabled: true,
    metadata: {
      colors: ["#ffd700", "#ffb347"],
      style: "gold"
    }
  },
  {
    id: "neon_card",
    name: "Card Neon",
    description: "Card de rank vibrante com tema neon",
    type: "rank_card",
    priceCoins: 1000,
    durationDays: null, // permanente
    cardId: "neon",
    enabled: true,
    metadata: {
      colors: ["#ff006e", "#8338ec"],
      style: "neon"
    }
  },
  {
    id: "ocean_card",
    name: "Card Ocean",
    description: "Card de rank com tema oceânico relaxante",
    type: "rank_card",
    priceCoins: 600,
    durationDays: null, // permanente
    cardId: "ocean",
    enabled: true,
    metadata: {
      colors: ["#0077be", "#00a8cc"],
      style: "ocean"
    }
  }
];

// Função para adicionar cards ao sistema de loja
async function addRankCardsToShop(shopService, guildId) {
  for (const card of rankCards) {
    try {
      await shopService.addItem(guildId, {
        ...card,
        id: `${guildId}_${card.id}`, // ID único por servidor
        guildId: guildId
      });
      console.log(`Card ${card.name} adicionado à loja do servidor ${guildId}`);
    } catch (error) {
      console.error(`Erro ao adicionar card ${card.name}:`, error);
    }
  }
}

module.exports = {
  rankCards,
  addRankCardsToShop
};
