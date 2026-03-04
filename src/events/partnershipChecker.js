const { Events } = require("discord.js");
const { createEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");
const { getGuildConfig } = require("../config/guildConfig");

const partnersStore = createDataStore("partners.json");
const boostStore = createDataStore("boosts.json");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log("🔍 Iniciando verificação automática de parcerias...");

    // Verificar parcerias a cada 5 minutos
    setInterval(async () => {
      await checkExpiredPartnerships(client);
      await checkExpiredBoosts(client);
    }, 5 * 60 * 1000); // 5 minutos

    // Executar verificação inicial
    await checkExpiredPartnerships(client);
    await checkExpiredBoosts(client);
  }
};

// Função para verificar parcerias expiradas
async function checkExpiredPartnerships(client) {
  try {
    const partners = await partnersStore.load();
    const mainGuildId = process.env.MAIN_GUILD_ID;
    const mainGuild = client.guilds.cache.get(mainGuildId);
    
    if (!mainGuild) return;

    const config = await getGuildConfig(mainGuildId);
    const partnerChannelId = config.partnerChannelId;
    
    if (!partnerChannelId) return;

    const partnerChannel = mainGuild.channels.cache.get(partnerChannelId);
    if (!partnerChannel) return;

    const now = Date.now();
    let expiredCount = 0;

    for (const [key, partnership] of Object.entries(partners)) {
      // Verificar se a parceria expirou (30 dias)
      const partnershipAge = now - new Date(partnership.acceptedAt).getTime();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
      
      if (partnership.status === "accepted" && partnershipAge > thirtyDaysInMs) {
        // Marcar como expirada
        await partnersStore.update(key, {
          ...partnership,
          status: "expired",
          expiredAt: new Date().toISOString()
        });

        // Enviar notificação
        const embed = createEmbed({
          title: "⚠️ Parceria Expirada",
          description: 
            `**Servidor:** ${partnership.serverName}\n` +
            `**ID:** ${partnership.requesterGuild}\n` +
            `**Expirou em:** ${new Date().toLocaleString('pt-BR')}\n\n` +
            `Esta parceria expirou após 30 dias. Para renovar, use \`/partnership solicitar\` novamente.`,
          color: 0xff6600,
          footer: { text: "WDA - Todos os direitos reservados" },
          timestamp: new Date()
        });

        await partnerChannel.send({ embeds: [embed] });
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`📅 ${expiredCount} parcerias expiradas e removidas`);
    }
  } catch (error) {
    console.error("Erro ao verificar parcerias expiradas:", error);
  }
}

// Função para verificar boosts expirados
async function checkExpiredBoosts(client) {
  try {
    const boosts = await boostStore.load();
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, boost] of Object.entries(boosts)) {
      // Verificar se o boost expirou
      if (boost.status === "active" && new Date(boost.expiresAt).getTime() <= now) {
        // Marcar como expirado
        await boostStore.update(key, {
          ...boost,
          status: "expired",
          expiredAt: new Date().toISOString()
        });

        console.log(`⏰ Boost expirado: ${boost.guildName}`);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`⏰ ${expiredCount} boosts expirados e removidos`);
    }
  } catch (error) {
    console.error("Erro ao verificar boosts expirados:", error);
  }
}
