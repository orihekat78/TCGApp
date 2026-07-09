// engine defer-unlock mini-wave (2026-07-09) — hybrid-pilot/batch2 DEFER 解禁 8 primitive。
//
// #1 contactCharMatches Condition — コンタクト参加キャラを TargetFilter で評価する serializable cond。
//    ctx.contact (cutin effect 経路、buildContactBindings p-相対: byUid=自コンタクトキャラ) 優先、
//    無ければ ctx.bindings.contact[0] (triggered matcherCondition 経路 = queue 時 gate、B02080 の
//    【ターン1】焼失回避)。filter は matchOneFilter (board char = uid 既知) 委譲。
//    B02006 公式QA:「コンタクト中の自分のキャラがレベル5以下の特徴[少年探偵団]の場合に AP+3000」
//    = who:'byUid' (相対=自コンタクトキャラ)。D11013/PR278「[警察]のキャラにカットインした場合」も同語義
//    (shipped D11013 の targetUid 読みは QA 違反 = 本 wave で byUid へ修正)。
// #2 atomMill bind writeback — 「上から3枚リムーブ→これによって〜がリムーブされた場合」(PR132/PR201)。
//    discard(core.ts) と同型: a.bind に removeFromTop の戻り値 CardId[] を書く。
// #3 removeAreaToDeckTop dest:'bottom' — 「リムーブの〜1枚選びデッキの下」(B02076)。
// #4 charOverrideAP scope:'turn' — 「ターン終了時まで元のAPを0」(B05022)。turnEffects['apOverrideTurn']
//    ベース (rules/19 QA: 修整は残る)。clearTurnEffects('turn') で失効。
// #5 removeAreaAllToDeckBottom player param — self-only 版 (B04038/PR027/PR031)。省略時は両者 (B08027 不変)。
// #6 TRIGGERED_HOOKS + 'phase:main:start' — 「自分のターンのメインフェイズ開始時」(B05072)。
//    emit は turn.ts 既存。matcherCondition triggerPlayerIs で側 gate (file:pop 同流儀)。
// #7 Cost partnerAreaRemove — 宣言 cost「PA にある特徴[ビッグジュエル]のカードを1枚リムーブする」(B07039)。
//    removeAreaToDeckBottom cost と同型 (candidates >= n / costParams 優先 + pickCandidates fallback)。
// #8 $self.partnerAreaTraitCount.<trait> dyn — 「PA にある特徴[X] 1枚につき AP+1000」(B07046)。
//    $self.removeNameCount と同式 (partnerAreaCards の def traits 計数)。
// rules: 08-09(コンタクト/カットイン) / 14・26(refresh) / 15(まで=0可) / 17(hook) / 19(元のAP) / 21(cost)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { evalDyn } from '@/engine/dyn/eval';
import { canPay } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { atomMill, atomRemoveAreaToDeckTop, atomRemoveAreaAllToDeckBottom } from '@/engine/effect/atom-handlers/core';
import { atomCharOverrideAP } from '@/engine/effect/atom-handlers/char';
import { event } from '@/engine/event/index';
import { cutIn } from '@/engine/flow/contact';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { registerAll } from '@/cards/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { read } from '@/engine/read/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { makeCtx } from '../helpers/fixtures';
import type { GameState, CardDef, AbilityDef, Condition, Cost, Effect, EffectCtx } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

// ============================================================
// #1 contactCharMatches Condition
// ============================================================
describe('miniwave #1 contactCharMatches', () => {
  beforeEach(() => {
    registerCardDef(ch('KEISATSU', { traits: ['警察'], level: 3 }));
    registerCardDef(ch('SHONEN', { traits: ['少年探偵団'], level: 5 }));
    registerCardDef(ch('OTHER', { traits: ['探偵'], level: 7 }));
  });
  const cond = (who: string, filter: Record<string, unknown>): Condition =>
    ({ kind: 'contactCharMatches', who, filter } as unknown as Condition);

  function boardWith(): { s: GameState; k: string; o: string; sh: string } {
    let k = ''; let o = ''; let sh = '';
    const s = produce(createEmptyGameState(), (d) => {
      k = mutate.scene.enter(d, 'self', 'KEISATSU', {}).uid;
      sh = mutate.scene.enter(d, 'self', 'SHONEN', {}).uid;
      o = mutate.scene.enter(d, 'opp', 'OTHER', {}).uid;
    });
    return { s, k, o, sh };
  }

  it('who:byUid — 自コンタクトキャラが特徴[警察] → true', () => {
    const { s, k, o } = boardWith();
    const ctx = makeCtx({ contact: { byUid: k, targetUid: o, attackerSide: 'self' } });
    expect(evalCond(s, cond('byUid', { trait: ['警察'] }), ctx)).toBe(true);
  });
  it('who:byUid — filter 不一致 (探偵) → false', () => {
    const { s, k, o } = boardWith();
    const ctx = makeCtx({ contact: { byUid: k, targetUid: o, attackerSide: 'self' } });
    expect(evalCond(s, cond('byUid', { trait: ['探偵'] }), ctx)).toBe(false);
  });
  it('who:targetUid — 相手コンタクトキャラ評価', () => {
    const { s, k, o } = boardWith();
    const ctx = makeCtx({ contact: { byUid: k, targetUid: o, attackerSide: 'self' } });
    expect(evalCond(s, cond('targetUid', { trait: ['探偵'] }), ctx)).toBe(true);
    expect(evalCond(s, cond('targetUid', { trait: ['警察'] }), ctx)).toBe(false);
  });
  it('B02006: levelMax 境界 — Lv5 の少年探偵団は levelMax:5 で true / levelMax:4 で false', () => {
    const { s, sh, o } = boardWith();
    const ctx = makeCtx({ contact: { byUid: sh, targetUid: o, attackerSide: 'self' } });
    expect(evalCond(s, cond('byUid', { trait: ['少年探偵団'], levelMax: 5 }), ctx)).toBe(true);
    expect(evalCond(s, cond('byUid', { trait: ['少年探偵団'], levelMax: 4 }), ctx)).toBe(false);
  });
  it('matcherCondition 経路 — ctx.contact 無しでも bindings.contact[0] を読む (B02080 queue-time gate)', () => {
    const { s, k, o } = boardWith();
    const ctx = makeCtx({ bindings: { contact: [{ byUid: k, targetUid: o, attackerSide: 'self' }] } as unknown as EffectCtx['bindings'] });
    expect(evalCond(s, cond('byUid', { trait: ['警察'] }), ctx)).toBe(true);
    expect(evalCond(s, cond('byUid', { trait: ['探偵'] }), ctx)).toBe(false);
  });
  it('contact 情報が一切無い → false (fail-closed)', () => {
    const { s } = boardWith();
    expect(evalCond(s, cond('byUid', { trait: ['警察'] }), makeCtx())).toBe(false);
  });
  it('who の uid が盤面に不在 → false (fail-closed)', () => {
    const { s, k } = boardWith();
    const ctx = makeCtx({ contact: { byUid: k, targetUid: undefined, attackerSide: 'self' } });
    expect(evalCond(s, cond('targetUid', { trait: ['探偵'] }), ctx)).toBe(false);
  });
});

// ============================================================
// #1b BUG-177 — D11013 実機 (cutIn 経路): 「[警察]のキャラにカットインした」= 自コンタクトキャラ
// ============================================================
describe('miniwave #1b BUG-177 D11013 cutin 方向修正 (B02006 公式QA 準拠)', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); resetDefRegistry(); _resetUidCounter();
    registerAll();
    registerTriggeredListener();
  });
  function mkAx(attackerUid: string, defUid: string): import('@/engine/types').ActionContext {
    return {
      id: 'ax', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: attackerUid, aAP: 1000, bUid: defUid, bAP: 1000 }, contactImmune: false,
    };
  }
  // D11013 パートナー黄 gate → 黄 partner を立てる。B09086 (黄/警察) = 自コンタクトキャラ、
  // B06006 (青/探偵系) = 非警察 decoy。相手側には逆属性を置き方向を判別する。
  it('自コンタクトキャラが[警察] (相手は非警察) → draw 発火', () => {
    let atk = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner.cardId = 'D11002'; // 黄 partner (登録済 def)
      atk = mutate.scene.enter(d, 'self', 'B09086', {}).uid; // 警察
      const def = mutate.scene.enter(d, 'opp', 'B06006', {}).uid; // 非警察
      d.players.self.hand = ['D11013'];
      d.players.self.deck = ['B06006', 'B06006'];
      cutIn(d, mkAx(atk, def), 'self', 'D11013');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand).toHaveLength(1); // cutin で 0 → draw で 1
  });
  it('BUG-177 決定 case: 自コンタクトキャラ非警察・相手が[警察] → draw 不発 (旧実装は発火していた)', () => {
    let atk = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.partner.cardId = 'D11002';
      atk = mutate.scene.enter(d, 'self', 'B06006', {}).uid; // 非警察
      const def = mutate.scene.enter(d, 'opp', 'B09086', {}).uid; // 警察 (相手側)
      d.players.self.hand = ['D11013'];
      d.players.self.deck = ['B06006', 'B06006'];
      cutIn(d, mkAx(atk, def), 'self', 'D11013');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand).toHaveLength(0); // draw されない
  });
});

// ============================================================
// #2 atomMill bind writeback (PR132/PR201)
// ============================================================
describe('miniwave #2 mill bind', () => {
  beforeEach(() => {
    registerCardDef(ch('A')); registerCardDef(ch('B')); registerCardDef(ch('C'));
    registerCardDef(ch('D')); registerCardDef(ch('Z'));
  });
  it('bind 指定 → リムーブした cardId 群が ctx.bindings に載る', () => {
    const ctx = makeCtx();
    produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['A', 'B', 'C', 'D'];
      atomMill(d, { player: 'self', n: 3, bind: '$milled' }, ctx);
    });
    expect(ctx.bindings['$milled']).toEqual([{ cardId: 'A' }, { cardId: 'B' }, { cardId: 'C' }]);
  });
  it('gate:true + deck 不足 → リムーブせず bind も書かない (PR132 QA: 2枚以下では行えない)', () => {
    const ctx = makeCtx();
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['A', 'B'];
      atomMill(d, { player: 'self', n: 3, gate: true, bind: '$milled' }, ctx);
    });
    expect(after.players.self.deck).toEqual(['A', 'B']);
    expect(ctx.bindings['$milled']).toBeUndefined();
  });
  it('deck 不足 (gate 無し) → 可能な限り分のみ bind (rules/26)', () => {
    const ctx = makeCtx();
    produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['A', 'B'];
      d.players.self.remove = ['Z'];
      atomMill(d, { player: 'self', n: 3, bind: '$milled' }, ctx);
    });
    expect(ctx.bindings['$milled']).toEqual([{ cardId: 'A' }, { cardId: 'B' }]);
  });
  it('bind 未指定 → bindings 不変 (回帰)', () => {
    const ctx = makeCtx();
    produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['A', 'B', 'C', 'D'];
      atomMill(d, { player: 'self', n: 2 }, ctx);
    });
    expect(Object.keys(ctx.bindings)).toEqual([]);
  });
});

// ============================================================
// #3 removeAreaToDeckTop dest:'bottom' (B02076)
// ============================================================
describe('miniwave #3 removeAreaToDeckTop dest bottom', () => {
  beforeEach(() => { registerCardDef(ch('A')); registerCardDef(ch('X')); registerCardDef(ch('Y')); });
  it("dest:'bottom' → デッキの下へ", () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['A'];
      d.players.self.deck = ['X', 'Y'];
      atomRemoveAreaToDeckTop(d, { player: 'self', target: 'A', dest: 'bottom' }, makeCtx(), 'removeAreaToDeckTop');
    });
    expect(after.players.self.deck).toEqual(['X', 'Y', 'A']);
    expect(after.players.self.remove).toEqual([]);
  });
  it('dest 未指定 → 従来どおりデッキの上 (回帰)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['A'];
      d.players.self.deck = ['X', 'Y'];
      atomRemoveAreaToDeckTop(d, { player: 'self', target: 'A' }, makeCtx(), 'removeAreaToDeckTop');
    });
    expect(after.players.self.deck).toEqual(['A', 'X', 'Y']);
  });
});

// ============================================================
// #4 charOverrideAP scope:'turn' (B05022)
// ============================================================
describe('miniwave #4 charOverrideAP scope turn', () => {
  beforeEach(() => { registerCardDef(ch('ATK', { ap: 5000 })); });
  it("scope:'turn' → 元のAP=0、修整 (+1000) は残る (rules/19 QA)、turn 清掃で復元", () => {
    let uid = '';
    const mid = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'ATK', {}).uid;
      mutate.char.modifyAP(d, uid, 1000, 'permanent');
      atomCharOverrideAP(d, { uid, val: 0, scope: 'turn' }, makeCtx());
    });
    expect(read.char.ap(mid, uid), '元のAP 0 + 修整1000').toBe(1000);
    const cleared = produce(mid, (d) => { mutate.char.clearTurnEffects(d, uid, 'turn'); });
    expect(read.char.ap(cleared, uid), 'ターン終了で復元').toBe(6000);
  });
  it('scope 無し → 恒久 apOverride (回帰、clearTurnEffects で消えない)', () => {
    let uid = '';
    const mid = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'ATK', {}).uid;
      atomCharOverrideAP(d, { uid, val: 0 }, makeCtx());
    });
    expect(read.char.ap(mid, uid)).toBe(0);
    const cleared = produce(mid, (d) => { mutate.char.clearTurnEffects(d, uid, 'turn'); });
    expect(read.char.ap(cleared, uid)).toBe(0);
  });
});

// ============================================================
// #5 removeAreaAllToDeckBottom player param (B04038)
// ============================================================
describe('miniwave #5 removeAreaAllToDeckBottom player', () => {
  beforeEach(() => { registerCardDef(ch('A')); registerCardDef(ch('B')); registerCardDef(ch('X')); registerCardDef(ch('Y')); });
  it("player:'self' → 自分のみ drain、相手は不変 (B04038)", () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['A'];
      d.players.self.deck = ['X'];
      d.players.opp.remove = ['B'];
      d.players.opp.deck = ['Y'];
      atomRemoveAreaAllToDeckBottom(d, { player: 'self' }, makeCtx());
    });
    expect(after.players.self.remove).toEqual([]);
    expect(after.players.self.deck).toHaveLength(2);
    expect(after.players.self.deck).toContain('A');
    expect(after.players.opp.remove, '相手 remove 不変').toEqual(['B']);
    expect(after.players.opp.deck).toEqual(['Y']);
  });
  it('player 未指定 → 両者 drain (B08027 回帰)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['A'];
      d.players.self.deck = ['X'];
      d.players.opp.remove = ['B'];
      d.players.opp.deck = ['Y'];
      atomRemoveAreaAllToDeckBottom(d, {}, makeCtx());
    });
    expect(after.players.self.remove).toEqual([]);
    expect(after.players.opp.remove).toEqual([]);
  });
  it("player:'opp' は resolvePlayer (相対) — ctx.source.player:'opp' の 'self' は opp 実スロット", () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.remove = ['A'];
      d.players.self.deck = ['X'];
      d.players.opp.remove = ['B'];
      d.players.opp.deck = ['Y'];
      atomRemoveAreaAllToDeckBottom(d, { player: 'self' }, makeCtx({ source: { player: 'opp', area: 'scene' } }));
    });
    expect(after.players.opp.remove).toEqual([]);
    expect(after.players.self.remove).toEqual(['A']);
  });
});

// ============================================================
// #6 TRIGGERED_HOOKS + phase:main:start (B05072)
// ============================================================
describe('miniwave #6 phase:main:start triggered hook', () => {
  const OBS: AbilityDef = {
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'phase:main:start' as never, matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } as unknown as Condition },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as Effect,
    description: '自分のターンのメインフェイズ開始時', ruleRefs: [],
  };
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); resetDefRegistry(); _resetUidCounter();
    registerCardDef(ch('OBS', { abilities: [OBS] }));
    registerTriggeredListener();
  });
  it('自分ターンの main:start emit → queue される', () => {
    let uid = '';
    const after = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      event.emit(d, 'phase:main:start', { player: 'self' }, undefined);
    });
    expect(after.pendingEffects.some(pe => pe.source?.uid === uid && pe.triggeredBy?.hook === 'phase:main:start')).toBe(true);
  });
  it('相手ターンの main:start → triggerPlayerIs gate で queue されない', () => {
    let uid = '';
    const after = produce(createEmptyGameState(), (d) => {
      uid = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      event.emit(d, 'phase:main:start', { player: 'opp' }, undefined);
    });
    expect(after.pendingEffects.some(pe => pe.source?.uid === uid)).toBe(false);
  });
});

// ============================================================
// #7 Cost partnerAreaRemove (B07039)
// ============================================================
describe('miniwave #7 cost partnerAreaRemove', () => {
  beforeEach(() => {
    registerCardDef(ch('JEWEL', { traits: ['ビッグジュエル'], kind: 'event' } as Partial<CardDef>));
    registerCardDef(ch('OTHERCARD'));
  });
  const cost: Cost = {
    kind: 'partnerAreaRemove',
    target: { kind: 'pick', query: { area: 'partner-area', side: 'self', filter: { trait: ['ビッグジュエル'] } }, n: { min: 1, max: 1 } },
    n: 1,
  } as unknown as Cost;
  it('PA に一致カードあり → canPay true / 無し → false', () => {
    const withJewel = produce(createEmptyGameState(), (d) => { d.players.self.partnerAreaCards = ['JEWEL']; });
    expect(canPay(withJewel, cost, makeCtx())).toBe(true);
    const withoutMatch = produce(createEmptyGameState(), (d) => { d.players.self.partnerAreaCards = ['OTHERCARD']; });
    expect(canPay(withoutMatch, cost, makeCtx())).toBe(false);
    expect(canPay(createEmptyGameState(), cost, makeCtx()), 'PA 空/undefined').toBe(false);
  });
  it('pay → PA から抜けてリムーブエリアへ', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL', 'OTHERCARD'];
      pay(d, cost, makeCtx());
    });
    expect(after.players.self.partnerAreaCards).toEqual(['OTHERCARD']);
    expect(after.players.self.remove).toContain('JEWEL');
  });
});

// ============================================================
// #8 $self.partnerAreaTraitCount dyn (B07046)
// ============================================================
describe('miniwave #8 $self.partnerAreaTraitCount', () => {
  beforeEach(() => {
    registerCardDef(ch('JEWEL', { traits: ['ビッグジュエル'] }));
    registerCardDef(ch('JEWEL2', { traits: ['ビッグジュエル'] }));
    registerCardDef(ch('OTHERCARD', { traits: ['探偵'] }));
  });
  it('PA の特徴一致枚数を数える (同一 cardId 重複も各1枚)', () => {
    const s = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL', 'JEWEL', 'JEWEL2', 'OTHERCARD'];
    });
    expect(evalDyn(s, '$self.partnerAreaTraitCount.ビッグジュエル', makeCtx())).toBe(3);
  });
  it('PA 空/undefined → 0', () => {
    expect(evalDyn(createEmptyGameState(), '$self.partnerAreaTraitCount.ビッグジュエル', makeCtx())).toBe(0);
  });
  it('B07046 使用形: 乗算式 ×1000', () => {
    const s = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL', 'JEWEL2'];
    });
    expect(evalDyn(s, '$self.partnerAreaTraitCount.ビッグジュエル * 1000', makeCtx())).toBe(2000);
  });
});
