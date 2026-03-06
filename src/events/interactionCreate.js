const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    
    // 1. COMANDOS SLASH (Geral)
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

    // 2. SISTEMA UNIVERSAL (Botões, Menus e Modais)
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      
      // Determina qual função procurar dentro dos arquivos de comando
      const handlerName = interaction.isButton() ? "handleButton" : 
                          interaction.isAnySelectMenu() ? "handleSelectMenu" : 
                          "handleModal";

      // Pega todos os seus comandos carregados
      const allCommands = client.commands.values();

      for (const command of allCommands) {
        // Verifica se o comando tem a função necessária (ex: handleButton)
        if (typeof command[handlerName] === "function") {
          try {
            // Tenta executar. Se o comando responder à interação, o loop para.
            await command[handlerName](interaction);

            // Se o comando respondeu (replied) ou pediu tempo (deferred), missão cumprida.
            if (interaction.replied || interaction.deferred) {
              return; 
            }
          } catch (error) {
            // Se o erro for "Unknown Interaction", o tempo expirou (3s), paramos tudo.
            if (error.code === 10062) return;

            // Caso contrário, apenas ignora e tenta o próximo comando da lista.
            continue;
          }
        }
      }

      // Se chegou aqui e ninguém respondeu, avisamos (opcional)
      if (!interaction.replied && !interaction.deferred) {
        // console.log(`Interação ${interaction.customId} não foi assumida por nenhum comando.`);
      }
    }
  },
};
