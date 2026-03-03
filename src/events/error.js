const { logger } = require("../logger");

module.exports = {
  name: "error",
  async execute(error, client) {
    // Log padrão do Winston
    logger.error({ err: error }, "Discord.js client error");

    // Log no Discord (se configurado)
    const logManager = client.services?.logManager;
    if (logManager) {
      // Tentar enviar para o primeiro guild disponível (ou todos)
      for (const guild of client.guilds.cache.values()) {
        try {
          await logManager.logSystemError({
            guildId: guild.id,
            error,
            context: { source: "discord.js client error" },
            stack: error.stack,
          });
        } catch {
          // Ignorar falhas de log
        }
      }
    }
  },
};
