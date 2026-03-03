const { logger } = require("../logger");

module.exports = {
  name: "uncaughtException",
  async execute(error, client) {
    logger.fatal({ err: error }, "Uncaught Exception");

    const logManager = client.services?.logManager;
    if (logManager) {
      for (const guild of client.guilds.cache.values()) {
        try {
          await logManager.logSystemError({
            guildId: guild.id,
            error,
            context: { source: "uncaughtException" },
            stack: error.stack,
          });
        } catch {
          // Ignorar falhas de log
        }
      }
    }

    // Força graceful shutdown
    process.exit(1);
  },
};
