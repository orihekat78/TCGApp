// 10-engine-stub.jsx
// Minimal in-browser engine stub for the prototype. Implements just enough
// behavior to make the meta + match flow feel alive without requiring the
// real TypeScript engine. Stores data in localStorage so state survives
// reloads.
//
// Implements roughly the subset documented in C-engine-ui-map.md:
//   - cards.validateDeck(deck)
//   - cards.all() / cards.byNum(num)
//   - decks.list() / save() / delete()
//   - history.list() / record()
//   - flow.simulateMatch(p1Deck, p2Deck, opts) — returns a synthetic match result
//
// This is intentionally NOT the real engine. The real engine lives in
// conan/src/engine/ and is TypeScript. This stub lets the prototype demo
// "real" flows (deck validation, match summary, history accumulation).

const STORAGE_KEYS = {
  DECKS:    'conan.proto.decks',
  HISTORY:  'conan.proto.history',
  SETTINGS: 'conan.proto.settings',
  PROGRESS: 'conan.proto.progress',
};

function _readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function _writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

// ── cards namespace ───────────────────────────────────────────────────
const stubCards = {
  all() { return window.CARD_POOL; },
  byNum(num) { return window.CARD_POOL.find((c) => c.num === num); },
  validateDeck(deck) {
    const errors = [];
    const warnings = [];
    if (!deck || !Array.isArray(deck.cards)) {
      return { ok: false, errors: ['デッキデータが不正です'], warnings: [] };
    }
    // 1. partner check
    const partner = window.CARD_POOL.find((c) => c.num === deck.partner);
    if (!partner) errors.push('パートナーが指定されていません');
    else if (partner.type !== 'partner') errors.push('パートナー枠にパートナー以外のカードが指定されています');

    // 2. total = 40 exactly
    const total = deck.cards.reduce((s, e) => s + e.count, 0);
    if (total !== 40) {
      errors.push(`枚数違反: ${total}/40 ${total < 40 ? `(${40 - total} 枚不足)` : `(${total - 40} 枚超過)`}`);
    }

    // 3. each card count ≤ 3 (same cardId)
    for (const entry of deck.cards) {
      if (entry.count > 3) {
        const card = window.CARD_POOL.find((c) => c.num === entry.num);
        errors.push(`同名カード上限超過: ${card?.name || entry.num} ×${entry.count}(上限 3)`);
      }
      if (entry.count < 1) {
        errors.push(`枚数 0 のエントリ: ${entry.num}`);
      }
    }

    // 4. no partner/case in deck slot
    for (const entry of deck.cards) {
      const card = window.CARD_POOL.find((c) => c.num === entry.num);
      if (card?.type === 'partner') {
        errors.push(`デッキにパートナーは入れられません: ${card.name}`);
      }
    }

    // 5. warnings (non-fatal)
    const eventCount = deck.cards.reduce((s, e) => {
      const c = window.CARD_POOL.find((x) => x.num === e.num);
      return c?.type === 'event' ? s + e.count : s;
    }, 0);
    if (eventCount === 0) warnings.push('イベントカード 0 枚 — 緊急時のリソースが不足する可能性');

    return { ok: errors.length === 0, errors, warnings, total };
  },
};

// ── decks namespace ───────────────────────────────────────────────────
const stubDecks = {
  list() {
    const stored = _readJSON(STORAGE_KEYS.DECKS, null);
    if (stored) return stored;
    // Seed with SAMPLE_DECK on first run
    const initial = [{ id: 'seed-1', ...window.SAMPLE_DECK, modified: Date.now() }];
    _writeJSON(STORAGE_KEYS.DECKS, initial);
    return initial;
  },
  save(deck) {
    const list = stubDecks.list();
    const idx = list.findIndex((d) => d.id === deck.id);
    if (idx >= 0) list[idx] = { ...deck, modified: Date.now() };
    else list.push({ ...deck, id: deck.id || `deck-${Date.now()}`, modified: Date.now() });
    _writeJSON(STORAGE_KEYS.DECKS, list);
    return list;
  },
  delete(id) {
    const list = stubDecks.list().filter((d) => d.id !== id);
    _writeJSON(STORAGE_KEYS.DECKS, list);
    return list;
  },
};

// ── history namespace ─────────────────────────────────────────────────
const stubHistory = {
  list() {
    return _readJSON(STORAGE_KEYS.HISTORY, []);
  },
  record(match) {
    const list = stubHistory.list();
    list.unshift({ ...match, id: match.id || `m-${Date.now()}`, recorded: Date.now() });
    // Cap to 200
    if (list.length > 200) list.length = 200;
    _writeJSON(STORAGE_KEYS.HISTORY, list);
    return list;
  },
  winRate(deckName) {
    const list = stubHistory.list().filter((m) => !deckName || m.deck === deckName);
    if (list.length === 0) return { rate: 0, wins: 0, total: 0 };
    const wins = list.filter((m) => m.won).length;
    return { rate: Math.round((wins / list.length) * 100), wins, total: list.length };
  },
};

// ── flow namespace — match simulation ─────────────────────────────────
const stubFlow = {
  simulateMatch({ p1Deck, p2Deck, mode = 'solo', difficulty = '標準', seed, firstPlayer = 'p1' } = {}) {
    // RNG seeded from seed (or Date.now()) so we can reproduce
    const s = seed || Date.now();
    let rng = s;
    const r = () => { rng = (rng * 1664525 + 1013904223) % 4294967296; return rng / 4294967296; };

    // Official rules (rules/01-victory-conditions.md): 先攻 7 / 後攻 6
    const p1Target = firstPlayer === 'p1' ? 7 : 6;
    const p2Target = firstPlayer === 'p2' ? 7 : 6;

    // Compute deck "strength" from cost curve + AP total
    const strength = (deck) => {
      if (!deck) return 50;
      let total = 0, count = 0, avg_ap = 0;
      for (const e of deck.cards || []) {
        const card = window.CARD_POOL.find((c) => c.num === e.num);
        if (!card) continue;
        if (card.cost != null) { total += card.cost * e.count; count += e.count; }
        if (card.ap) avg_ap += card.ap * e.count;
      }
      const avgCost = count > 0 ? total / count : 3.5;
      const apScore = avg_ap / 1000;
      return 30 + (8 - Math.abs(avgCost - 3.8)) * 5 + apScore;
    };

    const s1 = strength(p1Deck);
    const s2 = strength(p2Deck);
    const diffBias = { '初級': -20, '標準': 0, '上級': 20 }[difficulty] || 0;

    // Win probability with random jitter
    const p1Score = s1 + r() * 30 - 15;
    const p2Score = s2 + diffBias + r() * 30 - 15;
    const won = p1Score >= p2Score;

    const turns = 7 + Math.floor(r() * 8); // 7-14
    const durationSec = turns * 70 + Math.floor(r() * 60);
    const contacts = Math.floor(r() * 5) + 2;
    const hirameki = Math.floor(r() * 4);
    const misread = won ? 0 : Math.floor(r() * 3);
    const evidGot = won ? p1Target : Math.floor(r() * (p1Target - 1)) + 1;
    const evidLost = won ? Math.floor(r() * (p2Target - 1)) + 1 : p2Target;
    const targetEv = p1Target; // P1 視点の必要証拠数

    // Pick MVP from p1's chars
    const candidates = (p1Deck?.cards || [])
      .map((e) => window.CARD_POOL.find((c) => c.num === e.num))
      .filter((c) => c && c.type === 'character' && c.ap);
    const mvp = candidates[Math.floor(r() * candidates.length)] || candidates[0];

    return {
      id: `m-${s}`,
      won, mode, difficulty, firstPlayer,
      deck: p1Deck?.name || '名称未設定',
      opp:  p2Deck?.name || 'CPU 標準',
      partnerNum: p1Deck?.partner,
      oppPartnerNum: p2Deck?.partner,
      turns,
      dur: `${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`,
      durationSec,
      contacts,
      hirameki,
      misread,
      evidGot, evidLost, targetEv, p1Target, p2Target,
      mvp: mvp?.name || '—',
      mvpNum: mvp?.num,
      highlight: won && hirameki >= 2 ? 'MVP' : won && turns <= 7 ? 'FAST' : !won && misread >= 2 ? 'MISDIR' : !won && evidGot >= 3 ? 'CLOSE' : '',
      date: new Date().toLocaleString('ja-JP'),
      seed: s,
    };
  },
};

// ── settings + progress ──────────────────────────────────────────────
const stubSettings = {
  get() { return _readJSON(STORAGE_KEYS.SETTINGS, { theme: 'classic', speed: 1.0, density: 'high' }); },
  set(patch) {
    const cur = stubSettings.get();
    const next = { ...cur, ...patch };
    _writeJSON(STORAGE_KEYS.SETTINGS, next);
    return next;
  },
};

const stubProgress = {
  get() { return _readJSON(STORAGE_KEYS.PROGRESS, { chapter: 3, step: 6, tutorialDone: [1, 2] }); },
  set(patch) {
    const next = { ...stubProgress.get(), ...patch };
    _writeJSON(STORAGE_KEYS.PROGRESS, next);
    return next;
  },
};

// ── Public engine stub ────────────────────────────────────────────────
window.engineStub = {
  cards:    stubCards,
  decks:    stubDecks,
  history:  stubHistory,
  flow:     stubFlow,
  settings: stubSettings,
  progress: stubProgress,
  STORAGE_KEYS,
};
