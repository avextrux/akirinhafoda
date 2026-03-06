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
            .addSubcommand((sub) =>
                sub.setName("create").setDescription("Cria uma nova família (Requer VIP)").addStringOption(opt => opt.setName("nome").setDescription("Nome da família").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("delete").setDescription("Deleta sua família")
            )
            .addSubcommand((sub) =>
                sub.setName("invite").setDescription("Convida um membro para a família").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a convidar").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("kick").setDescription("Remove um membro da família").addUserOption(opt => opt.setName("usuario").setDescription("Usuário a remover").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("leave").setDescription("Sai da família atual")
            )
            .addSubcommand((sub) =>
                sub.setName("info").setDescription("Mostra informações da família")
            )
            .addSubcommand((sub) =>
                sub.setName("promote").setDescription("Promove um membro a admin da família").addUserOption(opt => opt.setName("usuario").setDescription("Membro a promover").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("demote").setDescription("Rebaixa um admin da família").addUserOption(opt => opt.setName("usuario").setDescription("Admin a rebaixar").setRequired(true))
            )
    )
    .addSubcommandGroup((group) =>
        group
            .setName("config")
            .setDescription("Personaliza sua família")
            .addSubcommand((sub) =>
                sub.setName("rename").setDescription("Renomeia a família").addStringOption(opt => opt.setName("novo_nome").setDescription("Novo nome").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("color").setDescription("Altera a cor do cargo").addStringOption(opt => opt.setName("cor").setDescription("Cor Hex (ex: #FF0000)").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("decorate").setDescription("Decora os canais com templates")
            )
    )
    .addSubcommandGroup((group) =>
        group.setName("bank").setDescription("Banco da Família")
            .addSubcommand(sub => sub.setName("deposit").setDescription("Deposita moedas").addIntegerOption(opt => opt.setName("quantia").setDescription("Valor").setMinValue(1).setRequired(true)))
            .addSubcommand(sub => sub.setName("withdraw").setDescription("Saca moedas (Dono/Admin)").addIntegerOption(opt => opt.setName("quantia").setDescription("Valor").setMinValue(1).setRequired(true)))
            .addSubcommand(sub => sub.setName("balance").setDescription("Ver saldo"))
    )
    .addSubcommandGroup((group) =>
        group.setName("info").setDescription("Informações e utilidades")
            .addSubcommand((sub) =>
                sub.setName("list").setDescription("Lista o ranking das maiores famílias")
            )
            .addSubcommand((sub) =>
                sub.setName("transfer").setDescription("Transfere a liderança da família").addUserOption(opt => opt.setName("novo_lider").setDescription("Novo dono").setRequired(true))
            )
            .addSubcommand((sub) =>
                sub.setName("upgrade").setDescription("Compra slot extra de membro")
            )
            .addSubcommand((sub) =>
                sub.setName("panel").setDescription("Abre o painel de controle da família")
            )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const families = await familyStore.load();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const economyService = interaction.client.services.economy;

    // Handler para botões
    if (interaction.isButton()) {
      const id = interaction.customId;
      
      if (!id.startsWith("family_btn_")) return;

      // Painel ainda não está totalmente implementado: garantir resposta para não dar Interaction Failed
      if (id === "family_btn_leave") {
        return interaction.reply({ embeds: [createErrorEmbed("Ação de sair da família ainda não implementada pelo painel. Use o comando /family leave.")], ephemeral: true });
      }

      if (id === "family_btn_invite_menu") {
        const modal = new ModalBuilder()
          .setCustomId("family_invite_modal")
          .setTitle("Convidar para Família");

        const userSelect = new UserSelectMenuBuilder()
          .setCustomId("family_invite_user")
          .setPlaceholder("Selecione o usuário")
          .setMinValues(1)
          .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(userSelect);
        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("family_btn_cancel").setLabel("Cancelar").setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ content: "Selecione o usuário para convidar:", components: [row, actionRow] });
      }

      if (id === "family_btn_cancel") {
        await interaction.update({ content: "❌ Ação cancelada.", components: [], embeds: [], ephemeral: true });
      }
    }

    // Handler para User Select Menu
    if (interaction.isUserSelectMenu() && interaction.customId === "family_invite_user") {
      const selectedUser = interaction.users.first();
      
      if (!selectedUser) {
        return interaction.reply({ content: "❌ Nenhum usuário selecionado.", ephemeral: true });
      }

      if (selectedUser.bot) {
        return interaction.reply({ content: "❌ Você não pode convidar bots para a família.", ephemeral: true });
      }

      if (selectedUser.id === userId) {
        return interaction.reply({ content: "❌ Você não pode convidar a si mesmo.", ephemeral: true });
      }

      // Verificar se já está em alguma família
      const userFamily = Object.values(families).find(f => f.members.includes(selectedUser.id));
      if (userFamily) {
        return interaction.reply({ content: `❌ ${selectedUser.username} já está na família **${userFamily.name}**.`, ephemeral: true });
      }

      // Verificar se o usuário tem uma família
      const myFamily = Object.values(families).find(f => f.ownerId === userId);
      if (!myFamily) {
        return interaction.reply({ content: "❌ Você não tem uma família para convidar membros.", ephemeral: true });
      }

      // Verificar se há vagas disponíveis
      if (myFamily.members.length >= myFamily.maxMembers) {
        return interaction.reply({ content: `❌ Sua família já atingiu o limite de **${myFamily.maxMembers}** membros.`, ephemeral: true });
      }

      // Adicionar membro à família
      await familyStore.update(myFamily.id, {
        ...myFamily,
        members: [...myFamily.members, selectedUser.id]
      });

      // Dar cargo da família (se existir)
      if (myFamily.roleId) {
        try {
          const member = await interaction.guild.members.fetch(selectedUser.id);
          await member.roles.add(myFamily.roleId);
        } catch (error) {
          console.log("Não foi possível dar o cargo da família:", error.message);
        }
      }

      await interaction.reply({
        embeds: [createSuccessEmbed(
          `✅ **${selectedUser.username}** foi convidado para a família **${myFamily.name}**!\n\n` +
          `Membros: ${myFamily.members.length + 1}/${myFamily.maxMembers}`
        )]
      });

      // Notificar o usuário convidado
      try {
        const member = await interaction.guild.members.fetch(selectedUser.id);
        await member.send({
          embeds: [createEmbed({
            title: "🎉 Convite para Família",
            description: `Você foi convidado para joining a família **${myFamily.name}** por **${interaction.user.username}**!\n\n` +
            `Use \`/family manage info\` para ver mais detalhes.`,
            color: 0x00ff00,
            footer: { text: "WDA - Todos os direitos reservados" }
          })]
        });
      } catch (error) {
        console.log("Não foi possível notificar o usuário:", error.message);
      }
    }

    // Handler para Modal
    if (interaction.isModalSubmit() && interaction.customId === "family_invite_modal") {
      await interaction.reply({ content: "❌ Este modal foi descontinuado. Use o novo sistema de convite por botão.", ephemeral: true });
    }

    // Comandos de subgrupo
    if (group === "manage") {
      if (sub === "create") {
        const name = interaction.options.getString("nome");
        
        // Verificar se já tem família
        const existingFamily = Object.values(families).find(f => f.ownerId === userId);
        if (existingFamily) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você já tem uma família! Use `/family manage delete` para deletá-la primeiro.")],
            ephemeral: true
          });
        }

        // Verificar se o nome já existe
        const nameExists = Object.values(families).find(f => f.name.toLowerCase() === name.toLowerCase());
        if (nameExists) {
          return interaction.reply({
            embeds: [createErrorEmbed(`Já existe uma família com o nome **${name}**!`)],
            ephemeral: true
          });
        }

        // Verificar se é VIP (implementar verificação VIP)
        const isVip = true; // Temporário - implementar verificação real

        if (!isVip) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas membros VIP podem criar famílias!")],
            ephemeral: true
          });
        }

        // Criar família
        const familyId = `family_${Date.now()}_${userId}`;
        const newFamily = {
          id: familyId,
          name: name,
          ownerId: userId,
          members: [userId],
          admins: [userId],
          maxMembers: 10,
          createdAt: Date.now(),
          roleId: null,
          channelId: null
        };

        await familyStore.update(familyId, newFamily);

        return interaction.reply({
          embeds: [createSuccessEmbed(
            `✅ Família **${name}** criada com sucesso!\n\n` +
            `👑 Dono: <@${userId}>\n` +
            `👥 Membros: 1/10\n\n` +
            `Use \`/family config\` para personalizar sua família.`
          )]
        });
      }

      if (sub === "delete") {
        const family = Object.values(families).find(f => f.ownerId === userId);
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não tem uma família para deletar!")],
            ephemeral: true
          });
        }

        // Remover cargo dos membros
        if (family.roleId) {
          for (const memberId of family.members) {
            try {
              const member = await interaction.guild.members.fetch(memberId);
              await member.roles.remove(family.roleId);
            } catch (error) {
              console.log("Não foi possível remover o cargo:", error.message);
            }
          }
        }

        // Deletar canal (se existir)
        if (family.channelId) {
          try {
            const channel = await interaction.guild.channels.fetch(family.channelId);
            if (channel) await channel.delete();
          } catch (error) {
            console.log("Não foi possível deletar o canal:", error.message);
          }
        }

        // Deletar família
        await familyStore.delete(family.id);

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ Família **${family.name}** deletada com sucesso!`)]
        });
      }

      if (sub === "info") {
        const family = Object.values(families).find(f => f.members.includes(userId));
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não está em nenhuma família!")],
            ephemeral: true
          });
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
          return interaction.reply({
            embeds: [createErrorEmbed("Você não está em nenhuma família!")],
            ephemeral: true
          });
        }

        if (family.ownerId === userId) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você é o dono da família! Use `/family manage delete` para deletá-la ou transfira a liderança primeiro.")],
            ephemeral: true
          });
        }

        // Remover da família
        const updatedMembers = family.members.filter(id => id !== userId);
        const updatedAdmins = family.admins.filter(id => id !== userId);

        await familyStore.update(family.id, {
          ...family,
          members: updatedMembers,
          admins: updatedAdmins
        });

        // Remover cargo
        if (family.roleId) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            await member.roles.remove(family.roleId);
          } catch (error) {
            console.log("Não foi possível remover o cargo:", error.message);
          }
        }

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ Você saiu da família **${family.name}**!`)]
        });
      }

      if (sub === "invite") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId || f.admins.includes(userId));
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não tem uma família para convidar membros!")],
            ephemeral: true
          });
        }

        if (!family.admins.includes(userId) && family.ownerId !== userId) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas donos e admins podem convidar membros!")],
            ephemeral: true
          });
        }

        if (family.members.length >= family.maxMembers) {
          return interaction.reply({
            embeds: [createErrorEmbed(`A família já atingiu o limite de **${family.maxMembers}** membros!`)],
            ephemeral: true
          });
        }

        if (family.members.includes(targetUser.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed("Este usuário já está na família!")],
            ephemeral: true
          });
        }

        // Adicionar membro
        await familyStore.update(family.id, {
          ...family,
          members: [...family.members, targetUser.id]
        });

        // Dar cargo
        if (family.roleId) {
          try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            await member.roles.add(family.roleId);
          } catch (error) {
            console.log("Não foi possível dar o cargo:", error.message);
          }
        }

        return interaction.reply({
          embeds: [createSuccessEmbed(
            `✅ **${targetUser.username}** foi convidado para **${family.name}**!\n\n` +
            `👥 Membros: ${family.members.length + 1}/${family.maxMembers}`
          )]
        });
      }

      if (sub === "kick") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId || f.admins.includes(userId));
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não tem uma família para remover membros!")],
            ephemeral: true
          });
        }

        if (!family.admins.includes(userId) && family.ownerId !== userId) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas donos e admins podem remover membros!")],
            ephemeral: true
          });
        }

        if (targetUser.id === family.ownerId) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não pode remover o dono da família!")],
            ephemeral: true
          });
        }

        if (!family.members.includes(targetUser.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed("Este usuário não está na família!")],
            ephemeral: true
          });
        }

        // Remover membro
        const updatedMembers = family.members.filter(id => id !== targetUser.id);
        const updatedAdmins = family.admins.filter(id => id !== targetUser.id);

        await familyStore.update(family.id, {
          ...family,
          members: updatedMembers,
          admins: updatedAdmins
        });

        // Remover cargo
        if (family.roleId) {
          try {
            const member = await interaction.guild.members.fetch(targetUser.id);
            await member.roles.remove(family.roleId);
          } catch (error) {
            console.log("Não foi possível remover o cargo:", error.message);
          }
        }

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi removido de **${family.name}**!`)]
        });
      }

      if (sub === "promote") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas o dono pode promover membros!")],
            ephemeral: true
          });
        }

        if (!family.members.includes(targetUser.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed("Este usuário não está na família!")],
            ephemeral: true
          });
        }

        if (family.admins.includes(targetUser.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed("Este usuário já é admin da família!")],
            ephemeral: true
          });
        }

        // Promover a admin
        await familyStore.update(family.id, {
          ...family,
          admins: [...family.admins, targetUser.id]
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi promovido a admin de **${family.name}**!`)]
        });
      }

      if (sub === "demote") {
        const targetUser = interaction.options.getUser("usuario");
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas o dono pode rebaixar admins!")],
            ephemeral: true
          });
        }

        if (!family.admins.includes(targetUser.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed("Este usuário não é admin da família!")],
            ephemeral: true
          });
        }

        if (targetUser.id === family.ownerId) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não pode rebaixar a si mesmo!")],
            ephemeral: true
          });
        }

        // Rebaixar de admin
        const updatedAdmins = family.admins.filter(id => id !== targetUser.id);

        await familyStore.update(family.id, {
          ...family,
          admins: updatedAdmins
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ **${targetUser.username}** foi rebaixado de admin de **${family.name}**!`)]
        });
      }
    }

    // Comandos de configuração
    if (group === "config") {
      const family = Object.values(families).find(f => f.ownerId === userId);
      
      if (!family) {
        return interaction.reply({
          embeds: [createErrorEmbed("Apenas o dono pode configurar a família!")],
          ephemeral: true
        });
      }

      if (sub === "rename") {
        const newName = interaction.options.getString("novo_nome");
        
        // Verificar se o nome já existe
        const nameExists = Object.values(families).find(f => f.name.toLowerCase() === newName.toLowerCase() && f.id !== family.id);
        if (nameExists) {
          return interaction.reply({
            embeds: [createErrorEmbed(`Já existe uma família com o nome **${newName}**!`)],
            ephemeral: true
          });
        }

        await familyStore.update(family.id, {
          ...family,
          name: newName
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ Família renomeada para **${newName}**!`)]
        });
      }

      if (sub === "color") {
        const color = interaction.options.getString("cor");
        
        // Validar cor hex
        if (!/^#[0-9A-F]{6}$/i.test(color)) {
          return interaction.reply({
            embeds: [createErrorEmbed("Cor inválida! Use formato hex: #FF0000")],
            ephemeral: true
          });
        }

        await familyStore.update(family.id, {
          ...family,
          color: color
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(`✅ Cor da família alterada para **${color}**!`)]
        });
      }

      if (sub === "decorate") {
        return interaction.reply({
          embeds: [createEmbed({
            title: "🎨 Decoração de Canais",
            description: "Sistema de decoração em desenvolvimento!\n\nEm breve você poderá:\n• Aplicar templates aos canais\n• Personalizar mensagens de boas-vindas\n• Criar emojis personalizados",
            color: 0x0099ff,
            footer: { text: "WDA - Todos os direitos reservados" }
          })]
        });
      }
    }

    // Comandos do banco
    if (group === "bank") {
      const family = Object.values(families).find(f => f.members.includes(userId));
      
      if (!family) {
        return interaction.reply({
          embeds: [createErrorEmbed("Você não está em nenhuma família!")],
          ephemeral: true
        });
      }

      if (sub === "deposit") {
        const amount = interaction.options.getInteger("quantia");
        
        if (!economyService) {
          return interaction.reply({
            embeds: [createErrorEmbed("Serviço de economia não disponível!")],
            ephemeral: true
          });
        }

        const userBalance = await economyService.getBalance(userId);
        if (userBalance < amount) {
          return interaction.reply({
            embeds: [createErrorEmbed(`Você não tem **${amount}** moedas! Saldo atual: **${userBalance}**`)],
            ephemeral: true
          });
        }

        // Remover do usuário
        await economyService.removeMoney(userId, amount);
        
        // Adicionar ao banco da família
        const currentBalance = family.bankBalance || 0;
        await familyStore.update(family.id, {
          ...family,
          bankBalance: currentBalance + amount
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(
            `✅ **${amount}** moedas depositadas no banco da família!\n\n` +
            `🏦 Saldo do banco: **${currentBalance + amount}** moedas`
          )]
        });
      }

      if (sub === "withdraw") {
        const amount = interaction.options.getInteger("quantia");
        const currentBalance = family.bankBalance || 0;
        
        if (currentBalance < amount) {
          return interaction.reply({
            embeds: [createErrorEmbed(`O banco não tem **${amount}** moedas! Saldo atual: **${currentBalance}**`)],
            ephemeral: true
          });
        }

        // Verificar se é admin ou dono
        if (!family.admins.includes(userId) && family.ownerId !== userId) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas admins e o dono podem sacar do banco!")],
            ephemeral: true
          });
        }

        // Remover do banco
        await familyStore.update(family.id, {
          ...family,
          bankBalance: currentBalance - amount
        });

        // Adicionar ao usuário
        if (economyService) {
          await economyService.addMoney(userId, amount);
        }

        return interaction.reply({
          embeds: [createSuccessEmbed(
            `✅ **${amount}** moedas sacadas do banco da família!\n\n` +
            `🏦 Saldo do banco: **${currentBalance - amount}** moedas`
          )]
        });
      }

      if (sub === "balance") {
        const balance = family.bankBalance || 0;
        
        return interaction.reply({
          embeds: [createEmbed({
            title: `🏦 Banco da ${family.name}`,
            description: `Saldo atual: **${balance}** moedas`,
            color: 0x00ff00,
            footer: { text: "WDA - Todos os direitos reservados" }
          })]
        });
      }
    }

    // Comandos de informação
    if (group === "info") {
      if (sub === "list") {
        const sortedFamilies = Object.values(families)
          .sort((a, b) => b.members.length - a.members.length)
          .slice(0, 10);

        if (sortedFamilies.length === 0) {
          return interaction.reply({
            embeds: [createEmbed({
              title: "🏠 Ranking de Famílias",
              description: "Nenhuma família encontrada!",
              color: 0xff0000,
              footer: { text: "WDA - Todos os direitos reservados" }
            })]
          });
        }

        const fields = sortedFamilies.map((family, index) => ({
          name: `${index + 1}. ${family.name}`,
          value: `👥 ${family.members.length}/${family.maxMembers} membros\n👑 Dono: <@${family.ownerId}>`,
          inline: false
        }));

        return interaction.reply({
          embeds: [createEmbed({
            title: "🏠 Ranking de Famílias",
            description: "Top 10 famílias com mais membros",
            color: 0x0099ff,
            fields,
            footer: { text: "WDA - Todos os direitos reservados" }
          })]
        });
      }

      if (sub === "transfer") {
        const newLeader = interaction.options.getUser("novo_lider");
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não é dono de nenhuma família!")],
            ephemeral: true
          });
        }

        if (!family.members.includes(newLeader.id)) {
          return interaction.reply({
            embeds: [createErrorEmbed("O usuário não está na sua família!")],
            ephemeral: true
          });
        }

        // Transferir liderança
        await familyStore.update(family.id, {
          ...family,
          ownerId: newLeader.id,
          admins: [newLeader.id, ...family.admins.filter(id => id !== newLeader.id)]
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(
            `✅ Liderança de **${family.name}** transferida para **${newLeader.username}**!`
          )]
        });
      }

      if (sub === "upgrade") {
        const family = Object.values(families).find(f => f.ownerId === userId);
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Apenas o dono pode comprar slots!")],
            ephemeral: true
          });
        }

        const upgradeCost = 5000; // 5000 moedas por slot extra
        
        if (!economyService) {
          return interaction.reply({
            embeds: [createErrorEmbed("Serviço de economia não disponível!")],
            ephemeral: true
          });
        }

        const userBalance = await economyService.getBalance(userId);
        if (userBalance < upgradeCost) {
          return interaction.reply({
            embeds: [createErrorEmbed(`Você precisa de **${upgradeCost}** moedas para comprar um slot extra! Saldo atual: **${userBalance}**`)],
            ephemeral: true
          });
        }

        // Remover moedas e aumentar limite
        await economyService.removeMoney(userId, upgradeCost);
        await familyStore.update(family.id, {
          ...family,
          maxMembers: family.maxMembers + 1
        });

        return interaction.reply({
          embeds: [createSuccessEmbed(
            `✅ Slot extra comprado!\n\n` +
            `💸 Custo: **${upgradeCost}** moedas\n` +
            `👥 Novo limite: **${family.maxMembers + 1}** membros`
          )]
        });
      }

      if (sub === "panel") {
        const family = Object.values(families).find(f => f.members.includes(userId));
        
        if (!family) {
          return interaction.reply({
            embeds: [createErrorEmbed("Você não está em nenhuma família!")],
            ephemeral: true
          });
        }

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
          ],
          footer: { text: "WDA - Todos os direitos reservados" }
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

    // Resposta padrão para comandos não implementados
    return interaction.reply({
      embeds: [createErrorEmbed("Este comando ainda não foi implementado!")],
      ephemeral: true
    });
  }
};
