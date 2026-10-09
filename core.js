
/* Inselwürfel – pure rules & session state. No external dependencies. */
(function (scope) {
  'use strict';
  const MODES = Object.freeze({
    base: { label: 'Grundspiel', sub: 'Die klassische Partie', event: false, sea: false },
    seafarers: { label: 'Seefahrer', sub: 'Entdeckt neue Inseln', event: false, sea: true },
    cities: { label: 'Städte & Ritter', sub: 'Fortschritt und Barbaren', event: true, sea: false },
    combined: { label: 'Seefahrer + Städte & Ritter', sub: 'Beide Erweiterungen', event: true, sea: true }
  });
  const EVENTS = ['ship', 'ship', 'ship', 'science', 'politics', 'trade'];
  const EVENT_LABELS = Object.freeze({ ship: 'Barbarenschiff', science: 'Wissenschaft', politics: 'Politik', trade: 'Handel' });
  const COLOR_NAMES = ['rot', 'blau', 'orange', 'grün', 'violett', 'türkis'];

  function die(randomFn) {
    if (randomFn) return Math.floor(randomFn() * 6) + 1;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const max = 4294967296, limit = max - (max % 6);
      const bits = new Uint32Array(1);
      do { crypto.getRandomValues(bits); } while (bits[0] >= limit);
      return (bits[0] % 6) + 1;
    }
    return Math.floor(Math.random() * 6) + 1;
  }
  function makeId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }
  function createRoom({ code, name, title, mode, maxPlayers, playerId }) {
    if (!MODES[mode]) throw new Error('Unbekannter Spielmodus');
    return {
      version: 1, code, title: String(title || 'Unser Spieleabend').slice(0, 36), mode,
      maxPlayers: Math.max(2, Math.min(6, Number(maxPlayers) || 4)),
      started: false, createdAt: Date.now(), players: [{ id: playerId, name: String(name || 'Gastgeber').slice(0, 22), color: COLOR_NAMES[0], online: true, points: 0 }],
      history: [], barbarianSteps: 0, attackPending: false, attacks: 0, attackResetAt: 0
    };
  }
  function setPoints(state, playerId, nextPoints) {
    const p=state.players.find(p=>p.id===playerId);
    if(!p)throw new Error('Spieler nicht gefunden');
    const score=Number(nextPoints);
    if(!Number.isInteger(score)||score<0||score>99)throw new Error('Punkte müssen zwischen 0 und 99 liegen');
    p.points=score;
    return score;
  }
  function roll(state, playerId, randomFn) {
    if (!state.started) throw new Error('Das Spiel wurde noch nicht gestartet');
    if (state.attackPending) throw new Error('Zuerst den Barbarenangriff abschließen');
    if (!state.players.some(p => p.id === playerId)) throw new Error('Spieler nicht gefunden');
    const red = die(randomFn), white = die(randomFn);
    const event = MODES[state.mode].event ? EVENTS[die(randomFn) - 1] : null;
    const beforeSteps = state.barbarianSteps;
    const beforePending = state.attackPending;
    if (event === 'ship') {
      state.barbarianSteps = Math.min(7, state.barbarianSteps + 1);
      if (state.barbarianSteps === 7) state.attackPending = true;
    }
    const entry = { id: makeId(), playerId, red, white, sum: red + white, event, ts: Date.now(), beforeSteps, beforePending };
    state.history.push(entry);
    return entry;
  }
  function resolveAttack(state) {
    if (!state.attackPending) throw new Error('Noch kein Barbarenangriff');
    state.attackPending = false;
    state.barbarianSteps = 0;
    state.attacks += 1;
    state.attackResetAt = state.history.length;
  }
  function undo(state) {
    if (state.history.length <= state.attackResetAt) throw new Error('Nach abgeschlossenem Angriff ist kein Zurücknehmen möglich');
    const entry = state.history.pop();
    state.barbarianSteps = entry.beforeSteps;
    state.attackPending = entry.beforePending;
    return entry;
  }
  function stats(history, playerId) {
    const rolls = playerId === 'all' || !playerId ? history : history.filter(r => r.playerId === playerId);
    const sums = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i + 2, 0]));
    const events = { ship: 0, science: 0, politics: 0, trade: 0 };
    rolls.forEach(r => { if (sums[r.sum] !== undefined) sums[r.sum] += 1; if (events[r.event] !== undefined) events[r.event] += 1; });
    return { total: rolls.length, sums, events, most: Object.entries(sums).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0] };
  }
  scope.CatanCore = { MODES, EVENT_LABELS, EVENTS, COLOR_NAMES, die, makeId, createRoom, setPoints, roll, resolveAttack, undo, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = scope.CatanCore;
})(typeof window !== 'undefined' ? window : globalThis);

