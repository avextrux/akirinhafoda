const { ChannelType, PermissionFlagsBits } = require("discord.js");

function createVipChannelManager({ client, vipService, logger }) {
  async function fetchGuild(targetGuildId) {
    if (!targetGuildId) return null;
    return client.guilds.fetch(targetGuildId).catch(() => null);
  }

  async function fetchMember(guild, userId) {
    if (!guild) return null;
    return guild.members.fetch(userId).catch(() => null);
  }

  async function ensureVipChannels(userId, { guildId: targetGuildId } = {}) {
    const guild = await fetchGuild(targetGuildId);
    const member = await fetchMember(guild, userId);
    if (!guild || !member) return { ok: false, reason: "guild_or_member_unavailable" };

    const guildConfig = vipService.getGuildConfig(guild.id);
    const catId = guildConfig?.vipCategoryId;

    if (!catId) return { ok: false, reason: "no_category_configured" };

    const settings = vipService.getSettings(guild.id, userId) || {};
    const personalRoleId = settings.roleId;
    
    let textChannel = settings.textChannelId
      ? await guild.channels.fetch(settings.textChannelId).catch(() => null)
      : null;
    let voiceChannel = settings.voiceChannelId
      ? await guild.channels.fetch(settings.voiceChannelId).catch(() => null)
      : null;

    const baseName = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // --- Lógica de Permissões Base ---
    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
      },
    ];

    // Permissões para o Dono (via cargo pessoal ou ID)
    const ownerPerms = {
      id: personalRoleId || member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.ManageChannels,
      ],
    };
    permissionOverwrites.push(ownerPerms);

    // --- NOVO: Habilidade Fantasma ---
    // Se houver um cargo fantasma configurado, ele vê TUDO
    if (guildConfig?.cargoFantasmaId) {
      permissionOverwrites.push({
        id: guildConfig.cargoFantasmaId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
        deny: [PermissionFlagsBits.Speak] // Opcional: fantasma apenas observa
      });
    }

    if (!textChannel) {
      textChannel = await guild.channels.create({
        name: `chat-${baseName}`,
        type: ChannelType.GuildText,
        parent: catId,
        permissionOverwrites,
        topic: `Canal VIP de ${member.user.tag}`,
      });
    } else {
      // Atualiza permissões se o canal já existir (para incluir novos fantasmas)
      await textChannel.edit({ permissionOverwrites }).catch(() => {});
    }

    if (!voiceChannel) {
      voiceChannel = await guild.channels.create({
        name: `Call ${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: catId,
        permissionOverwrites,
      });
    } else {
      await voiceChannel.edit({ permissionOverwrites }).catch(() => {});
    }

    if (textChannel.id !== settings.textChannelId || voiceChannel.id !== settings.voiceChannelId) {
      await vipService.setSettings(guild.id, userId, {
        textChannelId: textChannel.id,
        voiceChannelId: voiceChannel.id,
      });
    }

    return { ok: true, textChannel, voiceChannel };
  }

  // ... (Funções deleteVipChannels e archiveVipChannels permanecem as mesmas que você enviou)

  async function deleteVipChannels(userId, { guildId: targetGuildId } = {}) {
    const guild = await fetchGuild(targetGuildId);
    if (!guild) return { ok: false };
    const settings = vipService.getSettings(guild.id, userId) || {};
    if (settings.textChannelId) {
      const c = await guild.channels.fetch(settings.textChannelId).catch(() => null);
      if (c) await c.delete().catch(() => {});
    }
    if (settings.voiceChannelId) {
      const c = await guild.channels.fetch(settings.voiceChannelId).catch(() => null);
      if (c) await c.delete().catch(() => {});
    }
    await vipService.setSettings(guild.id, userId, { textChannelId: null, voiceChannelId: null });
    return { ok: true };
  }

  async function archiveVipChannels(userId, { guildId: targetGuildId } = {}) {
    const guild = await fetchGuild(targetGuildId);
    if (!guild) return { ok: false, reason: "guild_unavailable" };
    const settings = vipService.getSettings(guild.id, userId) || {};
    let textChannel = settings.textChannelId ? await guild.channels.fetch(settings.textChannelId).catch(() => null) : null;
    let voiceChannel = settings.voiceChannelId ? await guild.channels.fetch(settings.voiceChannelId).catch(() => null) : null;
    if (!textChannel && !voiceChannel) return { ok: false, reason: "no_channels" };

    const config = vipService.getGuildConfig(guild.id) || {};
    let archiveCategory = config.vipArchiveCategoryId ? await guild.channels.fetch(config.vipArchiveCategoryId).catch(() => null) : null;

    if (!archiveCategory) {
      archiveCategory = await guild.channels.create({
        name: "📦｜Arquivo VIP",
        type: ChannelType.GuildCategory,
      }).catch(() => null);
      if (archiveCategory) await vipService.setGuildConfig(guild.id, { vipArchiveCategoryId: archiveCategory.id });
    }

    const archive = async (channel) => {
      if (!channel) return;
      await channel.edit({
        name: `arq-${channel.name.slice(0, 90)}`,
        parent: archiveCategory?.id || null,
      }).catch(() => {});
      await channel.permissionOverwrites.edit(userId, { [PermissionFlagsBits.ViewChannel]: false }).catch(() => {});
    };

    await archive(textChannel);
    await archive(voiceChannel);
    await vipService.setSettings(guild.id, userId, { textChannelId: null, voiceChannelId: null });
    return { ok: true };
  }

  async function updateChannelPermissions(userId, { guildId: targetGuildId, targetUserId, allow } = {}) {
    const guild = await fetchGuild(targetGuildId);
    if (!guild) return { ok: false };
    const settings = vipService.getSettings(guild.id, userId) || {};
    const channels = [settings.textChannelId, settings.voiceChannelId];
    for (const id of channels) {
      if (!id) continue;
      const ch = await guild.channels.fetch(id).catch(() => null);
      if (ch) await ch.permissionOverwrites.edit(targetUserId, allow ? { [PermissionFlagsBits.ViewChannel]: true, [PermissionFlagsBits.Connect]: true } : { [PermissionFlagsBits.ViewChannel]: false });
    }
    return { ok: true };
  }

  async function updateChannelName(userId, newName, { guildId: targetGuildId, type = "both" } = {}) {
    const guild = await fetchGuild(targetGuildId);
    if (!guild) return { ok: false };
    const settings = vipService.getSettings(guild.id, userId) || {};
    if (type !== "voice" && settings.textChannelId) {
      const ch = await guild.channels.fetch(settings.textChannelId).catch(() => null);
      if (ch) await ch.setName(newName.toLowerCase().replace(/\s+/g, '-')).catch(() => {});
    }
    if (type !== "text" && settings.voiceChannelId) {
      const ch = await guild.channels.fetch(settings.voiceChannelId).catch(() => null);
      if (ch) await ch.setName(newName).catch(() => {});
    }
    return { ok: true };
  }

  return { ensureVipChannels, deleteVipChannels, archiveVipChannels, updateChannelPermissions, updateChannelName };
}

module.exports = { createVipChannelManager };
