# 🚀 EXECUÇÃO MANUAL - INSTALAÇÃO DO CANVAS

## 📋 Comandos para Executar no Servidor

### 1. Conectar via SSH
```bash
ssh ubuntu@167.71.138.241
```

### 2. Instalar Canvas (Opção A - Rápida)
```bash
cd /home/ubuntu/aushsfh
npm install canvas
pm2 restart WDA-BOT
```

### 3. Instalar Canvas (Opção B - Completa)
```bash
cd /home/ubuntu/aushsfh

# Instalar dependências do sistema
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Instalar Canvas
npm install canvas

# Reiniciar bot
pm2 restart WDA-BOT

# Verificar status
pm2 logs WDA-BOT --lines 20
```

### 4. Testar Funcionalidade
```bash
node test_canvas_server.js
```

## 🔍 Verificação de Funcionamento

Após a instalação, teste os comandos no Discord:

### Testar Cards
```
/rank view
```
- ✅ Deve gerar imagem 934×282
- ✅ Com tema padrão (cinza/dourado)

### Testar Temas
```
/rank cards action:view
/rank cards action:select card:premium
/rank view
```
- ✅ Deve mostrar cards possuídos
- ✅ Deve aplicar tema azul premium

### Testar Leaderboard
```
/leaderboard
```
- ✅ Deve gerar imagem 934×800
- ✅ Com ranking de usuários

## 🛠️ Solução de Problemas

### Se der erro de permissão:
```bash
sudo npm install canvas
```

### Se o bot não iniciar:
```bash
pm2 delete WDA-BOT
npm start
```

### Se o Canvas não funcionar:
```bash
# Verificar instalação
node -e "console.log(require('canvas'))"

# Reinstalar completamente
npm uninstall canvas
npm install canvas
```

## 📊 Estrutura Final

### package.json (já atualizado)
```json
{
  "dependencies": {
    "canvas": "^2.11.2",
    // ... outras dependências
  }
}
```

### Funcionalidades Habilitadas
- ✅ Cards visuais 934×282
- ✅ Leaderboard visual 934×800  
- ✅ 5 temas de cards
- ✅ Integração com loja
- ✅ Sistema completo de XP

## 🎯 Comandos Finais para Teste

```bash
# No servidor
pm2 restart WDA-BOT
pm2 logs WDA-BOT --lines 10

# No Discord
/rank view
/rank cards action:view
/rank cards action:select card:gold
/rank view
/leaderboard
```

## ✅ Resultado Esperado

Após executar os comandos acima:
- ✅ Bot inicia sem erros
- ✅ `/rank view` gera card visual
- ✅ `/leaderboard` gera ranking visual
- ✅ Cards com temas funcionam
- ✅ Sistema completo operacional

**🚀 Execute os comandos no servidor e os cards estarão funcionando!**
