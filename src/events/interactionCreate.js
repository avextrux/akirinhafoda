const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try { await command.execute(interaction); } catch (e) { console.error(e); }
      return;
    }

    // 2. BOTÕES (Parcerias + Tickets)
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("partnership_")) {
        const cmd = client.commands.get("partnership");
        if (cmd) return await cmd.handleButton(interaction);
      }
      
      if (interaction.customId.startsWith("open_ticket_") || interaction.customId === "close_ticket_btn") {
        const cmd = client.commands.get("ticket");
        if (cmd) return await cmd.handleButton(interaction);
      }

      // Fallback para outros sistemas de botões
      for (const cmd of client.commands.values()) {
        if (typeof cmd.handleButton === "function") {
          await cmd.handleButton(interaction).catch(() => null);
          if (interaction.replied || interaction.deferred) return;
        }
      }
    }

    // 3. MODAIS (Parcerias + Outros)
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("partnership_modal_")) {
        const cmd = client.commands.get("partnership");
        if (cmd) return await cmd.handleModal(interaction);
      }

      for (const cmd of client.commands.values()) {
        if (typeof cmd.handleModal === "function") {
          await cmd.handleModal(interaction).catch(() => null);
          if (interaction.replied || interaction.deferred) return;
        }
      }
    }
  }
};
