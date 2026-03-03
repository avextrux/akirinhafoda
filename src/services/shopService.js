const { createDataStore } = require("../store/dataStore");

function createShopService({ logger } = {}) {
  const store = createDataStore("shop.json");

  async function loadState() {
    const state = await store.load();
    return state && typeof state === "object" ? state : {};
  }

  async function saveState(state) {
    await store.save(state || {});
  }

  function ensureGuild(state, guildId) {
    state.guilds = state.guilds || {};
    state.guilds[guildId] = state.guilds[guildId] || {};
    const g = state.guilds[guildId];
    g.catalog = g.catalog || {};
    g.bank = g.bank || { balance: 0, staffWithdrawRoleId: null };
    g.grants = g.grants || {};
    g.ledger = g.ledger || [];
    return g;
  }

  function nowMs() {
    return Date.now();
  }

  function addLedger(g, entry) {
    const e = { ...entry, at: nowMs() };
    g.ledger.push(e);
    if (g.ledger.length > 200) g.ledger = g.ledger.slice(-200);
  }

  async function setStaffWithdrawRole(guildId, roleId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    g.bank.staffWithdrawRoleId = roleId || null;
    await saveState(state);
    return g.bank;
  }

  async function getBank(guildId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    return g.bank;
  }

  async function deposit(guildId, amount, meta = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return { ok: false };

    const state = await loadState();
    const g = ensureGuild(state, guildId);
    g.bank.balance = (g.bank.balance || 0) + value;
    addLedger(g, { type: "deposit", amount: value, ...meta });
    await saveState(state);
    return { ok: true, balance: g.bank.balance };
  }

  async function withdraw(guildId, amount, meta = {}) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: "invalid_amount" };

    const state = await loadState();
    const g = ensureGuild(state, guildId);
    const balance = g.bank.balance || 0;
    if (balance < value) return { ok: false, reason: "insufficient_bank" };

    g.bank.balance = balance - value;
    addLedger(g, { type: "withdraw", amount: value, ...meta });
    await saveState(state);
    return { ok: true, balance: g.bank.balance };
  }

  async function listItems(guildId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    return Object.values(g.catalog);
  }

  async function getItem(guildId, itemId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    return g.catalog[itemId] || null;
  }

  async function upsertItem(guildId, item) {
    if (!item?.id) return { ok: false, reason: "missing_id" };

    const state = await loadState();
    const g = ensureGuild(state, guildId);

    g.catalog[item.id] = {
      enabled: true,
      ...g.catalog[item.id],
      ...item,
      id: item.id,
    };

    await saveState(state);
    return { ok: true, item: g.catalog[item.id] };
  }

  async function removeItem(guildId, itemId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    const existed = !!g.catalog[itemId];
    delete g.catalog[itemId];
    await saveState(state);
    return { ok: true, existed };
  }

  async function registerGrant(guildId, grant) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    const id = grant.id || `grant_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    g.grants[id] = { ...grant, id };
    await saveState(state);
    return g.grants[id];
  }

  async function listGrants(guildId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    return Object.values(g.grants);
  }

  async function removeGrant(guildId, grantId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    const existed = !!g.grants[grantId];
    delete g.grants[grantId];
    await saveState(state);
    return { ok: true, existed };
  }

  async function getLedger(guildId) {
    const state = await loadState();
    const g = ensureGuild(state, guildId);
    return g.ledger || [];
  }

  return {
    setStaffWithdrawRole,
    getBank,
    deposit,
    withdraw,
    listItems,
    getItem,
    upsertItem,
    removeItem,
    registerGrant,
    listGrants,
    removeGrant,
    getLedger,
  };
}

module.exports = { createShopService };
