#!/bin/bash

echo "🔧 CORREÇÃO DO ERRO DE INICIALIZAÇÃO DO BOT"
echo "=========================================="

# Navegar até o diretório do projeto
cd /home/ubuntu/aushsfh

# 1. Parar o bot
echo "🛑 Parando o bot..."
pm2 stop WDA-BOT

# 2. Fazer backup do package.json atual
echo "💾 Fazendo backup do package.json..."
cp package.json package.json.backup

# 3. Limpar node_modules completamente
echo "🧹 Limpando node_modules..."
rm -rf node_modules
rm -f package-lock.json

# 4. Verificar versão do Node.js
echo "📋 Verificando versão do Node.js..."
node --version
npm --version

# 5. Instalar dependências críticas primeiro
echo "📦 Instalando dependências críticas..."
npm install discord.js@14.14.1
npm install dotenv@16.4.5

# 6. Instalar Canvas com dependências do sistema
echo "🎨 Instalando Canvas..."
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install canvas@2.11.2

# 7. Instalar demais dependências
echo "📦 Instalando demais dependências..."
npm install

# 8. Verificar instalação
echo "🔍 Verificando instalação..."
node -e "
try {
  const { GatewayIntentBits } = require('discord.js');
  console.log('✅ GatewayIntentBits OK');
  
  const { createCanvas } = require('canvas');
  console.log('✅ Canvas OK');
  
  const { config } = require('./src/config');
  console.log('✅ Config OK');
  
  console.log('🎉 Todas as dependências funcionando!');
} catch (error) {
  console.error('❌ Erro:', error.message);
  process.exit(1);
}
"

# 9. Testar criação do client
echo "🤖 Testando criação do Client..."
node -e "
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});
console.log('✅ Client criado com sucesso');
console.log('✅ Intenções configuradas');
"

# 10. Iniciar o bot
echo "🚀 Iniciando o bot..."
pm2 start WDA-BOT

# 11. Verificar status
echo "📊 Verificando status..."
sleep 5
pm2 status
pm2 logs WDA-BOT --lines 20

echo "✅ Correção concluída!"
echo "🎯 Verifique se o bot iniciou sem erros"
