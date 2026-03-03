const { createDataStore } = require("../store/dataStore");
const vipConfigStore = createDataStore("vipConfig.json");

function createVipConfigManager() {
  async function getGuildTiers(guildId) {
    if (!guildId) return {};
    const data = await vipConfigStore.load();
    return data[guildId] || {};
  }

  async function getTierConfig(guildId, tierId) {
    if (!guildId || !tierId) return null;
    const tiers = await getGuildTiers(guildId);
    const raw = tiers[tierId];
    if (!raw) return null;

    const benefits = raw.benefits && typeof raw.benefits === "object" ? raw.benefits : {};
    const economy = benefits.economy || {};
    const social = benefits.social || {};
    const tech = benefits.tech || {};

    // --- Lógica de Prioridade (Valores do benefício ou da raiz do objeto) ---
    const precoShop = economy.preco_shop ?? raw.preco_shop ?? 0;
    const bonusInicial = economy.bonus_inicial ?? raw.bonus_inicial ?? 0;
    const dailyExtra = economy.valor_daily_extra ?? raw.valor_daily_extra ?? 0;
    const maoDeMidas = economy.mao_de_midas ?? false;

    const limiteFamilia = social.limite_familia ?? raw.limite_familia ?? 0;
    const vipsParaDar = social.vips_para_dar ?? 0;
    const tipoCota = social.tipo_cota ?? null;

    const fantasma = tech.fantasma ?? false; // Habilidade Fantasma
    const criarCallVip = tech.criar_call_vip ?? raw.criar_call_vip ?? false;

    return {
      id: tierId,
      name: raw.name ?? "VIP",
      roleId: raw.roleId ?? null,
      
      // Atributos de Economia
      preco_shop: Number(precoShop),
      bonus_inicial: Number(bonusInicial),
      valor_daily_extra: Number(dailyExtra),
      mao_de_midas: Boolean(maoDeMidas),

      // Atributos Sociais
      limite_familia: Number(limiteFamilia),
      vips_para_dar: Number(vipsParaDar),
      tipo_cota: tipoCota,

      // Atributos Técnicos
      fantasma: Boolean(fantasma),
      criar_call_vip: Boolean(criarCallVip),
      cor_exclusiva: tech.cor_exclusiva ?? raw.cor_exclusiva ?? null,
    };
  }

  // --- NOVA FUNÇÃO: SALVA OS DADOS DO MODAL ---
  async function updateTierBenefits(guildId, tierId, category, benefitsPatch) {
    if (!guildId || !tierId) return;
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      if (!tiers[tierId]) tiers[tierId] = { benefits: { economy: {}, social: {}, tech: {} } };
      if (!tiers[tierId].benefits) tiers[tierId].benefits = { economy: {}, social: {}, tech: {} };

      // Atualiza apenas a categoria específica (economy, social ou tech)
      tiers[tierId].benefits[category] = { 
        ...tiers[tierId].benefits[category], 
        ...benefitsPatch 
      };
      return tiers;
    });
  }

  async function setGuildTier(guildId, tierId, tierData) {
    if (!guildId || !tierId) return;
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      tiers[tierId] = { ...(tiers[tierId] || {}), ...tierData };
      return tiers;
    });
  }

  async function removeGuildTier(guildId, tierId) {
    if (!guildId || !tierId) return;
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      delete tiers[tierId];
      return tiers;
    });
  }

  async function getMemberTier(member) {
    if (!member?.guild?.id) return null;
    const tiers = await getGuildTiers(member.guild.id);
    let melhor = null;
    let maiorPreco = -1;

    for (const [id, tier] of Object.entries(tiers)) {
      if (member.roles.cache.has(tier.roleId)) {
        const config = await getTierConfig(member.guild.id, id);
        const preco = config.preco_shop ?? 0;
        if (preco > maiorPreco) {
          maiorPreco = preco;
          melhor = config;
        }
      }
    }
    return melhor;
  }

  return { 
    getGuildTiers, 
    getTierConfig, 
    setGuildTier, 
    removeGuildTier, 
    getMemberTier, 
    updateTierBenefits // Exportada para o vipadmin usar
  };
}

module.exports = { createVipConfigManager };
