const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const commands = [];
const commandsPath = path.join(__dirname, "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

console.log("📂 Lendo pasta de comandos:", commandsPath);
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    commands.push(command.data.toJSON());
    console.log("✅ Comando carregado:", file);
  } else {
    console.log("⚠️ Arquivo ignorado (não é um comando válido):", file);
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Iniciando o registro de ${commands.length} comandos (Global)...`);
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log(`✨ SUCESSO! ${data.length} comandos registrados globalmente.`);
    console.log("💡 Nota: Pode levar até 1 hora para o cache do Discord atualizar em todos os servidores.");
  } catch (error) {
    console.error("❌ Erro ao registrar comandos:", error);
  }
})();
