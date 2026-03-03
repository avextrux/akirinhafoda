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

    const benefits = raw.benefits || {};
    const eco = benefits.economy || {};
    const soc = benefits.social || {};
    const tec = benefits.tech || {};

    return {
      id: tierId,
      name: raw.name ?? "VIP",
      roleId: raw.roleId ?? null,
      preco_shop: Number(eco.preco_shop ?? raw.preco_shop ?? 0),
      valor_daily_extra: Number(eco.valor_daily_extra ?? raw.valor_daily_extra ?? 0),
      mao_de_midas: Boolean(eco.mao_de_midas ?? false),
      limite_familia: Number(soc.limite_familia ?? raw.limite_familia ?? 0),
      vips_para_dar: Number(soc.vips_para_dar ?? 0),
      tipo_cota: soc.tipo_cota ?? null,
      fantasma: Boolean(tec.fantasma ?? false),
      criar_call_vip: Boolean(tec.criar_call_vip ?? raw.criar_call_vip ?? false)
    };
  }

  async function updateTierBenefits(guildId, tierId, category, patch) {
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      if (!tiers[tierId]) tiers[tierId] = { benefits: { economy: {}, social: {}, tech: {} } };
      if (!tiers[tierId].benefits) tiers[tierId].benefits = { economy: {}, social: {}, tech: {} };
      tiers[tierId].benefits[category] = { ...tiers[tierId].benefits[category], ...patch };
      return tiers;
    });
  }

  async function setGuildTier(guildId, tierId, tierData) {
    await vipConfigStore.update(guildId, (current) => {
      const tiers = current || {};
      tiers[tierId] = { ...(tiers[tierId] || {}), ...tierData };
      return tiers;
    });
  }

  return { getGuildTiers, getTierConfig, setGuildTier, updateTierBenefits };
}

module.exports = { createVipConfigManager };