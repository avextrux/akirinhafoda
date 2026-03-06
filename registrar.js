const { REST, Routes } = require("discord.js");
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();
const { CLIENT_ID, DISCORD_TOKEN, GUILD_ID } = process.env;

const rest = new REST({ version: '10', timeout: 60000 }).setToken(DISCORD_TOKEN);

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    
    if (fs.statSync(filePath).isDirectory()) {
      loadCommands(filePath);
    } else if (file.endsWith('.js')) {
      try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);
        if (command.data && typeof command.data.toJSON === 'function') {
          commands.push(command.data.toJSON());
        }
      } catch (e) {
        console.error(`Erro ao processar ${file}: ${e.message}`);
      }
    }
  }
}

(async () => {
  try {
    loadCommands(commandsPath);
    console.log(`Iniciando registro de ${commands.length} comandos.`);

    let data;
    if (GUILD_ID) {
      data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
    } else {
      data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
    }

    console.log(`Registro concluido. Total ativos: ${data.length}`);
  } catch (error) {
    console.error('Falha na comunicacao com a API do Discord:');
    if (error.status === 400) {
      console.error('Um dos comandos possui corpo invalido. Verifique nomes em maiusculo ou descricoes vazias.');
      console.error(JSON.stringify(error.errors, null, 2));
    } else {
      console.error(error.message);
    }
  }
})();
