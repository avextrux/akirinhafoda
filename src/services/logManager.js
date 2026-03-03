const { EmbedBuilder } = require("discord.js");
const { logger } = require("../logger");

function createLogManager({ client }) {
  const LOG_TYPES = {
    STAFF: "staff",
    USER: "user",
    ECONOMY: "economy",
    SYSTEM: "system",
  };

  const COLORS = {
    [LOG_TYPES.STAFF]: 0x3498db, // blue
    [LOG_TYPES.USER]: 0x2ecc71,   // green
    [LOG_TYPES.ECONOMY]: 0xf1c40f, // yellow
    [LOG_TYPES.SYSTEM]: 0xe74c3c,   // red
  };

  const ICONS = {
    [LOG_TYPES.STAFF]: "🛡️",
    [LOG_TYPES.USER]: "👤",
    [LOG_TYPES.ECONOMY]: "💰",
    [LOG_TYPES.SYSTEM]: "⚠️",
  };

  async function getLogChannel(guildId, type) {
    if (!client || !client.guilds?.cache) return null;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return null;

    // Usa guildConfig (já existente no projeto) para canais de log
    const { getGuildConfig } = require("../config/guildConfig");
    const guildConfig = await getGuildConfig(guildId);
    const channelMap = guildConfig.logChannels || {};

    const channelId = channelMap[type];
    if (!channelId) return null;

    return guild.channels.fetch(channelId).catch(() => null);
  }

  function buildEmbed({ type, title, description, fields = [], user, staffUser, guild, extra = {} }) {
    const embed = new EmbedBuilder()
      .setColor(COLORS[type] || 0x95a5a6)
      .setTitle(`${ICONS[type] || "📝"} ${title}`)
      .setDescription(description)
      .setTimestamp();

    if (user) {
      embed.addFields({ name: "Usuário", value: `<@${user.id}> (${user.tag})`, inline: true });
    }
    if (staffUser) {
      embed.addFields({ name: "Staff", value: `<@${staffUser.id}> (${staffUser.tag})`, inline: true });
    }
    if (guild) {
      embed.addFields({ name: "Servidor", value: guild.name, inline: true });
    }

    if (fields.length) embed.addFields(...fields);
    if (extra.footer) embed.setFooter({ text: extra.footer });
    if (extra.thumbnail) embed.setThumbnail(extra.thumbnail);

    return embed;
  }

  async function log({ type, guildId, title, description, fields = [], user, staffUser, extra = {} }) {
    if (!type || !guildId || !title) return;

    const guild = client.guilds.cache.get(guildId);
    const channel = await getLogChannel(guildId, type);
    if (!channel) {
      logger.warn({ type, guildId, title }, "Log channel not configured");
      return;
    }

    const embed = buildEmbed({ type, title, description, fields, user, staffUser, guild, extra });
    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error({ err, type, guildId, title }, "Failed to send log message");
    }
  }

  // Métodos específicos para facilitar uso
  async function logStaffAction({ guildId, action, targetUser, staffUser, tierConfig, duration, paymentMethod, transactionId, reason }) {
    const fields = [
      { name: "Ação", value: action, inline: true },
      { name: "Método de Pagamento", value: paymentMethod || "N/A", inline: true },
    ];
    if (duration !== undefined) {
      fields.push({ name: "Duração", value: duration === 0 ? "Permanente" : `${duration} dias`, inline: true });
    }
    if (tierConfig) {
      fields.push({ name: "Tier", value: tierConfig.name || tierConfig.id, inline: true });
    }
    if (transactionId) {
      fields.push({ name: "ID da Transação", value: `\`${transactionId}\``, inline: false });
    }
    if (reason) {
      fields.push({ name: "Motivo", value: reason, inline: false });
    }

    await log({
      type: LOG_TYPES.STAFF,
      guildId,
      title: `Ação de Staff: ${action}`,
      description: `O staff <@${staffUser.id}> realizou uma ação de VIP no usuário <@${targetUser.id}>.`,
      fields,
      user: targetUser,
      staffUser,
      extra: { footer: `ID: ${transactionId || "N/A"}` },
    });
  }

  async function logUserAction({ guildId, action, user, details = {} }) {
    const fields = Object.entries(details).map(([k, v]) => ({ name: k, value: String(v), inline: true }));
    await log({
      type: LOG_TYPES.USER,
      guildId,
      title: `Ação de Usuário: ${action}`,
      description: `O usuário <@${user.id}> realizou uma ação no sistema VIP.`,
      fields,
      user,
    });
  }

  async function logEconomyAction({ guildId, action, user, amount, tierId, paymentMethod, transactionId, extra = {} }) {
    const fields = [
      { name: "Ação", value: action, inline: true },
      { name: "Valor", value: `${amount} 🪙`, inline: true },
      { name: "Método", value: paymentMethod || "N/A", inline: true },
    ];
    if (tierId) {
      fields.push({ name: "Tier", value: tierId, inline: true });
    }
    if (transactionId) {
      fields.push({ name: "ID da Transação", value: `\`${transactionId}\``, inline: false });
    }

    await log({
      type: LOG_TYPES.ECONOMY,
      guildId,
      title: `Movimentação Financeira: ${action}`,
      description: `Transação envolvendo <@${user.id}>.`,
      fields,
      user,
      extra: { footer: `ID: ${transactionId || "N/A"}` },
    });
  }

  async function logSystemError({ guildId, error, context = {}, stack }) {
    const fields = [
      { name: "Erro", value: `\`\`\`${error.message || error}\`\`\``, inline: false },
    ];
    if (Object.keys(context).length) {
      fields.push({ name: "Contexto", value: `\`\`\`json\n${JSON.stringify(context, null, 2)}\`\`\``, inline: false });
    }
    if (stack) {
      fields.push({ name: "Stack", value: `\`\`\`${stack}\`\`\``, inline: false });
    }

    await log({
      type: LOG_TYPES.SYSTEM,
      guildId,
      title: "Erro Crítico do Sistema",
      description: "Ocorreu um erro inesperado no sistema VIP.",
      fields,
      extra: { footer: "Verifique os logs do servidor para mais detalhes." },
    });
  }

  return {
    LOG_TYPES,
    log,
    logStaffAction,
    logUserAction,
    logEconomyAction,
    logSystemError,
  };
}

module.exports = { createLogManager };
