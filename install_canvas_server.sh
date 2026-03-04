#!/bin/bash

echo "🚀 Instalando Canvas no Servidor"
echo "================================="

# Navegar até o diretório do projeto
cd /home/ubuntu/aushsfh

# Instalar dependências do sistema (se necessário)
echo "📦 Instalando dependências do sistema..."
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Instalar Canvas
echo "🎨 Instalando Canvas..."
npm install canvas

# Verificar instalação
echo "🔍 Verificando instalação..."
node -e "console.log('Canvas version:', require('canvas/package.json').version)"

# Reiniciar o bot
echo "🔄 Reiniciando o bot..."
pm2 restart WDA-BOT

# Verificar status
echo "📊 Verificando status do bot..."
pm2 status
pm2 logs WDA-BOT --lines 10

echo "✅ Instalação do Canvas concluída!"
echo "🎯 Teste os comandos: /rank view e /leaderboard"
