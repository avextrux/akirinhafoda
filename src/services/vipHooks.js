function createVipHooks({ client, logManager, economyService, vipOnboarding }) {
  // Hook: onAdd -> onboarding + logs + bônus econômico
  async function onAdd({ guildId, userId, entry, tierId, source }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const vipConfig = client.services?.vipConfig;
    const tier = tierId ? await vipConfig?.getTierConfig(guildId, tierId) : null;

    // 1) Onboarding (anúncio, DM, efeitos)
    if (vipOnboarding && tier) {
      await vipOnboarding.runOnboarding({ guildId, user, tierConfig: tier, source });
    }

    // 2) Log de auditoria (STAFF se source != 'shop', senão ECONOMY)
    if (logManager) {
      if (source === "shop") {
        await logManager.logEconomyAction({
          guildId,
          action: "VIP_PURCHASED",
          user,
          amount: tier?.preco_shop || 0,
          tierId: tier?.id,
          paymentMethod: "coins",
          transactionId: `VIP_${Date.now()}_${userId}`,
        });
      } else {
        await logManager.logStaffAction({
          guildId,
          action: "VIP_ADDED",
          targetUser: user,
          staffUser: null, // Preenchido pelo comando
          tierConfig: tier,
          duration: entry.expiresAt ? Math.ceil((entry.expiresAt - entry.addedAt) / (24 * 60 * 60 * 1000)) : 0,
          paymentMethod: "manual",
          transactionId: `VIP_${Date.now()}_${userId}`,
        });
      }
    }

    // 3) Bônus inicial de economia (se tier tiver)
    if (economyService && tier?.bonus_inicial && tier.bonus_inicial > 0) {
      await economyService.addCoins(guildId, userId, tier.bonus_inicial);
    }
  }

  // Hook: onRemove -> logs + cleanup de bônus
  async function onRemove({ guildId, userId, entry }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const vipConfig = client.services?.vipConfig;
    const tier = entry.tierId ? await vipConfig?.getTierConfig(guildId, entry.tierId) : null;

    if (logManager) {
      await logManager.logStaffAction({
        guildId,
        action: "VIP_REMOVED",
        targetUser: user,
        staffUser: null,
        tierConfig: tier,
        paymentMethod: "manual",
        transactionId: `VIP_REM_${Date.now()}_${userId}`,
      });
    }

    // Remover bônus diário extra (se houver lógica no economyService)
    // Aqui poderíamos chamar economyService.removeBonus(userId, 'vip_daily_extra')
  }

  // Hook: onExpire -> logs + cleanup
  async function onExpire({ guildId, userId, entry }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const vipConfig = client.services?.vipConfig;
    const tier = entry.tierId ? await vipConfig?.getTierConfig(guildId, entry.tierId) : null;

    if (logManager) {
      await logManager.logUserAction({
        guildId,
        action: "VIP_EXPIRED",
        user,
        details: {
          tier: tier?.name || tier?.id || "N/A",
          expiredAt: new Date(entry.expiresAt).toISOString(),
        },
      });
    }
  }

  return { onAdd, onRemove, onExpire };
}

module.exports = { createVipHooks };
