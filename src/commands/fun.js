const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const { createEmbed, createSuccessEmbed, createErrorEmbed } = require("../embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fun")
    .setDescription("Comandos de diversão")
    .addSubcommand((sub) =>
      sub
        .setName("8ball")
        .setDescription("Faça uma pergunta para a bola mágica")
        .addStringOption((opt) => opt.setName("pergunta").setDescription("Sua pergunta").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("avatar")
        .setDescription("Mostra o avatar de um usuário")
        .addUserOption((opt) => opt.setName("usuario").setDescription("Usuário (opcional)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("say")
        .setDescription("Faz o bot falar uma mensagem ou enviar uma Embed via JSON (Admin)")
        .addStringOption((opt) => 
            opt.setName("texto")
            .setDescription("O que o bot deve dizer (deixe vazio se for usar apenas JSON)")
            .setRequired(false)
        )
        .addAttachmentOption((opt) => 
            opt.setName("json")
            .setDescription("Arquivo .json com a estrutura da Embed (Opcional)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("coinflip")
        .setDescription("Joga uma moeda (Cara ou Coroa)")
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // 8BALL
    if (sub === "8ball") {
      const question = interaction.options.getString("pergunta");
      const answers = [
        "Sim!", "Infelizmente não", "Você está absolutamente certo!", "Não, desculpe.",
        "Eu concordo", "Sem ideia!", "Eu não sou tão inteligente...", "Minhas fontes dizem não!",
        "É certo", "Você pode confiar nisso", "Provavelmente não", "Tudo aponta para um não",
        "Sem dúvida", "Absolutamente", "Eu não sei"
      ];

      const result = answers[Math.floor(Math.random() * answers.length)];

      await interaction.reply({ 
        embeds: [createEmbed({
          title: "🎱 Bola 8 Mágica",
          fields: [
            { name: "💬 Sua Pergunta", value: `\`\`\`${question}\`\`\`` },
            { name: "🤖 Resposta do Bot", value: `\`\`\`${result}\`\`\`` }
          ],
          color: 0x000000
        })] 
      });
    }

    // AVATAR
    if (sub === "avatar") {
      const user = interaction.options.getUser("usuario") || interaction.user;

      await interaction.reply({ 
        embeds: [createEmbed({
          title: `🖼 Avatar de ${user.username}`,
          image: user.displayAvatarURL({ dynamic: true, size: 1024 }),
          color: 0x3498db
        })] 
      });
    }

    // SAY COM SUPORTE A JSON E TRAVA DE ADMIN
    if (sub === "say") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
          return interaction.reply({ 
              embeds: [createErrorEmbed("Você não tem permissão para fazer o bot falar.")], 
              ephemeral: true 
          });
      }

      const text = interaction.options.getString("texto");
      const jsonFile = interaction.options.getAttachment("json");

      if (!text && !jsonFile) {
          return interaction.reply({ 
              embeds: [createErrorEmbed("Você precisa fornecer um texto ou um arquivo JSON.")], 
              ephemeral: true 
          });
      }

      try {
          await interaction.deferReply({ ephemeral: true });

          let optionsToSend = {};

          // Processamento do Texto Normal
          if (text) {
              if (text.length > 2000) {
                  return interaction.editReply({ embeds: [createErrorEmbed("O texto é muito longo (máx 2000 caracteres).")] });
              }

              const blacklistedWords = ["@everyone", "@here"];
              if (blacklistedWords.some(word => text.includes(word))) {
                  return interaction.editReply({ embeds: [createErrorEmbed("O texto contém menções massivas não permitidas.")] });
              }

              optionsToSend.content = text.replace(/`{3,}/g, '').replace(/\*\*(.*?)\*\*/g, '$1');
          }

          // Processamento do JSON (Embed)
          if (jsonFile) {
              if (!jsonFile.name.endsWith('.json')) {
                  return interaction.editReply({ embeds: [createErrorEmbed("O arquivo precisa ter a extensão `.json`.")] });
              }

              const response = await fetch(jsonFile.url);
              const jsonData = await response.json();

              // Suporta tanto o formato do Discohook (objeto com .embeds) quanto arrays diretos
              if (Array.isArray(jsonData)) {
                  optionsToSend.embeds = jsonData;
              } else if (jsonData.embeds) {
                  optionsToSend = { ...optionsToSend, ...jsonData };
              } else {
                  optionsToSend.embeds = [jsonData];
              }
          }

          await interaction.channel.send(optionsToSend);
          await interaction.editReply({ embeds: [createSuccessEmbed("Mensagem enviada com sucesso!")] });

      } catch (error) {
          console.error("Erro no comando say:", error);
          await interaction.editReply({ 
              embeds: [createErrorEmbed(`Erro ao processar a mensagem ou ler o JSON. Verifique a estrutura do arquivo. Erro: \`${error.message}\``)] 
          });
      }
    }

    // COINFLIP
    if (sub === "coinflip") {
      const result = Math.random() < 0.5 ? "Cara" : "Coroa";

      await interaction.reply({ 
        embeds: [createEmbed({
          title: "🪙 Cara ou Coroa",
          description: `A moeda caiu em: **${result}**!`,
          color: 0xF1C40F
        })] 
      });
    }
  },
};