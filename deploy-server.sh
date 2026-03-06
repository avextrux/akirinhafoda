#!/bin/bash

echo "🔧 DEPLOY AUTOMÁTICO - COMANDOS CORRIGIDOS"
echo "=========================================="

# Parar bot
echo "🛑 Parando bot..."
pm2 stop all

# Fazer pull das atualizações
echo "📥 Baixando atualizações..."
git pull

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Deploy dos comandos
echo "🚀 Fazendo deploy dos comandos..."
node registrar.js

# Reiniciar bot com atualização de env
echo "🔄 Reiniciando bot..."
pm2 restart all --update-env

# Mostrar logs
echo "📋 Exibindo logs..."
pm2 logs

echo "✅ Deploy concluído!"
