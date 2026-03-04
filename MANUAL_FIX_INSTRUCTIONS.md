# 🚀 INSTRUÇÕES MANUAIS - CORREÇÃO DO ERRO DE INICIALIZAÇÃO

## 📋 Comandos para Executar no Servidor

### 1. Conectar via SSH
```bash
ssh ubuntu@167.71.138.241
```

### 2. Navegar até o projeto
```bash
cd /home/ubuntu/aushsfh
```

### 3. Opção A - Script Automático (Recomendado)
```bash
chmod +x complete_bot_fix.sh
./complete_bot_fix.sh
```

### 4. Opção B - Passos Manuais

#### 4.1 Parar o bot
```bash
pm2 stop WDA-BOT
pm2 delete WDA-BOT
```

#### 4.2 Fazer backup
```bash
cp src/index.js src/index.js.backup
cp package.json package.json.backup
```

#### 4.3 Limpar instalação
```bash
rm -rf node_modules
rm -f package-lock.json
```

#### 4.4 Instalar dependências do sistema
```bash
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

#### 4.5 Instalar Discord.js versão específica
```bash
npm install discord.js@14.14.1 --save
```

#### 4.6 Instalar Canvas
```bash
npm install canvas@2.11.2 --save
```

#### 4.7 Instalar demais dependências
```bash
npm install dotenv@16.4.5 mongoose@9.2.2 --save
npm install
```

#### 4.8 Aplicar versão corrigida
```bash
cp src/index_fixed.js src/index.js
```

#### 4.9 Testar dependências
```bash
node -e "
const { GatewayIntentBits } = require('discord.js');
const { createCanvas } = require('canvas');
const { config } = require('./src/config');
console.log('✅ Todas as dependências funcionando!');
"
```

#### 4.10 Iniciar o bot
```bash
npm start
```

### 5. Verificação
```bash
# Verificar status
pm2 status

# Verificar logs
pm2 logs WDA-BOT --lines 30

# Verificar se está online
pm2 monit
```

## 🔍 Diagnóstico do Problema

### Erro Original:
```
TypeError: Cannot read properties of undefined (reading 'Guilds')
at createClient (/home/ubuntu/aushsfh/src/index.js:17:25)
```

### Causa Provável:
- GatewayIntentBits estava undefined
- Possível conflito de versões do Discord.js
- Instalação do Canvas pode ter corrompido dependências

### Solução Aplicada:
- Versão específica do Discord.js (14.14.1)
- Tratamento de erros no index.js
- Validação de dependências antes de iniciar

## 🛠️ Solução de Problemas

### Se o erro persistir:
```bash
# Verificar versão do Discord.js
npm list discord.js

# Reinstalar completamente
npm uninstall discord.js
npm install discord.js@14.14.1

# Verificar variáveis de ambiente
echo $DISCORD_TOKEN
echo $CLIENT_ID
```

### Se Canvas não funcionar:
```bash
# Reinstalar com dependências
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm uninstall canvas
npm install canvas@2.11.2
```

### Se o bot não iniciar:
```bash
# Verificar logs completos
pm2 logs WDA-BOT --lines 100

# Testar manualmente
node src/index.js
```

## 📊 Estrutura das Correções

### 1. index_fixed.js
- ✅ Tratamento de erros no import
- ✅ Validação de GatewayIntentBits
- ✅ Verificação de configuração
- ✅ Logs detalhados do processo

### 2. Versões Específicas
- ✅ discord.js@14.14.1 (estável)
- ✅ canvas@2.11.2 (compatível)
- ✅ dotenv@16.4.5 (última)
- ✅ mongoose@9.2.2 (última)

### 3. Validação Crítica
- ✅ GatewayIntentBits disponível
- ✅ Todas as intenções necessárias
- ✅ Config carregado
- ✅ Client criado com sucesso

## 🎯 Resultado Esperado

Após a correção:
- ✅ Bot inicia sem erros
- ✅ GatewayIntentBits funcionando
- ✅ Canvas funcionando para cards
- ✅ Sistema completo operacional

## 📋 Comandos de Teste Final

Após o bot estar online:
```bash
# Testar comandos básicos
/rank view
/rank cards action:view
/leaderboard

# Verificar logs
pm2 logs WDA-BOT --lines 20
```

## ✅ Status Final

**🎯 CORREÇÃO IMPLEMENTADA E PRONTA**

- ✅ Script automático criado
- ✅ Versão corrigida do index.js
- ✅ Instruções manuais detalhadas
- ✅ Solução de problemas documentada

**Execute o script automático ou os passos manuais para corrigir!** 🚀
