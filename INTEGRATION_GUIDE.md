# Guia de Integração e Auditoria — Sistema VIP 2.0

## 📋 Overview
Este documento descreve a arquitetura modular (SOA), hooks, logs multicamadas e onboarding implementados. O objetivo é garantir que o sistema seja auditável, extensível e coeso.

---

## 🧩 1. Arquitetura Orientada a Serviços (SOA)

### Serviços Centrais
- **vipService**: Lógica de negócio (CRUD VIP, hooks, estado).
- **vipConfig**: Configuração de tiers por guild.
- **economyService**: Economia (moedas, bônus, transações).
- **logManager**: Logs segmentados (STAFF, USER, ECONOMY, SYSTEM).
- **vipOnboarding**: Boas-vindas e anúncios de novos VIPs.
- **vipRoleManager**: Criação/gerenciamento de cargos personalizados.
- **vipChannelManager**: Canais privados VIP.
- **vipExpiryManager**: Limpeza automática de VIPs expirados.

### Ponto de Entrada Único
```js
// src/services/index.js
const services = await initializeServices(client);
// client.services agora expõe todos os módulos
```

---

## 🔗 2. Hooks e Interoperabilidade

### Tipos de Hooks
- **onAdd**: Disparado quando um VIP é adicionado (manual ou compra).
- **onRemove**: Disparado quando um VIP é removido (manual ou expiração).
- **onExpire**: Disparado apenas quando um VIP expira por tempo.

### Fluxo de Integração
```
vipService.addVip() → runHooks('onAdd') → vipHooks.onAdd()
   ├─ onboarding (anúncio/DM/efeitos)
   ├─ logManager (STAFF ou ECONOMY)
   └─ economyService (bônus inicial)
```

### Registrando Hooks
```js
vipService.addHook('onAdd', async (payload) => { /* custom */ });
```

---

## 📊 3. Sistema de Logs Multicamadas

### Canais
- **STAFF**: Ações de admin (add/remove VIP, reset configs).
- **USER**: Ações do VIP (trocar cor, gerenciar família, etc).
- **ECONOMY**: Compras, resgates, bônus.
- **SYSTEM**: Erros críticos da API/banco.

### Configuração
```js
/logs set tipo:staff canal:#logs-staff
/logs set tipo:economy canal:#logs-economy
/logs announce canal:#anuncios
/logs test
```

### Exemplo de Embed de Log
```
🛡️ Ação de Staff: VIP_ADDED
Usuário: @User (123)
Staff: @Admin (456)
Servidor: Meu Servidor
Ação: VIP_ADDED | Método: manual | Duração: 30 dias
Tier: Gold
ID da Transação: VIP_1714XXXXXX_123
```

---

## 🎉 4. Módulo de Onboarding VIP

### Ações Automáticas
1. **Anúncio Global** (canal configurado ou systemChannel)
   - Embed luxuoso com avatar, tier, duração e bônus.
2. **DM de Boas-Vindas**
   - Guia de uso: `/vip panel`, economia, família, 2º cargo.
3. **Mensagem no Canal Privado VIP**
   - Instruções rápidas e convite para usar o painel.
4. **Efeito Visual**
   - Reações aleatórias (👑🔥💎✨🎉) nas mensagens do novo VIP por 10 min.

### Personalização
- Cor do embed baseada em `tier.cor_exclusiva`.
- Ícone aleatório da lista `VIP_EMOJIS`.

---

## 🛠️ 5. Comandos de Administração e Debug

### Novos Comandos
- `/vipadmin list`: Lista VIPs ativos do servidor.
- `/logs set`: Configura canais de logs por tipo.
- `/logs announce`: Define canal de anúncios.
- `/vipservice report`: Relatório completo de VIPs.
- `/vipservice expire`: Força expiração (debug).

### Comandos Refatorados
- `/vipadmin add/remove`: Agora delegam lógica ao `vipService` (SOA).
- `/shop vip`: Usa hooks automáticos para onboarding e logs.
- `/vipbuy`: Usa hooks automáticos.

---

## 🔧 6. Inicialização e Registro

### Exemplo no `index.js` do bot
```js
const { initializeServices } = require('./services');
await initializeServices(client);

// Registrar eventos de erro para logManager
client.on('error', (err) => require('./events/error').execute(err, client));
process.on('unhandledRejection', (err, p) => require('./events/unhandledRejection').execute(err, p, client));
process.on('uncaughtException', (err) => require('./events/uncaughtException').execute(err, client));
```

### Registro de Comandos
- Use seu script `registrar.js` para registrar os novos comandos (`logs`, `vipservice`, `vipadmin` atualizado).

---

## 🧪 7. Testes e Validação

### Checklist
- [ ] Canais de logs configurados via `/logs set`.
- [ ] Anúncios aparecem no canal certo ao adicionar VIP.
- [ ] DM de boas-vindas é enviada (mesmo com DMs fechadas, não deve quebrar).
- [ ] Efeito visual (reações) funciona por 10 minutos.
- [ ] Logs de STAFF e ECONOMY aparecem separados.
- [ ] Erros críticos são logados no canal SYSTEM.
- [ ] `/vipadmin list` mostra VIPs com expiração correta.
- [ ] Compra via `/shop` dispara onboarding e log ECONOMY.

---

## 📦 8. Estrutura de Arquivos Nova

```
src/
├─ services/
│  ├─ index.js           # initializeServices
│  ├─ logManager.js      # logs multicamadas
│  ├─ vipOnboarding.js   # boas-vindas
│  └─ vipHooks.js        # hooks (onAdd/onRemove/onExpire)
├─ commands/
│  ├─ logs.js            # configuração de canais de log
│  ├─ vipservice.js      # debug/utilitários
│  └─ vipadmin.js        # refatorado (SOA)
├─ events/
│  ├─ error.js
│  ├─ unhandledRejection.js
│  └─ uncaughtException.js
└─ vip/
   └─ vipService.js      # com hooks
```

---

## 🚀 9. Próximos Passos (Opcional)

- **Dashboard Web**: Exibir logs e relatórios via interface.
- **API de Webhooks**: Notificar sistemas externos sobre eventos VIP.
- **Cache em Memória**: Otimizar leituras de tiers/configs.
- **Testes Automatizados**: Cobertura para hooks e logs.

---

## 📌 Resumo

- **SOA**: Comandos não têm lógica; apenas delegam a serviços.
- **Hooks**: Permitem extensão sem modificar código core.
- **Logs**: Auditoria completa e separada por tipo.
- **Onboarding**: Experiência memorável para novos VIPs.
- **Debug**: Comandos para testes e manutenção.

O sistema agora é **auditável, extensível e coeso**, pronto para produção e evolução.
