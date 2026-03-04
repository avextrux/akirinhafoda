#!/bin/bash

echo "🔧 CORREÇÃO COMPLETA DO ERRO DE INICIALIZAÇÃO"
echo "============================================"

# Navegar até o diretório do projeto
cd /home/ubuntu/aushsfh

# 1. Parar o bot completamente
echo "🛑 Parando o bot..."
pm2 stop WDA-BOT || echo "Bot não estava rodando"
pm2 delete WDA-BOT || echo "Bot não estava registrado"

# 2. Backup dos arquivos atuais
echo "💾 Fazendo backup dos arquivos..."
cp src/index.js src/index.js.backup
cp package.json package.json.backup

# 3. Limpeza completa
echo "🧹 Limpando instalação..."
rm -rf node_modules
rm -f package-lock.json

# 4. Atualizar sistema
echo "📦 Atualizando sistema..."
sudo apt-get update

# 5. Instalar dependências do Canvas
echo "🎨 Instalando dependências do Canvas..."
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# 6. Instalar Discord.js versão compatível
echo "🤖 Instalando Discord.js..."
npm install discord.js@14.14.1 --save

# 7. Instalar Canvas
echo "🎨 Instalando Canvas..."
npm install canvas@2.11.2 --save

# 8. Instalar demais dependências
echo "📦 Instalando demais dependências..."
npm install dotenv@16.4.5 mongoose@9.2.2 --save
npm install

# 9. Aplicar versão corrigida do index.js
echo "🔧 Aplicando versão corrigida do index.js..."
cp src/index_fixed.js src/index.js

# 10. Verificar instalação crítica
echo "🔍 Verificando instalação crítica..."
node -e "
console.log('🧪 TESTE CRÍTICO DE DEPENDÊNCIAS');
console.log('================================');

try {
  // Testar Discord.js
  const discord = require('discord.js');
  console.log('✅ Discord.js versão:', discord.version);
  
  // Testar GatewayIntentBits
  const { GatewayIntentBits } = discord;
  console.log('✅ GatewayIntentBits disponível');
  
  // Verificar intenções
  const intents = ['Guilds', 'GuildMessages', 'MessageContent', 'GuildVoiceStates', 'GuildMembers'];
  intents.forEach(intent => {
    if (GatewayIntentBits[intent]) {
      console.log('✅', intent + ':', GatewayIntentBits[intent]);
    } else {
      console.log('❌', intent + ': AUSENTE');
      throw new Error('Intenção ' + intent + ' não encontrada');
    }
  });
  
  // Testar Canvas
  const canvas = require('canvas');
  console.log('✅ Canvas disponível');
  
  // Testar Config
  const { config } = require('./src/config');
  console.log('✅ Config carregado');
  
  // Testar criação do Client
  const { Client } = discord;
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
  
  console.log('🎉 TODAS AS DEPENDÊNCIAS CRÍTICAS FUNCIONANDO!');
  
} catch (error) {
  console.error('❌ ERRO CRÍTICO:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
"

# 11. Verificar se o teste passou
if [ $? -eq 0 ]; then
  echo "✅ Teste crítico passou"
  
  # 12. Iniciar o bot
  echo "🚀 Iniciando o bot..."
  npm start
  
  # 13. Verificar status
  echo "📊 Verificando status..."
  sleep 10
  pm2 status
  pm2 logs WDA-BOT --lines 30
  
  echo "✅ Correção concluída com sucesso!"
  echo "🎯 Verifique se o bot está online sem erros"
  
else
  echo "❌ Teste crítico falhou"
  echo "🔄 Restaurando backup..."
  cp src/index.js.backup src/index.js
  cp package.json.backup package.json
  
  echo "❌ Correção falhou. Verifique os logs acima."
  exit 1
fi
