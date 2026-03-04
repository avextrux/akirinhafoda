# 🚀 Instruções de Instalação do Canvas no Servidor

## 📋 Passos para Corrigir o Canvas

### 1. Conectar ao Servidor
```bash
ssh ubuntu@SEU_ENDERECO_DE_SERVIDOR
```

### 2. Navegar até o Projeto
```bash
cd /home/ubuntu/aushsfh
```

### 3. Instalar o Canvas
```bash
npm install canvas
```

### 4. Reiniciar o Bot
```bash
pm2 restart WDA-BOT
```

### 5. Verificar Status
```bash
pm2 logs WDA-BOT --lines 20
```

## 🔍 Verificação de Funcionamento

Após a instalação, teste os comandos:

### Testar Card Individual
```
/rank view
```
- ✅ Deve gerar imagem 934×282
- ✅ Com avatar, banner e métricas
- ✅ Com tema selecionado

### Testar Cards Personalizados
```
/rank cards action:view
/rank cards action:select card:premium
/rank view
```
- ✅ Deve mostrar cards possuídos
- ✅ Deve selecionar tema premium
- ✅ Deve aplicar gradiente azul

### Testar Leaderboard
```
/leaderboard
```
- ✅ Deve gerar imagem 934×800
- ✅ Com top 5 usuários
- ✅ Com banners e avatares

## 🛠️ Solução de Problemas

### Se o Canvas não instalar:
```bash
# Instalar dependências do sistema
sudo apt-get update
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

# Tentar instalar novamente
npm install canvas
```

### Se o bot não iniciar:
```bash
# Verificar logs
pm2 logs WDA-BOT --lines 50

# Reiniciar completamente
pm2 delete WDA-BOT
npm start
```

### Se os cards não funcionarem:
```bash
# Verificar se o Canvas está instalado
node -e "console.log(require('canvas'))"

# Testar localmente
node test_canvas_functionality.js
```

## 📊 Estrutura dos Cards

### Rank Card (934×282)
- **Fundo**: Gradiente do tema selecionado
- **Avatar**: Circular (50px raio)
- **Banner**: Personalizado se disponível
- **Texto**: Nome, nível, XP, mensagens, tempo em call
- **Barra**: Progresso com cor do tema

### Leaderboard (934×800)
- **Fundo**: Escuro profissional
- **Cabeçalho**: Título "🏆 Leaderboard"
- **Entradas**: Top 5 usuários com banners
- **Avatares**: Circulares com borda
- **Métricas**: XP, nível, mensagens, tempo

## 🎨 Temas Disponíveis

| Card | Preço | Gradiente | Cor do Nível |
|------|-------|-----------|--------------|
| Padrão | Grátis | #2c2f33 → #1a1a1a | #ffd700 |
| Premium | 500🪙 | #7289da → #4a5568 | #7289da |
| Gold | 750🪙 | #ffd700 → #ffb347 | #ffffff |
| Neon | 1000🪙 | #ff006e → #8338ec | #ff006e |
| Ocean | 600🪙 | #0077be → #00a8cc | #0077be |

## ✅ Resultado Esperado

Após a instalação correta:
- ✅ Bot inicia sem erros
- ✅ Comandos `/rank view` funcionam
- ✅ Comandos `/leaderboard` funcionam
- ✅ Cards com temas personalizados aplicados
- ✅ Sistema completo de loja + cards integrado

## 🎯 Comandos para Teste Final

```bash
# Testar todos os recursos
/rank view
/rank cards action:view
/rank cards action:select card:gold
/rank view
/leaderboard
/rank manage usuario:@SEU_USER action:add quantidade:100 motivo:"Teste"
```

**Execute estes passos e os cards estarão funcionando!** 🚀
