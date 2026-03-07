// ============================================================
//  vipExpiryManager.js  —  Refatorado
//  Novidades:
//   • Usa vipRole.removeTierRole para remover o cargo do Tier
//   • O cargo base VIP é removido automaticamente dentro de
//     vipService.removeVip (via _removeBaseRole interno)
//   • Log mais detalhado por etapa de limpeza
// ============================================================

function createVipExpiryManager({
  client,
  vipService,
  vipRoleManager,
  vipChannelManager,
  familyService,
  logger,
}) {
  // ---------------------------------------------------------
  //  cleanupVipUser — limpa tudo ao expirar/remover manualmente
  // ---------------------------------------------------------
  async function cleanupVipUser(guild, userId, vipEntry) {
    const guildId = guild.id;

    // 1. Remove cargo personalizado (/myvip role)
    if (vipRoleManager?.deletePersonalRole) {
      await vipRoleManager.deletePersonalRole(userId, { guildId }).catch((err) =>
        logger?.error?.({ err, userId, guildId }, "Falha ao deletar cargo pessoal no expiry")
      );
    }

    // 2. Remove canais privados VIP
    if (vipChannelManager?.deleteVipChannels) {
      await vipChannelManager.deleteVipChannels(userId, { guildId }).catch((err) =>
        logger?.error?.({ err, userId, guildId }, "Falha ao deletar canais VIP no expiry")
      );
    }

    // 3. Dissolve família (se houver)
    if (familyService?.deleteFamily) {
      await familyService.deleteFamily(guild, userId).catch(() => {
        // Usuário pode não ter família — ignorar silenciosamente
      });
    }

    // 4. Remove cargo do Tier específico
    if (vipEntry?.tierId && vipRoleManager?.removeTierRole) {
      await vipRoleManager.removeTierRole(userId, vipEntry.tierId, { guildId }).catch((err) =>
        logger?.error?.({ err, userId, guildId, tierId: vipEntry.tierId }, "Falha ao remover cargo de tier no expiry")
      );
    } else if (vipEntry?.tierId) {
      // Fallback direto se vipRoleManager não tiver o método (compatibilidade)
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          const tier = await vipService.getTierConfig(guildId, vipEntry.tierId);
          if (tier?.roleId) await member.roles.remove(tier.roleId).catch(() => {});
        }
      } catch (e) {
        logger?.error?.({ err: e, userId, guildId }, "Falha ao remover cargo de tier (fallback) no expiry");
      }
    }

    // NOTA: o cargo base VIP é removido automaticamente dentro de
    // vipService.removeVip via _removeBaseRole. Não precisa fazer aqui.
  }

  // ---------------------------------------------------------
  //  runOnce — varre todos os VIPs e expira os que venceram
  // ---------------------------------------------------------
  async function runOnce() {
    const now          = Date.now();
    let   expiredCount = 0;

    for (const guild of client.guilds.cache.values()) {
      const guildId = guild.id;
      const ids     = vipService.listVipIds(guildId);

      for (const userId of ids) {
        const entry     = vipService.getVip(guildId, userId);
        const expiresAt = entry?.expiresAt;

        if (!expiresAt || expiresAt > now) continue;

        try {
          // removeVip já remove o cargo base internamente
          const removed = await vipService.removeVip(guildId, userId);
          if (!removed?.removed) continue;

          expiredCount += 1;
          await cleanupVipUser(guild, userId, removed.vip);

          logger?.info?.({ userId, guildId, tierId: removed.vip?.tierId }, "VIP expirado e limpo");
        } catch (e) {
          logger?.error?.({ err: e, userId, guildId }, "Falha ao processar expiração de VIP");
        }
      }
    }

    if (expiredCount > 0) {
      logger?.info?.({ expiredCount }, "VIPs expirados processados");
    }
  }

  // ---------------------------------------------------------
  //  start — agenda a verificação periódica
  // ---------------------------------------------------------
  function start({ intervalMs = 5 * 60 * 1000 } = {}) {
    runOnce().catch((err) => logger?.error?.({ err }, "Erro na primeira execução do vipExpiry"));
    setInterval(() => runOnce().catch((err) => logger?.error?.({ err }, "Erro no ciclo vipExpiry")), intervalMs);
  }

  return { start, runOnce };
}

module.exports = { createVipExpiryManager };
