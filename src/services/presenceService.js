const { ActivityType, EmbedBuilder } = require("discord.js");
const mongoStore = require("../store/mongoStore"); 

let rotationInterval = null;
let maintenanceInterval = null;

// Criamos a função que o seu index.js está procurando
function createPresenceService() {
  return {
    async getPresence() {
      const data = await mongoStore.get("presence");
      return data || { status: "online", activity: null, random: { enabled: false, phrases: [] } };
    },

    async setPresence(presenceData) {
      const current = await this.getPresence();
      const updated = { ...current, ...presenceData, random: { ...current.random, enabled: false } };
      return await mongoStore.set("presence", updated);
    },

    async clearPresence() {
      const empty = { status: "online", activity: null, random: { enabled: false, phrases: [] } };
      return await mongoStore.set("presence", empty);
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
      return await mongoStore.set("presence", data);
    },

    async getPhrases() {
      const data = await this.getPresence();
      return data.random?.phrases || [];
    },

    async removeRandomText(index) {
      const data = await this.getPresence();
      if (!data.random?.phrases[index]) return false;
      data.random.phrases.splice(index, 1);
      await mongoStore.set("presence", data);
      return true;
    },

    async toggleRotation() {
      const data = await this.getPresence();
      if (!data.random) data.random = { enabled: false, phrases: [] };
      data.random.enabled = !data.random.enabled;
      await mongoStore.set("presence", data);
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
        } catch (e) { console.error(e); }
      }, 120000);
    },

    stopMaintenanceLoop() {
      if (maintenanceInterval) clearInterval(maintenanceInterval);
      maintenanceInterval = null;
    }
  };
}

// Exportamos a função, não o objeto
module.exports = { createPresenceService };
