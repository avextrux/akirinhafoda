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

    // 2. SISTEMA GERAL DE INTERAÇÕES (Botões, Menus, Modais)
    // Esta parte varre os comandos e executa a função correta automaticamente
    
    let command;

    // Tenta encontrar o comando pelo nome no customId (Ex: "sejawda_tipo" -> busca comando "sejawda")
    const commandName = interaction.customId.split("_")[0];
    command = client.commands.get(commandName);

    // Se não achar pelo prefixo, faz a varredura em todos (Fallback de segurança)
    const handlers = [
      { check: interaction.isButton(), func: "handleButton" },
      { check: interaction.isAnySelectMenu(), func: "handleSelectMenu" },
      { check: interaction.isModalSubmit(), func: "handleModal" },
      { check: interaction.isAutocomplete(), func: "autocomplete" }
    ];

    for (const handler of handlers) {
      if (handler.check) {
        // Se achamos o comando pelo prefixo, executamos direto
        if (command && typeof command[handler.func] === "function") {
          try {
            await command[handler.func](interaction);
            return; 
          } catch (e) {
            console.error(`Erro no handler ${handler.func} do comando ${commandName}:`, e);
          }
        }

        // Se não achamos pelo prefixo ou falhou, tenta em todos (Para comandos como o Ticket que usam IDs diferentes)
        for (const cmd of client.commands.values()) {
          if (typeof cmd[handler.func] === "function") {
            try {
              await cmd[handler.func](interaction);
              // Se o comando respondeu ou deu erro mas processou, paramos por aqui
              if (interaction.replied || interaction.deferred) return;
            } catch (e) {
              // Ignora erros de comandos que não reconhecem o ID e continua procurando
              continue;
            }
          }
        }
      }
    }
  },
};
