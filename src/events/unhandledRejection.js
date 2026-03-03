const { logger } = require("../logger");

module.exports = {
  name: "unhandledRejection",
  async execute(error, promise, client) {
    logger.error({ err: error, promise }, "Unhandled Rejection");

    const logManager = client.services?.logManager;
    if (logManager) {
      for (const guild of client.guilds.cache.values()) {
        try {
          await logManager.logSystemError({
            guildId: guild.id,
            error,
            context: { source: "unhandledRejection", promise },
            stack: error.stack,
          });
        } catch {
          // Ignorar falhas de log
        }
      }
    }
  },
};
