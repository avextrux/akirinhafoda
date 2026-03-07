const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");
const { createDataStore } = require("../store/dataStore");
const { getGuildConfig } = require("../config/guildConfig");

const familyStore = createDataStore("families.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("family")
    .setDescription("Sistema de Família VIP")
    .addSubcommandGroup((group) =>
        group
            .setName("manage")
            .setDescription("Gerencie sua família")
            .addSubcommand((sub) => sub.setName("create").setDescription("Cria uma nova família (Requer VIP)").addStringOption(opt => opt.setName("nome").setDescription("Nome da família").setRequired(true)))
            .addSubcommand((sub) => sub.setName("delete").setDescription("Deleta sua família"))
            .addSubcommand((sub) => sub.setName("invite").setDescription("Convida um membro para a família").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a convidar").setRequired(true)))
            .addSubcommand((sub) => sub.setName("kick").setDescription("Remove um membro da família").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a remover").setRequired(true)))
            .addSubcommand((sub) => sub.setName("leave").setDescription("Sai da família atual"))
            .addSubcommand((sub) => sub.setName("info").setDescription("Mostra informações da família"))
            .addSubcommand((sub) => sub.setName("promote").setDescription("Promove um membro a admin da família").addUserOption(opt => opt.setName("usuario").setDescription("Membro a promover").setRequired(true)))
            .addSubcommand((sub) => sub.setName("demote").setDescription("Rebaixa um admin da família").addUserOption(opt => opt.setName("usuario").setDescription("Admin a rebaixar").setRequired(true)))
    )
    .addSubcommandGroup((group) =>
        group
            .setName("config")
            .setDescription("Personaliza sua família")
            .addSubcommand((sub) => sub.setName("rename").setDescription("Renomeia a família").addStringOption(opt => opt.setName("novo_nome").setDescription("Novo nome").setRequired(true)))
            .addSubcommand((sub) => sub.setName("color").setDescription("Altera a cor do cargo").addStringOption(opt => opt.setName("cor").setDescription("Cor Hex (ex: #FF0000)").setRequired(true)))
            .addSubcommand((sub) => sub.setName("decorate").setDescription("Decora os canais com templates"))
    )
    .addSubcommandGroup((group) =>
        group.setName("bank").setDescription("Banco da Família")
            .addSubcommand(sub => sub.setName("deposit").setDescription("Deposita moedas").addIntegerOption(opt => opt.setName("quantia").setDescription("Valor").setMinValue(1).setRequired(true)))
            .addSubcommand(sub => sub.setName("withdraw").setDescription("Saca moedas (Dono/Admin)").addIntegerOption(opt => opt.setName("quantia").setDescription("Valor").setMinValue(1).setRequired(true)))
            .addSubcommand(sub => sub.setName("balance").setDescription("Ver saldo"))
    )
    .addSubcommandGroup((group) =>
        group.setName("info").setDescription("Informações e utilidades")
            .addSubcommand((sub) => sub.setName("list").setDescription("Lista o ranking das maiores famílias"))
            .addSubcommand((sub) => sub.setName("transfer").setDescription("Transfere a liderança da família").addUserOption(opt => opt.setName("novo_lider").setDescription("Novo dono").setRequired(true)))
            .addSubcommand((sub) => sub.setName("upgrade").setDescription("Compra slot extra de membro"))
            .addSubcommand((sub) => sub.setName("panel").setDescription("Abre o painel de controle da família"))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const families = await familyStore.load();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const economyService = interaction.client.services?.economy;

    if (group === "manage") {
      if (sub === "create") {
        const name = interaction.options.getString("nome");

        // Bug fix: verificação real de VIP via vipService
        const vipService = interaction.client.services?.vip;
        const tier = vipService ? await vipService.getMemberTier(interaction.member) : null;
        const tierConfig = tier ? await vipService.getTierConfig(guildId, tier.id) : null;
        const maxVagasFamilia = tierConfig?.vagas_familia ?? (tier ? 1 : 0);
        if (!tier || maxVagasFamilia < 1) {
          return interaction.reply({ embeds: [createErrorEmbed("Apenas membros VIP com permissão de família podem criar famílias!")], ephemeral: true });
        }

        const existingFamily = Object.values(families).find(f => f.ownerId === userId);
        if (existingFamily) {
          return interaction.reply({ embeds: [createErrorEmbed("Você já tem uma família! Use `/family manage delete` para deletá-la primeiro.")], ephemeral: true });
        }

        const nameExists = Object.values(families).find(f => f.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          return interaction.reply({ embeds: [createErrorEmbed(`Já existe uma família com o nome **${name}**!`)], ephemeral: true });
        }

        await interaction.deferReply();

        const gConfig = vipService.getGuildConfig(guildId);
        const familyCategoryId = gConfig?.familyCategoryId || null;

        const familyId = `family_${Date.now()}_${userId}`;

        // Cria cargo da família no Discord
        let roleId = null;
        try {
          const role = await interaction.guild.roles.create({ name: `🏠 ${name}`, reason: "Criação de família VIP" });
          roleId = role.id;
          await interaction.member.roles.add(role).catch(() => {});
        } catch (e) {}

        // Cria canal de texto da família
        let channelId = null;
        try {
          const ch = await interaction.guild.channels.create({
            name: `🏠-${name.toLowerCase().replace(/\s+/g, "-")}`,
            type: 0, // GuildText
            parent: familyCategoryId,
            permissionOverwrites: [
              { id: interaction.guild.id, deny: ["ViewChannel"] },
              ...(roleId ? [{ id: roleId, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }] : []),
              { id: interaction.client.user.id, allow: ["ViewChannel", "ManageChannels"] }
            ]
          });
          channelId = ch.id;
        } catch (e) {}

        const newFamily = {
          id: familyId,
          name,
          ownerId: userId,
          members: [userId],
          admins: [userId],
          maxMembers: maxVagasFamilia,
          createdAt: Date.now(),
          roleId,
          channelId,
          bankBalance: 0
        };

        await familyStore.update(familyId, () => newFamily);

        return interaction.editReply({ embeds: [createSuccessEmbed(`✅ Família **${name}** criada com sucesso!\n\n👑 Dono: <@${userId}>\n👥 Membros: 1/${maxVagasFamilia}\n\nUse \`/family config\` para personalizar sua família.`)] });
      }

      if (sub === "delete") {
        const family = Object.values(families).find(f => f.ownerId === userId);
        if (!family) {
          return interaction.reply({ embeds: [createErrorEmbed("Você não tem uma família para deletar!")], ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // Remove cargo de todos os membros e deleta o cargo
        if (family.roleId) {
          for (const memberId of family.members) {
            try {
              const member = await interaction.guild.members.fetch(memberId).catch(() => null);
              if (member) await member.roles.remove(family.roleId).catch(() => {});
            } catch (e) {}
          }
          const role = await interaction.guild.roles.fetch(family.roleId).catch(() => null);
          if (role) await role.delete().catch(() => {});
        }

        if (family.channelId) {
          const channel = await interaction.guild.channels.fetch(family.channelId).catch(() => null);
          if (channel) await channel.delete().catch(() => {});
        }

        await familyStore.update(family.id, () => null);

        return interaction.editReply({ embeds: [createSuccessEmbed(`✅ Família **${family.name}** deletada com sucesso!`)] });
      }

      if (sub === "info") {
        const family = Object.values(families).find(f => f.members.includes(userId));
        if (!family) {
          return interaction.reply({ embeds: [createErrorEmbed("Você não está em nenhuma família!")], ephemeral: true });
        }

        const isOwner = family.ownerId === userId;
        const isAdmin = family.admins.includes(userId);
        const memberCount = family.members.length;

        const embed = createEmbed({
          title: `🏠 ${family.name}`,
          description: isOwner ? "👑 Você é o dono desta família" : isAdmin ? "⭐ Você é um admin desta família" : "👤 Você é um membro desta família",
          color: isOwner ? 0xffd700 : isAdmin ? 0x00ff00 : 0x0099ff,
          fields: [
            { name: "👑 Dono", value: `<@${family.ownerId}>`, inline: true },
            { name: "👥 Membros", value: `${memberCount}/${family.maxMembers}`, inline: true },
            { name: "📅 Criada em", value: `<t:${Math.floor(family.createdAt / 1000)}:d>`, inline: true },
            { name: "⭐ Admins", value: family.admins.map(id => `<@${id}>`).join(", ") || "Nenhum", inline: false }
          ],
          footer: { text: "WDA - Todos os direitos reservados" }
        });

        return interaction.reply({ embeds: [embed] });
      }

      if (sub === "leave") {
        const family = Object.values(families).find(f => f.members.includes(userId));
        if (!family) {
          return interaction.reply({ embeds: [createErrorEmbed("Você não está em nenhuma família!")], ephemeral: true });
        }

        if (family.ownerId === userId) {
          return interaction.reply({ embeds: [createErrorEmbed("Você é o dono da família! Use `/family manage delete` para deletá-la ou transfira a liderança primeiro.")], ephemeral: true });
        }

        const updatedMembers = family.members.filter(id => id !== userId);
        const updatedAdmins = family.admins.filter(id => id !== userId);

        await familyStore.update(family.id, () => ({ ...family, members: updatedMembers, admins: updatedAdmins }));

        if (family.roleId) {
          try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) await member.roles.remove(family.roleId).catch(() => {});
          } catch (e) {}
        }

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ Você saiu da família **${family.name}**!`)] });
      }

      if (sub === "invite") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId || f.admins.includes(userId));
        
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Você não tem uma família para convidar membros!")], ephemeral: true });
        if (!family.admins.includes(userId) && family.ownerId !== userId) return interaction.reply({ embeds: [createErrorEmbed("Apenas donos e admins podem convidar membros!")], ephemeral: true });
        if (family.members.length >= family.maxMembers) return interaction.reply({ embeds: [createErrorEmbed(`A família já atingiu o limite de **${family.maxMembers}** membros!`)], ephemeral: true });
        if (family.members.includes(targetUser.id)) return interaction.reply({ embeds: [createErrorEmbed("Este usuário já está na família!")], ephemeral: true });

        await familyStore.update(family.id, () => ({ ...family, members: [...family.members, targetUser.id] }));

        if (family.roleId) {
          try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (member) await member.roles.add(family.roleId).catch(() => {});
          } catch (e) {}
        }

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi convidado para **${family.name}**!\n\n👥 Membros: ${family.members.length + 1}/${family.maxMembers}`)] });
      }

      if (sub === "kick") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId || f.admins.includes(userId));
        
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Você não tem uma família para remover membros!")], ephemeral: true });
        if (!family.admins.includes(userId) && family.ownerId !== userId) return interaction.reply({ embeds: [createErrorEmbed("Apenas donos e admins podem remover membros!")], ephemeral: true });
        if (targetUser.id === family.ownerId) return interaction.reply({ embeds: [createErrorEmbed("Você não pode remover o dono da família!")], ephemeral: true });
        if (!family.members.includes(targetUser.id)) return interaction.reply({ embeds: [createErrorEmbed("Este usuário não está na família!")], ephemeral: true });

        const updatedMembers = family.members.filter(id => id !== targetUser.id);
        const updatedAdmins = family.admins.filter(id => id !== targetUser.id);

        await familyStore.update(family.id, () => ({ ...family, members: updatedMembers, admins: updatedAdmins }));

        if (family.roleId) {
          try {
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            if (member) await member.roles.remove(family.roleId).catch(() => {});
          } catch (e) {}
        }

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi removido de **${family.name}**!`)] });
      }

      if (sub === "promote") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Apenas o dono pode promover membros!")], ephemeral: true });
        if (!family.members.includes(targetUser.id)) return interaction.reply({ embeds: [createErrorEmbed("Este usuário não está na família!")], ephemeral: true });
        if (family.admins.includes(targetUser.id)) return interaction.reply({ embeds: [createErrorEmbed("Este usuário já é admin da família!")], ephemeral: true });

        await familyStore.update(family.id, () => ({ ...family, admins: [...family.admins, targetUser.id] }));
        return interaction.reply({ embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi promovido a admin de **${family.name}**!`)] });
      }

      if (sub === "demote") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Apenas o dono pode rebaixar admins!")], ephemeral: true });
        if (!family.admins.includes(targetUser.id)) return interaction.reply({ embeds: [createErrorEmbed("Este usuário não é admin da família!")], ephemeral: true });
        if (targetUser.id === family.ownerId) return interaction.reply({ embeds: [createErrorEmbed("Você não pode rebaixar a si mesmo!")], ephemeral: true });

        const updatedAdmins = family.admins.filter(id => id !== targetUser.id);
        await familyStore.update(family.id, () => ({ ...family, admins: updatedAdmins }));

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi rebaixado de admin de **${family.name}**!`)] });
      }
    }

    if (group === "config") {
      const family = Object.values(families).find(f => f.ownerId === userId);
      if (!family) return interaction.reply({ embeds: [createErrorEmbed("Apenas o dono pode configurar a família!")], ephemeral: true });

      if (sub === "rename") {
        const newName = interaction.options.getString("novo_nome");
        const nameExists = Object.values(families).find(f => f.name.toLowerCase() === newName.toLowerCase() && f.id !== family.id);
        if (nameExists) return interaction.reply({ embeds: [createErrorEmbed(`Já existe uma família com o nome **${newName}**!`)], ephemeral: true });

        await familyStore.update(family.id, () => ({ ...family, name: newName }));

        // Bug fix: renomeia o cargo e canal no Discord também
        if (family.roleId) {
          const role = await interaction.guild.roles.fetch(family.roleId).catch(() => null);
          if (role) await role.setName(`🏠 ${newName}`).catch(() => {});
        }
        if (family.channelId) {
          const channel = await interaction.guild.channels.fetch(family.channelId).catch(() => null);
          if (channel) await channel.setName(`🏠-${newName.toLowerCase().replace(/\s+/g, "-")}`).catch(() => {});
        }

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ Família renomeada para **${newName}**!`)] });
      }

      if (sub === "color") {
        const color = interaction.options.getString("cor");
        if (!/^#[0-9A-F]{6}$/i.test(color)) return interaction.reply({ embeds: [createErrorEmbed("Cor inválida! Use formato hex: #FF0000")], ephemeral: true });

        await familyStore.update(family.id, () => ({ ...family, color }));

        // Bug fix: aplica a cor no cargo do Discord também
        if (family.roleId) {
          const role = await interaction.guild.roles.fetch(family.roleId).catch(() => null);
          if (role) await role.setColor(parseInt(color.replace("#", ""), 16)).catch(() => {});
        }

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ Cor da família alterada para **${color}**!`)] });
      }

      if (sub === "decorate") {
        return interaction.reply({ embeds: [createEmbed({ title: "🎨 Decoração de Canais", description: "Sistema de decoração em desenvolvimento!", color: 0x0099ff })] });
      }
    }

    if (group === "bank") {
      const family = Object.values(families).find(f => f.members.includes(userId));
      if (!family) return interaction.reply({ embeds: [createErrorEmbed("Você não está em nenhuma família!")], ephemeral: true });

      if (sub === "deposit") {
        const amount = interaction.options.getInteger("quantia");
        if (!economyService) return interaction.reply({ embeds: [createErrorEmbed("Serviço de economia não disponível!")], ephemeral: true });

        const userBalance = await economyService.getBalance(guildId, userId);
        if (userBalance.coins < amount) return interaction.reply({ embeds: [createErrorEmbed(`Você não tem **${amount}** moedas!`)], ephemeral: true });

        await economyService.removeCoins(guildId, userId, amount);
        const currentBalance = family.bankBalance || 0;
        await familyStore.update(family.id, () => ({ ...family, bankBalance: currentBalance + amount }));

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ **${amount}** moedas depositadas no banco da família!\n\n🏦 Saldo do banco: **${currentBalance + amount}** moedas`)] });
      }

      if (sub === "withdraw") {
        const amount = interaction.options.getInteger("quantia");
        const currentBalance = family.bankBalance || 0;
        
        if (currentBalance < amount) return interaction.reply({ embeds: [createErrorEmbed(`O banco não tem **${amount}** moedas! Saldo atual: **${currentBalance}**`)], ephemeral: true });
        if (!family.admins.includes(userId) && family.ownerId !== userId) return interaction.reply({ embeds: [createErrorEmbed("Apenas admins e o dono podem sacar do banco!")], ephemeral: true });

        await familyStore.update(family.id, () => ({ ...family, bankBalance: currentBalance - amount }));
        if (economyService) await economyService.addCoins(guildId, userId, amount);

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ **${amount}** moedas sacadas!\n\n🏦 Saldo do banco: **${currentBalance - amount}** moedas`)] });
      }

      if (sub === "balance") {
        const balance = family.bankBalance || 0;
        return interaction.reply({ embeds: [createEmbed({ title: `🏦 Banco da ${family.name}`, description: `Saldo atual: **${balance}** moedas`, color: 0x00ff00 })] });
      }
    }

    if (group === "info") {
      if (sub === "list") {
        const sortedFamilies = Object.values(families).sort((a, b) => b.members.length - a.members.length).slice(0, 10);
        if (sortedFamilies.length === 0) return interaction.reply({ embeds: [createEmbed({ title: "🏠 Ranking de Famílias", description: "Nenhuma família encontrada!", color: 0xff0000 })] });

        const fields = sortedFamilies.map((family, index) => ({ name: `${index + 1}. ${family.name}`, value: `👥 ${family.members.length}/${family.maxMembers} membros\n👑 Dono: <@${family.ownerId}>`, inline: false }));
        return interaction.reply({ embeds: [createEmbed({ title: "🏠 Ranking de Famílias", description: "Top 10 famílias com mais membros", color: 0x0099ff, fields })] });
      }

      if (sub === "transfer") {
        const newLeader = interaction.options.getUser("novo_lider");
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Você não é dono de nenhuma família!")], ephemeral: true });
        if (!family.members.includes(newLeader.id)) return interaction.reply({ embeds: [createErrorEmbed("O usuário não está na sua família!")], ephemeral: true });

        await familyStore.update(family.id, () => ({ ...family, ownerId: newLeader.id, admins: [newLeader.id, ...family.admins.filter(id => id !== newLeader.id)] }));
        return interaction.reply({ embeds: [createSuccessEmbed(`✅ Liderança de **${family.name}** transferida para **${newLeader.username}**!`)] });
      }

      if (sub === "upgrade") {
        const family = Object.values(families).find(f => f.ownerId === userId);
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Apenas o dono pode comprar slots!")], ephemeral: true });

        const upgradeCost = 5000; 
        if (!economyService) return interaction.reply({ embeds: [createErrorEmbed("Serviço de economia não disponível!")], ephemeral: true });

        const userBalance = await economyService.getBalance(guildId, userId);
        if (userBalance.coins < upgradeCost) return interaction.reply({ embeds: [createErrorEmbed(`Você precisa de **${upgradeCost}** moedas! Saldo atual: **${userBalance.coins}**`)], ephemeral: true });

        await economyService.removeCoins(guildId, userId, upgradeCost);
        const newMax = family.maxMembers + 1;
        await familyStore.update(family.id, () => ({ ...family, maxMembers: newMax }));

        return interaction.reply({ embeds: [createSuccessEmbed(`✅ Slot extra comprado!\n\n💸 Custo: **${upgradeCost}** moedas\n👥 Novo limite: **${newMax}** membros`)] });
      }

      if (sub === "panel") {
        const family = Object.values(families).find(f => f.members.includes(userId));
        if (!family) return interaction.reply({ embeds: [createErrorEmbed("Você não está em nenhuma família!")], ephemeral: true });

        const isOwner = family.ownerId === userId;
        const isAdmin = family.admins.includes(userId);

        const embed = createEmbed({
          title: `🏠 Painel da ${family.name}`,
          description: isOwner ? "👑 Você é o dono" : isAdmin ? "⭐ Você é admin" : "👤 Você é membro",
          color: isOwner ? 0xffd700 : isAdmin ? 0x00ff00 : 0x0099ff,
          fields: [
            { name: "👥 Membros", value: `${family.members.length}/${family.maxMembers}`, inline: true },
            { name: "🏦 Banco", value: `${family.bankBalance || 0} moedas`, inline: true },
            { name: "📅 Criada", value: `<t:${Math.floor(family.createdAt / 1000)}:d>`, inline: true }
          ]
        });

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("family_btn_info").setLabel("Informações").setStyle(ButtonStyle.Primary).setEmoji("ℹ️"),
          new ButtonBuilder().setCustomId("family_btn_invite_menu").setLabel("Convidar").setStyle(ButtonStyle.Success).setEmoji("📩")
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("family_btn_leave").setLabel("Sair").setStyle(ButtonStyle.Danger).setEmoji("🚪")
        );

        await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
      }
    }
  },

  // HANDLERS SEPARADOS CORRETAMENTE
  async handleButton(interaction) {
    const id = interaction.customId;
    
    if (id === "family_btn_leave") {
      return interaction.reply({ embeds: [createErrorEmbed("Ação de sair da família ainda não implementada pelo painel. Use o comando /family manage leave.")], ephemeral: true });
    }

    if (id === "family_btn_info") {
      return interaction.reply({ content: "Painel informativo. Use os comandos slash para mais detalhes.", ephemeral: true });
    }

    if (id === "family_btn_invite_menu") {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId("family_invite_user")
        .setPlaceholder("Selecione o usuário")
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(userSelect);
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("family_btn_cancel").setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ content: "Selecione o usuário para convidar:", components: [row, actionRow], ephemeral: true });
    }

    if (id === "family_btn_cancel") {
      await interaction.update({ content: "❌ Ação cancelada.", components: [], embeds: [] });
    }
  },

  async handleUserSelectMenu(interaction) {
    if (interaction.customId === "family_invite_user") {
      const userId = interaction.user.id;
      const selectedUser = interaction.users.first();
      const families = await familyStore.load();
      
      if (!selectedUser) return interaction.reply({ content: "❌ Nenhum usuário selecionado.", ephemeral: true });
      if (selectedUser.bot) return interaction.reply({ content: "❌ Você não pode convidar bots para a família.", ephemeral: true });
      if (selectedUser.id === userId) return interaction.reply({ content: "❌ Você não pode convidar a si mesmo.", ephemeral: true });

      const userFamily = Object.values(families).find(f => f.members.includes(selectedUser.id));
      if (userFamily) return interaction.reply({ content: `❌ ${selectedUser.username} já está na família **${userFamily.name}**.`, ephemeral: true });

      const myFamily = Object.values(families).find(f => f.ownerId === userId);
      if (!myFamily) return interaction.reply({ content: "❌ Você não tem uma família para convidar membros.", ephemeral: true });
      if (myFamily.members.length >= myFamily.maxMembers) return interaction.reply({ content: `❌ Sua família já atingiu o limite de **${myFamily.maxMembers}** membros.`, ephemeral: true });

      await familyStore.update(myFamily.id, () => ({ ...myFamily, members: [...myFamily.members, selectedUser.id] }));

      if (myFamily.roleId) {
        try {
          const member = await interaction.guild.members.fetch(selectedUser.id);
          await member.roles.add(myFamily.roleId);
        } catch (error) {}
      }

      await interaction.update({ content: `✅ **${selectedUser.username}** foi convidado!`, components: [] });
      
      try {
        const member = await interaction.guild.members.fetch(selectedUser.id);
        await member.send({ embeds: [createEmbed({ title: "🎉 Convite para Família", description: `Você foi convidado para a família **${myFamily.name}** por **${interaction.user.username}**!`, color: 0x00ff00 })] });
      } catch (error) {}
    }
  },

  async handleModal(interaction) {
    if (interaction.customId === "family_invite_modal") {
      await interaction.reply({ content: "❌ Este modal foi descontinuado. Use o novo sistema de convite por menu.", ephemeral: true });
    }
  }
};