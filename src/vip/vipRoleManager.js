module.exports = {
  createVipRoleManager({ client, vipService }) {
    return {
      async updatePersonalRole(userId, { roleName, roleColor }, { guildId }) {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        const tier = await vipService.getMemberTier(member);

        if (!tier?.hasCustomRole) return { ok: false };

        const settings = vipService.getSettings(guildId, userId);
        const gConf = vipService.getGuildConfig(guildId);
        let role = settings.roleId ? await guild.roles.fetch(settings.roleId).catch(() => null) : null;

        if (!role) {
          role = await guild.roles.create({
            name: roleName || `VIP | ${member.user.username}`,
            color: roleColor || 0
          });
          if (gConf.separatorId) {
            const sep = await guild.roles.fetch(gConf.separatorId);
            if (sep) await role.setPosition(sep.position - 1).catch(() => {});
          }
        } else {
          if (roleName) await role.setName(roleName);
          if (roleColor) await role.setColor(roleColor).catch(() => {});
        }

        await member.roles.add(role);
        await vipService.setSettings(guildId, userId, { roleId: role.id });
        return { ok: true };
      },

      async deletePersonalRole(userId, { guildId }) {
        const guild = await client.guilds.fetch(guildId);
        const settings = vipService.getSettings(guildId, userId);
        if (settings?.roleId) {
          const role = await guild.roles.fetch(settings.roleId).catch(() => null);
          if (role) await role.delete().catch(() => {});
        }
        return { ok: true };
      }
    };
  }
};