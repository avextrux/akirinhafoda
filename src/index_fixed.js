// Versão corrigida do index.js com tratamento de erros

console.log("🔧 Iniciando bot com diagnóstico de dependências...");

// Testar import do Discord.js
let Client, Events, GatewayIntentBits;
try {
  const discord = require("discord.js");
  Client = discord.Client;
  Events = discord.Events;
  GatewayIntentBits = discord.GatewayIntentBits;
  console.log("✅ Discord.js importado com sucesso");
} catch (error) {
  console.error("❌ Erro ao importar Discord.js:", error.message);
  console.error("Verifique se discord.js@14+ está instalado");
  process.exit(1);
}

// Testar import do Config
let config;
try {
  config = require("./config");
  console.log("✅ Config carregado com sucesso");
} catch (error) {
  console.error("❌ Erro ao carregar config:", error.message);
  console.error("Verifique suas variáveis de ambiente (.env)");
  process.exit(1);
}

const { logger } = require("./logger");
const { loadCommands } = require("./loadCommands");
const { createVipStore } = require("./vip/vipStore");
const { createVipService } = require("./vip/vipService");
const { createVipRoleManager } = require("./vip/vipRoleManager");
const { createVipChannelManager } = require("./vip/vipChannelManager");
const { createVipConfigManager } = require("./vip/vipConfigManager");
const { getGuildConfig } = require("./config/guildConfig");
const { createEmbed } = require("./embeds");
const { connectToMongo } = require("./database/connect");

function createClient() {
  // Verificar se GatewayIntentBits está disponível
  if (!GatewayIntentBits) {
    console.error("❌ GatewayIntentBits não está disponível");
    throw new Error("GatewayIntentBits undefined - verifique a versão do Discord.js");
  }
  
  // Verificar intenções específicas
  const requiredIntents = [
    'Guilds',
    'GuildMessages', 
    'MessageContent',
    'GuildVoiceStates',
    'GuildMembers'
  ];
  
  const missingIntents = requiredIntents.filter(intent => !GatewayIntentBits[intent]);
  if (missingIntents.length > 0) {
    console.error("❌ Intenções faltando:", missingIntents.join(', '));
    throw new Error(`Intenções não encontradas: ${missingIntents.join(', ')}`);
  }
  
  console.log("✅ Todas as intenções necessárias estão disponíveis");
  
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers
    ],
  });
}

const { loadEvents } = require("./loadEvents");

const { createLogService } = require("./services/logService");
const { createEconomyService } = require("./services/economyService");
const { createFamilyService } = require("./services/familyService");
const { createPresenceService } = require("./services/presenceService");
const { createTagRoleService } = require("./services/tagRoleService");
const { createTagRoleManager } = require("./services/tagRoleManager");
const { createShopService } = require("./services/shopService");
const { createShopExpiryManager } = require("./services/shopExpiryManager");

async function main() {
  try {
    console.log("🚀 Iniciando função principal...");
    
    // Validar configuração essencial
    if (!config.discord || !config.discord.token) {
      throw new Error("DISCORD_TOKEN não está configurado");
    }
    
    console.log("✅ Configuração validada");
    
    // Criar client
    console.log("🤖 Criando client Discord...");
    const client = createClient();
    console.log("✅ Client criado com sucesso");
    
    // Conectar ao MongoDB
    console.log("🗄️ Conectando ao MongoDB...");
    if (config.mongo && config.mongo.uri) {
      await connectToMongo(config.mongo.uri);
      console.log("✅ MongoDB conectado");
    } else {
      console.log("⚠️ MongoDB não configurado, continuando sem banco de dados");
    }
    
    // Carregar comandos
    console.log("📋 Carregando comandos...");
    const { commands } = loadCommands({ logger });
    client.commands = commands;
    client.services = {};
    console.log("✅ Comandos carregados");
    
    // Criar serviços
    console.log("🔧 Criando serviços...");
    client.services.log = createLogService({ client });
    client.services.economy = createEconomyService();
    client.services.family = createFamilyService();
    client.services.presence = createPresenceService();

    client.services.tagRole = createTagRoleService({ logger });
    client.services.tagRoleManager = createTagRoleManager({
      logger,
      client,
      guildConfig: getGuildConfig,
    });
    client.services.tagRoleChannelManager = createVipChannelManager({
      logger,
      client,
      guildConfig: getGuildConfig,
    });
    client.services.vip = createVipService({
      store: createVipStore(),
      roleManager: createVipRoleManager({ client }),
      channelManager: createVipChannelManager({
        logger,
        client,
        guildConfig: getGuildConfig,
      }),
      configManager: createVipConfigManager(),
      logger,
    });
    client.services.shop = createShopService();
    client.services.shopExpiryManager = createShopExpiryManager({
      shopService: client.services.shop,
      logger,
    });
    console.log("✅ Serviços criados");
    
    // Carregar eventos
    console.log("📡 Carregando eventos...");
    loadEvents(client);
    console.log("✅ Eventos carregados");
    
    // Login no Discord
    console.log("🔐 Fazendo login no Discord...");
    await client.login(config.discord.token);
    
    console.log("🎉 Bot iniciado com sucesso!");
    console.log(`📊 Usuário: ${client.user.tag}`);
    console.log(`🏢 Servidores: ${client.guilds.cache.size}`);
    
  } catch (error) {
    console.error("❌ Erro fatal ao iniciar bot:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar
main().catch(error => {
  console.error("❌ Erro na função main:", error);
  process.exit(1);
});
