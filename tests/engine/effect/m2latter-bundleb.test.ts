// M2 後半 batch (2026-07-10): bundle B — Cost 新 kind 2 + on-set-host rider walk + area union の TDD probe。
//   P12: Cost selfLpDeltaTurn — 〚ターン終了時までLP-2する〛(B06003 毛利蘭＆江戸川コナン a1)。
//        canPay 恒真 (LP 下限なし rules/19、公式Q&A: LP1以下でも支払可)。pay = lpMod_turn 書込 (emit なし —
//        rules/21 コストで行ったことは「効果によって」条件を満たさない)。
//   P13: Cost removeFromHandDownTo — 〚手札が2枚になるまで手札をリムーブする〛(B08047 沖矢昴 a2)。
//        canPay 恒真 (公式Q&A: 手札2枚以下でも宣言可、その場合このコストは実質なし)。
//        pay = max(0, hand-n) 枚を viaCost で discardToRemove (hand:removed 非 emit)。
//   P14: on-set-host rider の leave:to-remove 発火 (B01057 a2) — host リムーブ時、host の faceUp setCards
//        の def が持つ scope:'on-set-host' + hook:'leave:to-remove' triggered を queue する
//        (handleLeaveToRemoveSelf は従来 host 印字 abilities のみ走査 = 残 gap)。
//        Q&A: 2枚セット→2つ発動 / 裏向きセットは不発 / デッキ下移動 (リムーブでない) は不発。
//   P15: TargetQuery.area 配列 (hand∪remove union) — 「手札かリムーブエリアにある」1 pick (PR234 a1)。
//        charSetCard cardIds branch の source-splice も union 対応。
// rules: 19/21 (cost) / 16/17 (set + 現場リムーブ時) / 15。grounding = specs/grounding/{B06003,B08047,B01057,PR234}.md。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { candidates } from '@/engine/target/candidates';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { char as readChar } from '@/engine/read/char';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import type { CardDef, GameState, EffectCtx, Cost } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['赤'], level: 5, ap: 4000, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const FILLER: CardDef = { id: 'FILLER', no: 'FILLER', kind: 'character', names: ['埋'], colors: ['赤'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const EV_H: CardDef = { id: 'EV_H', no: 'EV_H', kind: 'event', names: ['手札イベ'], colors: ['白'], level: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
const EV_R: CardDef = { id: 'EV_R', no: 'EV_R', kind: 'event', names: ['リムイベ'], colors: ['白'], level: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
// B01057 形: on-set-host rider (leave:to-remove) を持つイベント
const RIDER_EV: CardDef = {
  id: 'RIDER_EV', no: 'RIDER_EV', kind: 'event', names: ['出会いたくない形'], colors: ['白'], level: 3,
  traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'set_t1', type: 'triggered', scope: 'on-set-host',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '【現場リムーブ時】カードを1枚引く。', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
beforeEach(() => {
  resetDefRegistry(); _resetUidCounter(); event._resetRegistry(); _resetTriggeredRegistered();
  for (const d of [HOST, FILLER, EV_H, EV_R, RIDER_EV]) registerCardDef(d);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('P12: Cost selfLpDeltaTurn (B06003 a1)', () => {
  const COST = { kind: 'selfLpDeltaTurn', delta: -2 } as unknown as Cost;
  it('canPay 恒真 (LP 下限なし — LP1 でも支払可)', () => {
    const s = base(); const ctx = ctxFor(s);
    expect(canPay(s, COST, ctx)).toBe(true);
  });
  it('pay で lpMod_turn が乗る (実効 LP 3→1)、hook emit なし', () => {
    const s = base(); const ctx = ctxFor(s);
    const uid = ctx.source.uid as string;
    let anyEmit = 0;
    event.on('char:lp-modified' as never, () => { anyEmit++; });
    pay(s, COST, ctx);
    expect(readChar.lp(s, uid)).toBe(1);
    expect(anyEmit).toBe(0);
  });
  it('ターン終了 (clearTurnEffects 窓) で失効 — lpMod_turn scope', () => {
    const s = base(); const ctx = ctxFor(s);
    const uid = ctx.source.uid as string;
    pay(s, COST, ctx);
    mutate.char.clearTurnEffects(s, uid, 'turn');
    expect(readChar.lp(s, uid)).toBe(3);
  });
});

describe('P13: Cost removeFromHandDownTo (B08047 a2)', () => {
  const COST = { kind: 'removeFromHandDownTo', n: 2 } as unknown as Cost;
  it('canPay 恒真 (手札 0/1/2 枚でも宣言可)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = [];
    expect(canPay(s, COST, ctx)).toBe(true);
    s.players.self.hand = ['EV_H'];
    expect(canPay(s, COST, ctx)).toBe(true);
  });
  it('手札4 → pay で 2 枚リムーブ (hand 2 残)、hand:removed 非 emit (viaCost)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['EV_H', 'EV_R', 'FILLER', 'HOST'];
    let removedEmit = 0;
    event.on('hand:removed' as never, () => { removedEmit++; });
    pay(s, COST, ctx);
    expect(s.players.self.hand.length).toBe(2);
    expect(s.players.self.remove.length).toBe(2);
    expect(removedEmit).toBe(0);
  });
  it('手札2以下 → pay は no-op 成功', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['EV_H'];
    pay(s, COST, ctx);
    expect(s.players.self.hand).toEqual(['EV_H']);
    expect(s.players.self.remove.length).toBe(0);
  });
});

describe('P14: on-set-host rider leave:to-remove (B01057 a2)', () => {
  function hostWithSet(draft: GameState, entries: { cardId: string; faceUp: boolean }[]): string {
    const c = mutate.scene.enter(draft, 'self', 'HOST', {});
    for (const e of entries) mutate.char.setCard(draft, c.uid, e.cardId, e.faceUp);
    return c.uid;
  }
  // rider entry の識別: HOST は printed abilities 0 のため、leave:to-remove hook で queue された
  // entry = rider のみ (normalizeSource は abilityId を持たない — 全 triggered entry 共通の設計)。
  function riderEntries(s: GameState) {
    return s.pendingEffects.filter(pe => pe.triggeredBy.hook === 'leave:to-remove');
  }
  it('host リムーブで faceUp set rider が queue される (source = host)', () => {
    registerTriggeredListener();
    const after = produce(base(), (draft) => {
      const uid = hostWithSet(draft, [{ cardId: 'RIDER_EV', faceUp: true }]);
      mutate.scene.removeToRemove(draft, uid, 'effect');
    });
    const riders = riderEntries(after);
    expect(riders).toHaveLength(1);
    expect(riders[0]?.source?.cardId).toBe('HOST');
    expect(riders[0]?.effect).toEqual({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });
  it('2枚セット → 2つ発動 (公式Q&A、entry 単位)', () => {
    registerTriggeredListener();
    const after = produce(base(), (draft) => {
      const uid = hostWithSet(draft, [{ cardId: 'RIDER_EV', faceUp: true }, { cardId: 'RIDER_EV', faceUp: true }]);
      mutate.scene.removeToRemove(draft, uid, 'effect');
    });
    expect(riderEntries(after)).toHaveLength(2);
  });
  it('裏向きセットは不発 (rules/16 — 裏向きはカードとして扱われない)', () => {
    registerTriggeredListener();
    const after = produce(base(), (draft) => {
      const uid = hostWithSet(draft, [{ cardId: 'RIDER_EV', faceUp: false }]);
      mutate.scene.removeToRemove(draft, uid, 'effect');
    });
    expect(riderEntries(after)).toHaveLength(0);
  });
  it('デッキ下移動はリムーブでない → 不発 (rules/17)', () => {
    registerTriggeredListener();
    const after = produce(base(), (draft) => {
      const uid = hostWithSet(draft, [{ cardId: 'RIDER_EV', faceUp: true }]);
      mutate.scene.toDeck(draft, uid, 'bottom');
    });
    expect(riderEntries(after)).toHaveLength(0);
  });
});

describe('P15: TargetQuery.area 配列 union (PR234 a1)', () => {
  it('hand∪remove を 1 pick で列挙 (両 zone 横断)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['EV_H', 'FILLER'];
    s.players.self.remove = ['EV_R'];
    const out = candidates(s, {
      kind: 'pick', query: { area: ['hand', 'remove'], side: 'self', filter: { kind: 'event' } },
      n: { min: 0, max: 1 }, chooser: 'self',
    } as never, ctx);
    expect(out.map(c => (c as { cardId?: string }).cardId).sort()).toEqual(['EV_H', 'EV_R']);
  });
  it('同一 cardId 両 zone 併存 → 配列順の先着 zone (remove 先) から消費 (edge lens 最小緩和 pin)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['EV_H'];
    s.players.self.remove = ['EV_H'];
    runAtom(s, 'charSetCard' as never, {
      uid: ctx.source.uid, cardIds: ['EV_H'], faceUp: true,
      target: { kind: 'pick', query: { area: ['remove', 'hand'], side: 'self', filter: { kind: 'event' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    }, ctx);
    expect(s.players.self.remove).toEqual([]); // remove 先消費 (所有者有利側)
    expect(s.players.self.hand).toEqual(['EV_H']); // hand は不変
    expect(s.players.self.scene[0].setCards[0]).toEqual({ cardId: 'EV_H', faceUp: true });
  });
  it('charSetCard cardIds branch の source-splice も union 対応 (hand 側から消費)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.hand = ['EV_H'];
    s.players.self.remove = ['EV_R'];
    runAtom(s, 'charSetCard' as never, {
      uid: ctx.source.uid, cardIds: ['EV_H'], faceUp: true,
      target: { kind: 'pick', query: { area: ['hand', 'remove'], side: 'self', filter: { kind: 'event' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    }, ctx);
    expect(s.players.self.hand).toEqual([]);
    expect(s.players.self.remove).toEqual(['EV_R']); // remove 側は不変
    expect(s.players.self.scene[0].setCards[0]).toEqual({ cardId: 'EV_H', faceUp: true });
  });
});
