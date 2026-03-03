// Ponto central para registrar todos os serviços
const { createDataStore } = require("../store/dataStore");
const { createEconomyService } = require("./economyService");
const { createVipService } = require("../vip/vipService");
const { createVipConfigManager } = require("../vip/vipConfigManager");
const { createVipRoleManager } = require("../vip/vipRoleManager");
const { createVipChannelManager } = require("../vip/vipChannelManager");
const { createVipExpiryManager } = require("../vip/vipExpiryManager");
const { createLogManager } = require("./logManager");
const { createVipOnboarding } = require("./vipOnboarding");
const { createVipHooks } = require("./vipHooks");
const { createShopService } = require("./shopService");
const { createShopExpiryManager } = require("./shopExpiryManager");

async function initializeServices(client) {
  // Core
  const store = createDataStore("vip.json");
  const vipConfig = createVipConfigManager();
  const economyService = createEconomyService();
  const logManager = createLogManager({ client });

  // Shop
  const shopService = createShopService({ logger: client.logger });
  const shopExpiryManager = createShopExpiryManager({ client, shopService, logger: client.logger });

  // VIP
  const vipService = createVipService({ store, logger: client.logger, configManager: vipConfig, client });
  const vipRoleManager = createVipRoleManager({ client, vipService, logger: client.logger });
  const vipChannelManager = createVipChannelManager({ client, vipService, logger: client.logger });
  const vipExpiryManager = createVipExpiryManager({ client, vipService, vipRoleManager, vipChannelManager });
  const vipOnboarding = createVipOnboarding({ client, vipService, logManager });
  const vipHooks = createVipHooks({ client, logManager, economyService, vipOnboarding });

  // Registrar hooks no vipService
  vipService.addHook("onAdd", vipHooks.onAdd);
  vipService.addHook("onRemove", vipHooks.onRemove);
  vipService.addHook("onExpire", vipHooks.onExpire);

  // Inicializar state
  await vipService.init();

  // Expor serviços no client (mescla com existentes, sem sobrescrever)
  client.services = {
    ...client.services,
    economy: economyService,
    vip: vipService,
    vipConfig,
    vipRole: vipRoleManager,
    vipChannel: vipChannelManager,
    vipExpiry: vipExpiryManager,
    logManager,
    vipOnboarding,
    shop: shopService,
    shopExpiry: shopExpiryManager,
  };

  // Iniciar expiração automática
  vipExpiryManager.start();
  shopExpiryManager.start();

  return client.services;
}

module.exports = { initializeServices };
