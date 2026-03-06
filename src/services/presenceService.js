const { ActivityType, EmbedBuilder } = require("discord.js");
const { createDataStore } = require("../store/dataStore");

// Usando o mongoStore para persistência real no MongoDB
const mongoStore = require("../store/mongoStore"); 

let rotationInterval = null;
let maintenanceInterval = null;

const presenceService = {
  /**
   * Obtém os dados de presença salvos no banco
   */
  async getPresence() {
    const data = await mongoStore.get("presence");
    return data || { status: "online", activity: null, random: { enabled: false, phrases: [] } };
  },

  /**
   * Salva uma nova presença fixa no banco
   */
  async setPresence(presenceData) {
    const current = await this.getPresence();
    const updated = { ...current, ...presenceData };
    return await mongoStore.set("presence", updated);
  },

  /**
   * Limpa a presença (Resolve o erro de 'null' no Mongoose)
   */
  async clearPresence() {
    const emptyPresence = { status: "online", activity: null, random: { enabled: false, phrases: [] } };
    return await mongoStore.set("presence", emptyPresence);
  },

  /**
   * Aplica a presença salva no cliente do Discord
   */
  async applyPresence(client) {
    const saved = await this.getPresence();
    if (!saved || saved.random?.enabled) return;

    if (saved.activity) {
      client.user.setPresence({
        status: saved.status || "online",
        activities: [saved.activity]
      });
    } else {
      client.user.setPresence({ status: saved.status || "online", activities: [] });
    }
  },

  /**
   * --- SISTEMA DE ROTAÇÃO ALEATÓRIA ---
   */

  async addRandomText(text) {
    const data = await this.getPresence();
    if (!data.random) data.random = { enabled: false, phrases: [] };
    data.random.phrases.push(text);
    return await mongoStore.set("presence", data);
  },

  async toggleRotation() {
    const data = await this.getPresence();
    if (!data.random) data.random = { enabled: false, phrases: [] };
    data.random.enabled = !data.random.enabled;
    await mongoStore.set("presence", data);
    return data.random.enabled;
  },

  startRotation(client) {
    if (rotationInterval) clearInterval(rotationInterval);

    rotationInterval = setInterval(async () => {
      const data = await this.getPresence();
      if (!data.random?.enabled || data.random.phrases.length === 0) return;

      const frase = data.random.phrases[Math.floor(Math.random() * data.random.phrases.length)];
      
      client.user.setActivity(frase, { type: ActivityType.Custom });
    }, 30000); // Troca a cada 30 segundos
  },

  /**
   * --- SISTEMA DE MANUTENÇÃO (Loop 2 min) ---
   */

  async startMaintenanceLoop(client, data) {
    if (maintenanceInterval) clearInterval(maintenanceInterval);

    maintenanceInterval = setInterval(async () => {
      try {
        const channel = client.channels.cache.get(data.channelId);
        if (!channel) return;

        const message = await channel.messages.fetch(data.messageId).catch(() => null);
        if (!message) return;

        const uptimeMinutes = Math.floor((Date.now() - data.startTime) / 1000 / 60);
        
        const updatedEmbed = new EmbedBuilder()
          .setTitle("⚠️ Aviso de Manutenção")
          .setDescription("O bot está passando por uma manutenção técnica para melhorias.")
          .addFields(
            { name: "Status", value: "🔴 Instável / Em Manutenção", inline: true },
            { name: "Duração Atual", value: `\`${uptimeMinutes} minutos\``, inline: true },
            { name: "Última Atualização", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
          )
          .setFooter({ text: "A cada 2 minutos esta mensagem é atualizada." })
          .setColor(0xFFA500);

        await message.edit({ embeds: [updatedEmbed] });
      } catch (err) {
        console.error("Erro no loop de manutenção:", err);
      }
    }, 120000); // Exatos 2 minutos
  },

  stopMaintenanceLoop() {
    if (maintenanceInterval) {
      clearInterval(maintenanceInterval);
      maintenanceInterval = null;
    }
  }
};

module.exports = presenceService;
