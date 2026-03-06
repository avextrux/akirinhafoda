const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    
    // 1. Tratamento de Comandos Slash (Chat Input)
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Falha no comando /${interaction.commandName}:`, error);
        const msg = { content: "Ocorreu um problema ao processar este comando.", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg).catch(() => null);
        } else {
          await interaction.reply(msg).catch(() => null);
        }
      }
      return; // Importante para não processar o código abaixo desnecessariamente
    }

    // 2. Tratamento de Botões (Tickets + Parcerias)
    if (interaction.isButton()) {
      // Prioridade: Parcerias
      if (interaction.customId.startsWith("partnership_")) {
        const partnershipCmd = client.commands.get("partnership");
        if (partnershipCmd && typeof partnershipCmd.handleButton === "function") {
          return await partnershipCmd.handleButton(interaction).catch(err => console.error("Erro no botão de parceria:", err));
        }
      }

      // Prioridade: Tickets (Suporte, Parceria, etc)
      if (interaction.customId.startsWith("open_ticket_") || interaction.customId === "close_ticket_btn") {
        const ticketCmd = client.commands.get("ticket");
        if (ticketCmd && typeof ticketCmd.handleButton === "function") {
          return await ticketCmd.handleButton(interaction).catch(err => console.error("Erro no botão de ticket:", err));
        }
      }

      // Fallback: Tenta rodar handleButton em todos os comandos (estilo do código antigo)
      // Isso garante que se você criar outro sistema de botões, ele não quebre.
      for (const command of client.commands.values()) {
        if (typeof command.handleButton === "function") {
          try {
            await command.handleButton(interaction);
            if (interaction.replied || interaction.deferred) return;
          } catch (error) {
            continue;
          }
        }
      }
    }

    // 3. Suporte para Modais (Caso existam no bot)
    if (interaction.isModalSubmit()) {
      for (const command of client.commands.values()) {
        if (typeof command.handleModal === "function") {
          await command.handleModal(interaction).catch(() => null);
          if (interaction.replied || interaction.deferred) return;
        }
      }
    }

    // 4. Suporte para Menus de Seleção
    if (interaction.isAnySelectMenu()) {
      for (const command of client.commands.values()) {
        if (typeof command.handleSelectMenu === "function") {
          await command.handleSelectMenu(interaction).catch(() => null);
          if (interaction.replied || interaction.deferred) return;
        }
      }
    }
  }
};
