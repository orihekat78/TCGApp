// engine additive wave (2026-06-29d) — 5 つの純 additive primitive の挙動テスト。
//
// #1 sceneLpSum Condition — 「自分の現場のキャラ全員のLPの合計が n 以下/以上」(B06003 a2 ゲート)。
//    lpAtLeast(per-char .some) / sceneHas(枚数) では合算不可。負 LP も合計対象 (公式Q&A B06003)。
// #2 souza bind — 捜査X の「発見された」カードを ctx.bindings へ束ねる (B01084 「レベル5以上が
//    発見された場合」)。consumer は既存 boundMatchesFilter (bound[0]、捜査1=X1 で単一)。
// #3 charSetCard fromSelf — 使用イベント自身 (ctx.source.cardId) を remove から引き、自分の現場の
//    キャラ1枚に faceUp でセットする WRITE verb (B01023/B01057/B02013)。session70 on-set-host READ の
//    end-to-end 化。faceUp set ⇒ read.char.* が on-set-host rider を合算。
// #4 canCutIn action-scoped cutin ban — 「このキャラがアクションしたとき、アクション終了時まで相手は
//    【カットイン】を使用できない」(D02008/B05007)。継続 aura ではなく _action turnEffect フラグ。
//    write は既存 charSetTurnEffect、honor は canCutIn の 1 read のみ。clearTurnEffects('action') で清掃。
// #5 costRemovedMatches Condition (cost-path) — 「この【宣言】能力のコストによって〚X〛がリムーブ
//    された場合」(B03003/B04077/B06078)。removeDeckTop cost が除去 cardId を ctx.costPaid へ記録、
//    新 cond が matchOneFilter(c=null) で素性判定。
//
// いずれも既存登録カードは未宣言/未使用 ⇒ 挙動不変 (smoke baseline 不変)。専用テスト必須。
// rules: 11(推理/LP), 13(捜査/カットイン), 15(「まで」=0可/「する」必須), 16(セット), 19(LP下限なし),
//        21(コスト「自分の」省略), 22(アクション宣言タイミング), 08(アクション終了時まで)

import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { runAtom } from '@/engine/effect/index';
import { pay } from '@/engine/cost/pay';
import { canCutIn } from '@/engine/flow/contact';
import { read } from '@/engine/read/index';
import { char as mutateChar } from '@/engine/mutate/char';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition, Cost, ActionContext, EffectCtx } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

// ============================================================
// #1 sceneLpSum Condition
// ============================================================
describe('engine-additive-0629d #1 sceneLpSum', () => {
  function setup(): GameState {
    registerCardDef(ch('LP2', { lp: 2 }));
    registerCardDef(ch('LPm1', { lp: -1 }));
    registerCardDef(ch('LP0', { lp: 0 }));
    registerCardDef(ch('OPP9', { lp: 9 }));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('LP2', 's1'), sceneChar('LPm1', 's2'), sceneChar('LP0', 's3')]; // sum = 1
    s.players.opp.scene = [sceneChar('OPP9', 'o1')]; // decoy: 別 side
    return s;
  }
  const q = { area: 'scene', side: 'self' } as const;

  it('合計1 ≤ max:2 → true (負LPも合算)', () => {
    const s = setup();
    const cond = { kind: 'sceneLpSum', query: q, max: 2 } as unknown as Condition;
    expect(evalCond(s, cond, makeCtx())).toBe(true);
  });
  it('合計1 > max:0 → false', () => {
    const s = setup();
    const cond = { kind: 'sceneLpSum', query: q, max: 0 } as unknown as Condition;
    expect(evalCond(s, cond, makeCtx())).toBe(false);
  });
  it('decoy: opp 現場 (LP9) は self 集計に含まれない', () => {
    const s = setup();
    // self 合計は 1 のまま (opp の 9 を足すと 10>2 になるはず)。max:2 で true なら opp 不参入の証明
    const cond = { kind: 'sceneLpSum', query: q, max: 2 } as unknown as Condition;
    expect(evalCond(s, cond, makeCtx())).toBe(true);
  });
  it('min 比較子: 合計1 ≥ min:0 → true / ≥ min:5 → false', () => {
    const s = setup();
    expect(evalCond(s, { kind: 'sceneLpSum', query: q, min: 0 } as unknown as Condition, makeCtx())).toBe(true);
    expect(evalCond(s, { kind: 'sceneLpSum', query: q, min: 5 } as unknown as Condition, makeCtx())).toBe(false);
  });
  it('全負LP: [-1,-1] sum=-2 ≤ max:2 true / ≥ min:0 false', () => {
    registerCardDef(ch('LPm1', { lp: -1 }));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('LPm1', 'a'), sceneChar('LPm1', 'b')];
    expect(evalCond(s, { kind: 'sceneLpSum', query: q, max: 2 } as unknown as Condition, makeCtx())).toBe(true);
    expect(evalCond(s, { kind: 'sceneLpSum', query: q, min: 0 } as unknown as Condition, makeCtx())).toBe(false);
  });
});

// ============================================================
// #2 souza bind → boundMatchesFilter consumer
// ============================================================
describe('engine-additive-0629d #2 souza bind', () => {
  function setup(topCardId: string): GameState {
    registerCardDef(ch('HI', { level: 5 }));
    registerCardDef(ch('LO', { level: 4 }));
    registerCardDef(ch('PAD', { level: 1 }));
    const s = createEmptyGameState();
    s.players.opp.deck = [topCardId, 'PAD', 'PAD']; // souza は defender(opp) のデッキ
    return s;
  }

  it('捜査1 で発見した札を ctx.bindings へ束ねる + boundMatchesFilter で参照', () => {
    const s = setup('HI');
    const ctx = makeCtx();
    runAtom(s, 'souza', { x: 1, player: 'opp', bind: '$discovered' }, ctx);
    expect(ctx.bindings['$discovered']).toBeDefined();
    expect(ctx.bindings['$discovered'].length).toBe(1);
    const cond = { kind: 'boundMatchesFilter', bindKey: '$discovered', filter: { levelMin: 5 } } as Condition;
    expect(evalCond(s, cond, ctx)).toBe(true);
  });
  it('decoy: 発見札がレベル4 → boundMatchesFilter{levelMin:5} false', () => {
    const s = setup('LO');
    const ctx = makeCtx();
    runAtom(s, 'souza', { x: 1, player: 'opp', bind: '$discovered' }, ctx);
    const cond = { kind: 'boundMatchesFilter', bindKey: '$discovered', filter: { levelMin: 5 } } as Condition;
    expect(evalCond(s, cond, ctx)).toBe(false);
  });
  it('bind 未指定の souza は従来通り bind しない (回帰0)', () => {
    const s = setup('HI');
    const ctx = makeCtx();
    runAtom(s, 'souza', { x: 1, player: 'opp' }, ctx);
    expect(ctx.bindings['$discovered']).toBeUndefined();
  });
  it('デッキ0枚 souza は bind を作らない (no-op)', () => {
    const s = setup('HI');
    s.players.opp.deck = [];
    const ctx = makeCtx();
    runAtom(s, 'souza', { x: 1, player: 'opp', bind: '$discovered' }, ctx);
    const b = ctx.bindings['$discovered'];
    expect(b === undefined || b.length === 0).toBe(true);
  });
});

// ============================================================
// #3 charSetCard fromSelf (used-event self-set, faceUp, from remove)
// ============================================================
describe('engine-additive-0629d #3 charSetCard fromSelf', () => {
  // 装備イベント EVT: on-set-host continuous で host を AP+2000 (B01023 型の rider)
  const EVT: CardDef = {
    id: 'EVT', no: '9/EVT', kind: 'event', names: ['EVT'], colors: ['白'], level: 2, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [{ id: 'rider', type: 'continuous', scope: 'on-set-host', continuousModifier: { apDelta: 2000 }, description: 'on-set-host AP+2000', ruleRefs: [] }],
    ruleRefs: [],
  };
  function setup(): GameState {
    registerCardDef(EVT);
    registerCardDef(ch('HOST', { colors: ['白'], ap: 3000 }));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('HOST', 'h1')];
    s.players.self.remove = ['EVT']; // hand-use 済みでイベントは remove に着地
    return s;
  }
  const ctxEvt = (): EffectCtx => makeCtx({ source: { player: 'self', area: 'scene', cardId: 'EVT' } });

  it('uid 解決済 fromSelf: EVT を remove から host へ faceUp セット + on-set-host READ 合算', () => {
    const s = setup();
    runAtom(s, 'charSetCard', { uid: 'h1', fromSelf: true, player: 'self' }, ctxEvt());
    const host = s.players.self.scene[0];
    expect(host.setCards).toEqual([{ cardId: 'EVT', faceUp: true, instanceId: 'set:1' }]);
    expect(s.players.self.remove).not.toContain('EVT');
    expect(read.char.ap(s, 'h1')).toBe(5000); // 3000 + on-set-host 2000
  });
  it('faceUp:false のセット (非fromSelf) は on-set-host を合算しない (gate=faceUp の対照)', () => {
    const s = setup();
    mutateChar.setCard(s, 'h1', 'EVT', false);
    expect(read.char.ap(s, 'h1')).toBe(3000); // 裏向き ⇒ rider 不適用 (rules/16)
  });
  it('EVT が remove に無くても host へセットされる (idx<0、複製なし)', () => {
    const s = setup();
    s.players.self.remove = [];
    runAtom(s, 'charSetCard', { uid: 'h1', fromSelf: true, player: 'self' }, ctxEvt());
    expect(s.players.self.scene[0].setCards).toEqual([{ cardId: 'EVT', faceUp: true, instanceId: 'set:1' }]);
  });
  it('短縮形 fromSelf (uid未指定+n/max): 即セットせず host pick を await する', () => {
    const s = setup();
    runAtom(s, 'charSetCard', { fromSelf: true, player: 'self', n: 1, filter: { color: '白' } }, ctxEvt());
    // pick await ⇒ この時点ではまだセットされない
    expect(s.players.self.scene[0].setCards).toEqual([]);
    expect(s.log.some(e => typeof e.action === 'string' && e.action.includes('charSetCard:awaiting-pick'))).toBe(true);
  });
  it('host 不在 (現場0) の uid 解決 fromSelf: セット no-op + EVT は remove に残る', () => {
    const s = setup();
    s.players.self.scene = [];
    runAtom(s, 'charSetCard', { uid: 'h1', fromSelf: true, player: 'self' }, ctxEvt());
    expect(s.players.self.remove).toContain('EVT'); // host 不在 ⇒ 引かない
  });
});

// ============================================================
// #4 canCutIn action-scoped cutin ban
// ============================================================
describe('engine-additive-0629d #4 canCutIn action-ban', () => {
  // カットイン札 (type:triggered/on-hand/effect:declared/optional)
  const CUT: CardDef = {
    id: 'CUT', no: '9/CUT', kind: 'event', names: ['CUT'], colors: ['青'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [{ id: 'ci', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'cutin', ruleRefs: [] }],
    ruleRefs: [],
  };
  function setup(): { s: GameState; ax: ActionContext } {
    registerCardDef(CUT);
    registerCardDef(ch('ACTOR'));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('ACTOR', 'act')]; // turn player actor (side self)
    s.players.opp.hand = ['CUT']; // 非ターンPがカットイン札所持
    s.players.self.hand = ['CUT'];
    const ax: ActionContext = { id: 'ax1', byUid: 'act', byPlayer: 'self', target: { kind: 'char', uid: 'x' }, phase: 'guard-window', startedAt: { turn: 1, nano: 0 } };
    return { s, ax };
  }

  it('baseline (フラグ無): 両者カットイン可', () => {
    const { s, ax } = setup();
    expect(canCutIn(s, ax, 'opp', 'CUT')).toBe(true);
    expect(canCutIn(s, ax, 'self', 'CUT')).toBe(true);
  });
  it('actor(self側)に cutinBanOpp_action フラグ → opp のカットイン不可 / self は可', () => {
    const { s, ax } = setup();
    mutateChar.setTurnEffect(s, 'act', 'cutinBanOpp_action', true);
    expect(canCutIn(s, ax, 'opp', 'CUT')).toBe(false); // 相手は使用不可
    expect(canCutIn(s, ax, 'self', 'CUT')).toBe(true);  // 自分(actor側)は可
  });
  it('clearTurnEffects(action) でフラグ清掃 → opp 再びカットイン可 (アクション終了時まで)', () => {
    const { s, ax } = setup();
    mutateChar.setTurnEffect(s, 'act', 'cutinBanOpp_action', true);
    expect(canCutIn(s, ax, 'opp', 'CUT')).toBe(false);
    mutateChar.clearTurnEffects(s, 'act', 'action');
    expect(canCutIn(s, ax, 'opp', 'CUT')).toBe(true);
  });
});

// ============================================================
// #5 costRemovedMatches (cost-path: removeDeckTop)
// ============================================================
describe('engine-additive-0629d #5 costRemovedMatches', () => {
  function setup(deck: string[]): { s: GameState; ctx: EffectCtx } {
    registerCardDef(ch('AK', { traits: ['赤井家'] }));
    registerCardDef(ch('POL', { traits: ['警察'] }));
    registerCardDef(ch('PLAIN', { traits: [] }));
    const s = createEmptyGameState();
    s.players.self.deck = deck;
    return { s, ctx: makeCtx() };
  }
  const cost = (n: number): Cost => ({ kind: 'removeDeckTop', player: 'self', n });

  it('cost で 赤井家 が除去された場合 → costRemovedMatches{trait:赤井家} true', () => {
    const { s, ctx } = setup(['AK', 'PLAIN', 'PAD', 'PAD']);
    pay(s, cost(2), ctx); // removes AK, PLAIN
    const cond = { kind: 'costRemovedMatches', filter: { trait: '赤井家' } } as unknown as Condition;
    expect(evalCond(s, cond, ctx)).toBe(true);
  });
  it('decoy: 除去カードに 赤井家 が無い → false', () => {
    const { s, ctx } = setup(['POL', 'PLAIN', 'PAD']);
    pay(s, cost(2), ctx); // removes POL, PLAIN
    const cond = { kind: 'costRemovedMatches', filter: { trait: '赤井家' } } as unknown as Condition;
    expect(evalCond(s, cond, ctx)).toBe(false);
  });
  it('n 閾値: 赤井家 1枚のみ除去で n:2 要求 → false / n:1 → true', () => {
    const { s, ctx } = setup(['AK', 'PLAIN', 'PAD']);
    pay(s, cost(2), ctx);
    expect(evalCond(s, { kind: 'costRemovedMatches', filter: { trait: '赤井家' }, n: 2 } as unknown as Condition, ctx)).toBe(false);
    expect(evalCond(s, { kind: 'costRemovedMatches', filter: { trait: '赤井家' }, n: 1 } as unknown as Condition, ctx)).toBe(true);
  });
  it('cardName filter: 阿笠博士 が除去 → true (B03003 型 or(cardName,trait))', () => {
    registerCardDef(ch('AGASA', { names: ['阿笠博士'] }));
    const { s, ctx } = setup(['AGASA', 'PLAIN', 'PAD']);
    s.players.self.deck = ['AGASA', 'PLAIN', 'PAD'];
    pay(s, cost(2), ctx);
    const cond = { kind: 'costRemovedMatches', filter: { cardName: '阿笠博士' } } as unknown as Condition;
    expect(evalCond(s, cond, ctx)).toBe(true);
  });
  it('cost 未払い (costPaid 無) → false (回帰0)', () => {
    const { s, ctx } = setup(['AK', 'PLAIN']);
    const cond = { kind: 'costRemovedMatches', filter: { trait: '赤井家' } } as unknown as Condition;
    expect(evalCond(s, cond, ctx)).toBe(false);
  });

  // E2E production path (B03003 型): 宣言能力 cost=removeDeckTop → effect=conditional{costRemovedMatches → draw}
  // を activateDeclaredAbility → runAllUntilEmpty で駆動。pre-walk と runtime drain (entryToCtx) を跨ぐため、
  // costPaid が queue 境界を越えて伝播しないと then-branch が runtime 再評価で常に false になる (review major)。
  function declCard(): CardDef {
    return {
      id: 'DECL', no: '9/DECL', kind: 'character', names: ['DECL'], colors: ['赤'], level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
      abilities: [{
        id: 'd1', type: 'declared',
        cost: { kind: 'removeDeckTop', player: 'self', n: 2 },
        effect: { kind: 'conditional', if: { kind: 'costRemovedMatches', filter: { trait: '赤井家' } } as unknown as Condition, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
        description: 'コストで赤井家除去 → 1ドロー', ruleRefs: [],
      }],
      ruleRefs: [],
    };
  }

  it('E2E: コストで赤井家除去 → conditional then(draw) が production path で発火 (+1 手札)', () => {
    registerCardDef(declCard());
    registerCardDef(ch('AK', { traits: ['赤井家'] }));
    registerCardDef(ch('PLAIN', { traits: [] }));
    const s0 = createEmptyGameState();
    s0.players.self.scene = [sceneChar('DECL', 'd1uid')];
    s0.players.self.deck = ['AK', 'PLAIN', 'AK', 'PLAIN', 'AK', 'PLAIN']; // cost removes AK(赤井家)+PLAIN
    const before = s0.players.self.hand.length;
    const s1 = produce(s0, d => { activateDeclaredAbility(d, 'd1uid', 'd1'); runAllUntilEmpty(d); });
    expect(s1.players.self.hand.length).toBe(before + 1); // draw fired ⇒ costRemovedMatches survived to runtime
  });

  it('E2E decoy: コストで赤井家を除去できない (PLAIN のみ) → draw 不発 (+0)', () => {
    registerCardDef(declCard());
    registerCardDef(ch('PLAIN', { traits: [] }));
    const s0 = createEmptyGameState();
    s0.players.self.scene = [sceneChar('DECL', 'd1uid')];
    s0.players.self.deck = ['PLAIN', 'PLAIN', 'PLAIN', 'PLAIN'];
    const before = s0.players.self.hand.length;
    const s1 = produce(s0, d => { activateDeclaredAbility(d, 'd1uid', 'd1'); runAllUntilEmpty(d); });
    expect(s1.players.self.hand.length).toBe(before); // 不一致 ⇒ then 不発
  });
});
