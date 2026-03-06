const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Erro no comando /${interaction.commandName}:`, error);
      }
      return;
    }

    // 2. SISTEMA DE INTERAÇÕES (Botões, Menus e Modais)
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      const customId = interaction.customId;
      let command = null;

      // IDENTIFICAÇÃO DIRETA (Garante que o bot não se perca)
      if (customId.includes("partnership")) {
        command = client.commands.get("partnership");
      } else if (customId.includes("ticket")) {
        command = client.commands.get("ticket");
      } else if (customId.includes("sejawda")) {
        command = client.commands.get("sejawda");
      } else {
        // Se não for nenhum dos 3, tenta pegar a primeira palavra antes do "_"
        const commandName = customId.split("_")[0];
        command = client.commands.get(commandName);
      }

      const handlerName = interaction.isButton() ? "handleButton" : 
                          interaction.isAnySelectMenu() ? "handleSelectMenu" : 
                          "handleModal";

      // Executa o comando identificado
      if (command && typeof command[handlerName] === "function") {
        try {
          await command[handlerName](interaction);
          if (interaction.replied || interaction.deferred) return;
        } catch (e) {
          console.error(`Erro no handler ${handlerName} do comando ${command.data.name}:`, e);
        }
      }

      // VARREDURA DE SEGURANÇA (Para os outros comandos)
      for (const cmd of client.commands.values()) {
        if (typeof cmd[handlerName] === "function") {
          try {
            // Pula os que já tentamos acima
            if (["partnership", "ticket", "sejawda"].includes(cmd.data.name)) continue;
            
            await cmd[handlerName](interaction);
            if (interaction.replied || interaction.deferred) return;
          } catch (e) { continue; }
        }
      }
    }
  },
};
