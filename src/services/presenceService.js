const { ActivityType, EmbedBuilder } = require("discord.js");
const { createDataStore } = require("../store/dataStore");

// Usando o seu gerenciador padrão, que já cuida do MongoDB corretamente
const presenceStore = createDataStore("presence.json");

let rotationInterval = null;
let maintenanceInterval = null;

function createPresenceService() {
  return {
    async getPresence() {
      const db = await presenceStore.load();
      // Lemos do objeto 'global' do banco de dados
      return db["global"] || { status: "online", activity: null, random: { enabled: false, phrases: [] } };
    },

    async setPresence(presenceData) {
      const current = await this.getPresence();
      const updated = { ...current, ...presenceData, random: { ...(current.random || {}), enabled: false } };
      
      await presenceStore.update("global", () => updated);
      return updated;
    },

    async clearPresence() {
      const empty = { status: "online", activity: null, random: { enabled: false, phrases: [] } };
      await presenceStore.update("global", () => empty);
      return empty;
    },

    async applyPresence(client) {
      const saved = await this.getPresence();
      if (saved.random?.enabled) return this.startRotation(client);

      client.user.setPresence({
        status: saved.status || "online",
        activities: saved.activity ? [saved.activity] : []
      });
    },

    // --- ROTAÇÃO ---
    async addRandomText(text) {
      const data = await this.getPresence();
      if (!data.random) data.random = { enabled: false, phrases: [] };
      
      data.random.phrases.push(text);
      await presenceStore.update("global", () => data);
      return data;
    },

    async getPhrases() {
      const data = await this.getPresence();
      return data.random?.phrases || [];
    },

    async removeRandomText(index) {
      const data = await this.getPresence();
      if (!data.random?.phrases || !data.random.phrases[index]) return false;
      
      data.random.phrases.splice(index, 1);
      await presenceStore.update("global", () => data);
      return true;
    },

    async toggleRotation() {
      const data = await this.getPresence();
      if (!data.random) data.random = { enabled: false, phrases: [] };
      
      data.random.enabled = !data.random.enabled;
      await presenceStore.update("global", () => data);
      return data.random.enabled;
    },

    startRotation(client) {
      this.stopRotation();
      rotationInterval = setInterval(async () => {
        const data = await this.getPresence();
        if (!data.random?.enabled || !data.random.phrases.length) return this.stopRotation();
        
        const frase = data.random.phrases[Math.floor(Math.random() * data.random.phrases.length)];
        client.user.setActivity(frase, { type: ActivityType.Custom });
      }, 30000);
    },

    stopRotation() {
      if (rotationInterval) clearInterval(rotationInterval);
      rotationInterval = null;
    },

    // --- MANUTENÇÃO ---
    async startMaintenanceLoop(client, data) {
      if (maintenanceInterval) clearInterval(maintenanceInterval);
      
      maintenanceInterval = setInterval(async () => {
        try {
          const channel = client.channels.cache.get(data.channelId);
          if (!channel) return;
          
          const message = await channel.messages.fetch(data.messageId).catch(() => null);
          if (!message) return;

          const minutes = Math.floor((Date.now() - data.startTime) / 1000 / 60);
          const embed = new EmbedBuilder()
            .setTitle("⚠️ Aviso de Manutenção")
            .setDescription("O bot está passando por uma manutenção técnica para melhorias.")
            .addFields(
              { name: "Status", value: "🔴 Instável", inline: true },
              { name: "Duração", value: `\`${minutes} min\``, inline: true },
              { name: "Sincronizado", value: `<t:${Math.floor(Date.now()/1000)}:R>`, inline: false }
            )
            .setColor(0xFFA500);
            
          await message.edit({ embeds: [embed] });
        } catch (e) { 
          console.error("Erro no loop de manutenção:", e); 
        }
      }, 120000);
    },

    stopMaintenanceLoop() {
      if (maintenanceInterval) clearInterval(maintenanceInterval);
      maintenanceInterval = null;
    }
  };
}

module.exports = { createPresenceService };