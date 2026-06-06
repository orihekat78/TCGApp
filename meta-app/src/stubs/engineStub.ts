// spec: .claude/specs/meta-ui/05-engine-stub.md
// engineStub — 本物 engine 非依存の localStorage-backed フェイク API
// 原典: design-mockups_v2/10-engine-stub.jsx

import type { CardDef, DeckRecord, MatchRecord, ValidationResult } from '../data/types';
import { CARD_POOL } from '../data/cardPool';
import { useDecksStore } from '../state/decksStore';
import { useHistoryStore } from '../state/historyStore';
import { useMetaStore, type Settings } from '../state/metaStore';

// ── cards ───────────────────────────────────────────────────────────
const cards = {
  all(): readonly CardDef[] {
    return CARD_POOL;
  },
  byNum(num: string): CardDef | undefined {
    return CARD_POOL.find((c) => c.num === num);
  },
  validateDeck(deck: DeckRecord): ValidationResult {
    const errors: string[] = [];
    if (!deck || !Array.isArray(deck.cards)) {
      return { ok: false, errors: ['デッキデータが不正です'] };
    }

    const partner = CARD_POOL.find((c) => c.num === deck.partner);
    if (!partner) errors.push('パートナーが指定されていません');
    else if (partner.type !== 'partner') errors.push('パートナー枠にパートナー以外のカードが指定されています');

    // 事件は 1 デッキ 1 枚必須 (rules/02: パートナー1+事件1+キャラ/イベント40)。
    const caseCard = CARD_POOL.find((c) => c.num === deck.case);
    if (!deck.case) errors.push('事件が指定されていません');
    else if (!caseCard) errors.push('事件カードが見つかりません');
    else if (caseCard.type !== 'case') errors.push('事件枠に事件以外のカードが指定されています');

    const total = deck.cards.reduce((s, e) => s + e.count, 0);
    if (total !== 40) {
      const diff = total < 40 ? `(${40 - total} 枚不足)` : `(${total - 40} 枚超過)`;
      errors.push(`枚数違反: ${total}/40 ${diff}`);
    }

    // 同一 cardId (パラレル) を合算して 3 枚上限を判定する。
    // rules/02-deck-construction.md「絵柄が違っても ID が同じであれば同じカード」。
    // cardNum 単位で数えると D08003×3 + D08004×3 (= 同 cardId 0489 を 6 枚) が通ってしまう。
    const idAgg = new Map<string, { total: number; name: string; nums: Set<string> }>();
    for (const entry of deck.cards) {
      if (entry.count < 1) {
        errors.push(`枚数 0 のエントリ: ${entry.num}`);
      }
      const card = CARD_POOL.find((c) => c.num === entry.num);
      // 存在しないカード番号 (デッキコード import 等) は拒否する。
      if (!card) {
        errors.push(`未知のカード: ${entry.num}`);
        continue;
      }
      // デッキにはキャラ/イベントのみ。パートナーと事件は入れられない (rules/02)。
      if (card.type === 'partner') {
        errors.push(`デッキにパートナーは入れられません: ${card.name}`);
      }
      if (card.type === 'case') {
        errors.push(`デッキに事件は入れられません: ${card.name}`);
      }
      const id = card.id;
      const agg = idAgg.get(id) ?? { total: 0, name: card.name, nums: new Set<string>() };
      agg.total += entry.count;
      agg.nums.add(entry.num);
      idAgg.set(id, agg);
    }
    for (const agg of idAgg.values()) {
      if (agg.total > 3) {
        const variants = agg.nums.size > 1 ? ` (${[...agg.nums].join('+')})` : '';
        errors.push(`同 ID 上限超過: ${agg.name}${variants} ×${agg.total} (上限 3)`);
      }
    }

    return { ok: errors.length === 0, errors };
  },
};

// ── decks (zustand store wrapper) ───────────────────────────────────
const decks = {
  list(): DeckRecord[] {
    return useDecksStore.getState().decks;
  },
  byId(id: string): DeckRecord | undefined {
    return useDecksStore.getState().byId(id);
  },
  add(d: Omit<DeckRecord, 'modified'>): void {
    useDecksStore.getState().add(d);
  },
  update(id: string, patch: Partial<DeckRecord>): void {
    useDecksStore.getState().update(id, patch);
  },
  remove(id: string): void {
    useDecksStore.getState().remove(id);
  },
};

// ── history (zustand store wrapper) ─────────────────────────────────
const history = {
  list(): MatchRecord[] {
    return useHistoryStore.getState().list();
  },
  byId(id: string): MatchRecord | undefined {
    return useHistoryStore.getState().byId(id);
  },
  record(m: MatchRecord): void {
    useHistoryStore.getState().record(m);
  },
  winRate(deckName?: string) {
    return useHistoryStore.getState().winRate(deckName);
  },
};

// ── settings (zustand store wrapper) ────────────────────────────────
const settings = {
  get(): Settings {
    return useMetaStore.getState().settings;
  },
  set(patch: Partial<Settings>): void {
    useMetaStore.getState().setSettings(patch);
  },
};

// ── flow (pure simulation) ──────────────────────────────────────────
export interface SimulateParams {
  p1Deck: DeckRecord;
  p2Deck: DeckRecord;
  mode?: 'solo' | 'observe';
  difficulty?: '初級' | '標準' | '上級';
  seed?: number;
  firstPlayer?: 'p1' | 'p2';
}

const flow = {
  simulateMatch(params: SimulateParams): MatchRecord {
    const { p1Deck, p2Deck, mode = 'solo', difficulty = '標準', seed, firstPlayer = 'p1' } = params;
    const s = seed ?? Date.now();
    let rng = s;
    const r = (): number => {
      rng = (rng * 1664525 + 1013904223) % 4294967296;
      return rng / 4294967296;
    };

    // 公式: 先攻 7 / 後攻 6 (rules/01-victory-conditions.md, F-rule-audit 高優先度)
    const p1Target: 7 | 6 = firstPlayer === 'p1' ? 7 : 6;
    const p2Target: 7 | 6 = firstPlayer === 'p1' ? 6 : 7;

    const strength = (deck: DeckRecord): number => {
      let total = 0, count = 0, avgAp = 0;
      for (const e of deck.cards) {
        const card = CARD_POOL.find((c) => c.num === e.num);
        if (!card) continue;
        if (card.cost != null) { total += card.cost * e.count; count += e.count; }
        if (card.ap) avgAp += card.ap * e.count;
      }
      const avgCost = count > 0 ? total / count : 3.5;
      return 30 + (8 - Math.abs(avgCost - 3.8)) * 5 + avgAp / 1000;
    };

    const s1 = strength(p1Deck);
    const s2 = strength(p2Deck);
    const diffBias = ({ 初級: -20, 標準: 0, 上級: 20 } as const)[difficulty] ?? 0;

    const p1Score = s1 + r() * 30 - 15;
    const p2Score = s2 + diffBias + r() * 30 - 15;
    const won = p1Score >= p2Score;

    const turns = 7 + Math.floor(r() * 8);
    const durationSec = turns * 70 + Math.floor(r() * 60);
    const contacts = Math.floor(r() * 5) + 2;
    const hirameki = Math.floor(r() * 4);
    const misread = won ? 0 : Math.floor(r() * 3);
    const evidGot = won ? p1Target : Math.floor(r() * (p1Target - 1)) + 1;
    const evidLost = won ? Math.floor(r() * (p2Target - 1)) + 1 : p2Target;

    const candidates = p1Deck.cards
      .map((e) => CARD_POOL.find((c) => c.num === e.num))
      .filter((c): c is CardDef => !!c && c.type === 'character' && c.ap != null);
    const mvpCard = candidates.length > 0
      ? candidates[Math.floor(r() * candidates.length)]
      : undefined;

    return {
      id: `m-${s}`,
      recorded: Date.now(),
      won,
      mode,
      deckName: p1Deck.name,
      oppDeckName: p2Deck.name,
      turns,
      duration: durationSec * 1000,
      contacts,
      hirameki,
      misread,
      evidGot,
      evidLost,
      p1Target,
      p2Target,
      mvp: mvpCard?.num,
    };
  },
};

export const engineStub = {
  cards,
  decks,
  history,
  settings,
  flow,
} as const;
