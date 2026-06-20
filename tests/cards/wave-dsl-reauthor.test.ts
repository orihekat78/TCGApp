// wave-dsl-reauthor — B02026 綾小路文麿 / B04004 毛利蘭 / B09097 コルン を実 engine 経路で駆動する挙動テスト。
// 3枚はいずれも過去 refuted (DEFERRED-INDEX) を engine変更0 で再author したもの。既存 verb/cond/hook のみ:
//   triggerCharMatches{side,filter,payloadKey} / removedCharMatches{side,cause,by} / boundMatchesFilter{levelMin} /
//   caseColor{combine} / caseStatus / bond / and / discard{filter,bind} / draw / evidenceGain / mill / sceneSetState{active}。
// BUG-117/118 lesson: DSL に filter/条件を書いても engine が実評価する保証はないため、decoy を盤面/手札/デッキに
//   置いて outcome で 1対1 検証する。特に:
//   - B02026 a1: triggerCharMatches{side:opp, filter:{}} の空filter が scene 走査で相手 partner を除外する (kind:character 不要)。
//   - B04004 a3: actor-gate(opp scene) と target-gate(payloadKey:targetUid=自分の工藤新一) の両方が AND で効く。
//   - B09097 a1: bare-chain discard{max:1} の decline で chain break / boundMatchesFilter{levelMin:7} / 「カード」=event含む。
// rules: 03/07/08/10/14/15/17/19/22/26 + TSV qAndA (B02026 / B04004 / B09097)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { evalCond } from '@/engine/cond/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards/index';
import { makeChar } from '../helpers/fixtures';
import { B02026 } from '@/cards/ct-p02/B02026';
import { B04004 } from '@/cards/ct-p04/B04004';
import { B04004P } from '@/cards/ct-p04/B04004P';
import { B09097 } from '@/cards/ct-p09/B09097';
import { B09097P } from '@/cards/ct-p09/B09097P';
import type { CardDef, GameState, EffectCtx, Condition, Effect } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

const GEN = 'DEC_GEN';        // 汎用キャラ (identity 無関係)
const KUDO = 'DEC_KUDO';      // カード名[工藤新一] (B04004 a3 target gate)
const OTHERCH = 'DEC_OTHER';  // 工藤新一でない自分キャラ (target gate decoy)
// B09097 手札 decoys
const RED8 = 'DEC_RED8';      // 赤 L8 → discard候補 + L7+ → mill
const RED4 = 'DEC_RED4';      // 赤 L4 → discard候補 + L<7 → mill なし
const BLK7 = 'DEC_BLK7';      // 黒 L7 → discard候補 + L7+ → mill
const GRN5 = 'DEC_GRN5';      // 緑 L5 → color filter 違反 → discard候補外
const REDEV7 = 'DEC_REDEV7';  // 赤 *event* L7 → 「カード」=event も対象 + L7+ → mill

function registerDecoys(): void {
  registerCardDef(ch(GEN, { names: ['汎用'] }));
  registerCardDef(ch(KUDO, { names: ['工藤新一'], traits: ['高校生'] }));
  registerCardDef(ch(OTHERCH, { names: ['毛利小五郎'], traits: ['探偵'] }));
  registerCardDef(ch(RED8, { names: ['赤8'], colors: ['赤'], level: 8 }));
  registerCardDef(ch(RED4, { names: ['赤4'], colors: ['赤'], level: 4 }));
  registerCardDef(ch(BLK7, { names: ['黒7'], colors: ['黒'], level: 7 }));
  registerCardDef(ch(GRN5, { names: ['緑5'], colors: ['緑'], level: 5 }));
  registerCardDef(ch(REDEV7, { kind: 'event', names: ['赤ev7'], colors: ['赤'], level: 7 }));
}

function baseTurn5(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

const fillers = (n: number) => Array.from({ length: n }, () => GEN);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerDecoys();
  registerTriggeredListener();
});

// ============================================================
// B02026 綾小路文麿 a1 — 相手の現場キャラがアクション時 draw1 (action:declare observer)
// ============================================================
describe('B02026 a1 condition: 相手の現場キャラのアクションでのみ発火 (triggerCharMatches{side:opp, filter:{}})', () => {
  const cond = () => B02026.abilities.find((a) => a.id === 'a1')!.condition! as Condition;

  // bearer(B02026) = self scene。actor を side scene に置き triggerPayload {uid, player} で参照。
  function withAction(actorSide: 'self' | 'opp', actorInScene: boolean): { s: GameState; ctx: EffectCtx } {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'aya#1', cardId: 'B02026', state: 'active' })];
    if (actorInScene) s.players[actorSide].scene.push(makeChar({ uid: 'act#1', cardId: GEN, state: 'sleep' }));
    const ctx: EffectCtx = {
      source: { cardId: 'B02026', uid: 'aya#1', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {}, triggerPayload: { uid: 'act#1', player: actorSide },
    };
    return { s, ctx };
  }

  it('相手の現場キャラがアクション → true', () => {
    const { s, ctx } = withAction('opp', true);
    expect(evalCond(s, cond(), ctx)).toBe(true);
  });
  it('相手 *partner* がアクション (uid が scene 不在) → false (filter:{} の scene 走査で除外)', () => {
    // partner は partner-area で scene に居ない。triggerPayload.uid=partner uid だが opp.scene に無い。
    const { s, ctx } = withAction('opp', false);
    expect(evalCond(s, cond(), ctx)).toBe(false);
  });
  it('自分の現場キャラがアクション → false (side:opp 違反)', () => {
    const { s, ctx } = withAction('self', true);
    expect(evalCond(s, cond(), ctx)).toBe(false);
  });
});

describe('B02026 a1 effect: カードを1枚引く', () => {
  it('draw1 = deck top が手札へ', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'aya#1', cardId: 'B02026', state: 'active' })];
    s.players.self.deck = [RED8, ...fillers(5)];
    s.players.self.hand = [];
    const eff = B02026.abilities.find((a) => a.id === 'a1')!.effect! as Effect;
    const ctx: EffectCtx = { source: { cardId: 'B02026', uid: 'aya#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
    const after = produce(s, (d) => runEffect(d, eff, ctx));
    expect(after.players.self.hand).toEqual([RED8]);
    expect(after.players.self.deck.length).toBe(5);
  });
});

describe('B02026 a2 ヒラメキ: evidence:remove-by-action 任意発動 + draw', () => {
  it('構造 = triggered / on-evidence / hook:evidence:remove-by-action / optional:true / draw1', () => {
    const a2 = B02026.abilities.find((a) => a.id === 'a2')!;
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
  });
});

// ============================================================
// B04004 毛利蘭
// ============================================================
describe('B04004 a1: 【パートナー青】〚迅速〛 partnerColorKeyword 構造', () => {
  it('continuous + partnerColor 青 + grantKeywords→[迅速]', () => {
    const a1 = B04004.abilities.find((a) => a.id === 'a1')!;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '青' });
    const gk = (a1.continuousModifier as { grantKeywords?: () => string[] }).grantKeywords;
    expect(typeof gk).toBe('function');
    expect(gk!()).toEqual(['迅速']);
  });
});

describe('B04004 a2 condition: removedCharMatches{side:opp, cause:contact-ap, by:self} 4 leg gating', () => {
  const cond = () => B04004.abilities.find((a) => a.id === 'a2')!.condition! as Condition;
  const ctxBearer = (): EffectCtx => ({
    source: { cardId: 'B04004', uid: 'ran#1', abilityId: 'a2', player: 'self', area: 'scene' },
    bindings: {},
  });
  function evalWith(pl: Record<string, unknown>): boolean {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'ran#1', cardId: 'B04004', state: 'active' })];
    return evalCond(s, cond(), { ...ctxBearer(), triggerPayload: pl });
  }
  it('相手キャラがこのキャラとのコンタクト(AP判定)でリムーブ → true', () => {
    expect(evalWith({ uid: 'v', side: 'opp', cause: 'contact-ap', byUid: 'ran#1' })).toBe(true);
  });
  it('cause=effect (非コンタクト) → false', () => {
    expect(evalWith({ uid: 'v', side: 'opp', cause: 'effect', byUid: 'ran#1' })).toBe(false);
  });
  it('byUid≠自身 (別キャラとのコンタクト) → false (by:self)', () => {
    expect(evalWith({ uid: 'v', side: 'opp', cause: 'contact-ap', byUid: 'someoneElse' })).toBe(false);
  });
  it('side=self (自分のキャラがリムーブ) → false (side:opp)', () => {
    expect(evalWith({ uid: 'v', side: 'self', cause: 'contact-ap', byUid: 'ran#1' })).toBe(false);
  });
});

describe('B04004 a2 effect: 手札を1枚リムーブしてもよい→そうした場合 証拠1 (chain gate)', () => {
  function run(hand: string[]): GameState {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'ran#1', cardId: 'B04004', state: 'active' })];
    s.players.self.hand = hand;
    s.players.self.deck = fillers(5); // evidenceGain = deck top → 証拠
    const eff = B04004.abilities.find((a) => a.id === 'a2')!.effect! as Effect;
    const ctx: EffectCtx = { source: { cardId: 'B04004', uid: 'ran#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
    let after = produce(s, (d) => runEffect(d, eff, ctx));
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    return after;
  }
  it('手札あり → discard1 + 証拠1 獲得', () => {
    const after = run([GEN]);
    expect(after.players.self.hand.length, 'discard で手札0').toBe(0);
    expect(after.players.self.evidence.length, '証拠+1').toBe(1);
  });
  it('手札0 (候補無) → chain break → 証拠獲得なし', () => {
    const after = run([]);
    expect(after.players.self.evidence.length, 'discard 不成立で evidenceGain skip').toBe(0);
  });
});

describe('B04004 a3 matcherCondition: actor(opp scene)+target(自分の工藤新一) の AND gate', () => {
  const mc = () => B04004.abilities.find((a) => a.id === 'a3')!.trigger!.matcherCondition! as Condition;
  // bearer=B04004 self / KUDO(工藤新一) self scene / OTHERCH self scene / actor opp scene。
  function evalWith(actorSide: 'self' | 'opp', actorInScene: boolean, targetUid: string): boolean {
    const s = baseTurn5();
    s.players.self.scene = [
      makeChar({ uid: 'ran#1', cardId: 'B04004', state: 'active' }),
      makeChar({ uid: 'kudo#1', cardId: KUDO, state: 'active' }),
      makeChar({ uid: 'other#1', cardId: OTHERCH, state: 'active' }),
    ];
    if (actorInScene) s.players[actorSide].scene.push(makeChar({ uid: 'act#1', cardId: GEN, state: 'sleep' }));
    const ctx: EffectCtx = {
      source: { cardId: 'B04004', uid: 'ran#1', abilityId: 'a3', player: 'self', area: 'scene' },
      bindings: {}, triggerPayload: { uid: 'act#1', player: actorSide, targetUid },
    };
    return evalCond(s, mc(), ctx);
  }
  it('相手キャラが 自分の工藤新一 を指定 → true', () => {
    expect(evalWith('opp', true, 'kudo#1')).toBe(true);
  });
  it('相手キャラが 自分の別キャラ(工藤新一でない) を指定 → false (target-gate)', () => {
    expect(evalWith('opp', true, 'other#1')).toBe(false);
  });
  it('相手 partner が指定 (actor scene 不在) → false (actor-gate filter:{})', () => {
    expect(evalWith('opp', false, 'kudo#1')).toBe(false);
  });
  it('自分のキャラがアクション → false (actor side:opp)', () => {
    expect(evalWith('self', true, 'kudo#1')).toBe(false);
  });
});

describe('B04004 a3 ability.condition: 【絆工藤新一】', () => {
  const cond = () => B04004.abilities.find((a) => a.id === 'a3')!.condition! as Condition;
  function withScene(hasKudo: boolean): GameState {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'ran#1', cardId: 'B04004', state: 'active' })];
    if (hasKudo) s.players.self.scene.push(makeChar({ uid: 'kudo#1', cardId: KUDO, state: 'active' }));
    return s;
  }
  const ctx = (): EffectCtx => ({ source: { cardId: 'B04004', uid: 'ran#1', abilityId: 'a3', player: 'self', area: 'scene' }, bindings: {} });
  it('自分の現場に工藤新一 → true', () => {
    expect(evalCond(withScene(true), cond(), ctx())).toBe(true);
  });
  it('工藤新一 不在 → false', () => {
    expect(evalCond(withScene(false), cond(), ctx())).toBe(false);
  });
});

describe('B04004 a3 effect: このキャラをアクティブにする', () => {
  it('sleep の B04004 → active', () => {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'ran#1', cardId: 'B04004', state: 'sleep' })];
    const eff = B04004.abilities.find((a) => a.id === 'a3')!.effect! as Effect;
    const ctx: EffectCtx = { source: { cardId: 'B04004', uid: 'ran#1', abilityId: 'a3', player: 'self', area: 'scene' }, bindings: {} };
    const after = produce(s, (d) => runEffect(d, eff, ctx));
    expect(after.players.self.scene.find((c) => c.uid === 'ran#1')!.state).toBe('active');
  });
});

describe('B04004P (parallel) — a3 matcherCondition は B04004 と同一', () => {
  it('byte-twin: matcherCondition 構造一致', () => {
    expect(JSON.stringify(B04004P.abilities.find((a) => a.id === 'a3')!.trigger))
      .toBe(JSON.stringify(B04004.abilities.find((a) => a.id === 'a3')!.trigger));
  });
});

// ============================================================
// B09097 コルン a1 — 登場時 手札赤/黒1リムーブしてもよい→draw2→L7+なら相手deck3 mill
// ============================================================
describe('B09097 a1 condition: 【事件赤＆黒】【事件編】 and gate', () => {
  const cond = () => B09097.abilities.find((a) => a.id === 'a1')!.condition! as Condition;
  function withCase(colors: string[], status: '事件編' | '解決編'): GameState {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'korn#1', cardId: 'B09097', state: 'active' })];
    s.players.self.case = { cardId: 'CASE', status, requiredEvidence: 7, colors, declaredUseCount: {} } as GameState['players']['self']['case'];
    return s;
  }
  const ctx = (): EffectCtx => ({ source: { cardId: 'B09097', uid: 'korn#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} });
  it('事件 赤&黒 + 事件編 → true', () => {
    expect(evalCond(withCase(['赤', '黒'], '事件編'), cond(), ctx())).toBe(true);
  });
  it('事件 赤のみ + 事件編 → false (caseColor combine:and = 両色必須)', () => {
    expect(evalCond(withCase(['赤'], '事件編'), cond(), ctx())).toBe(false);
  });
  it('事件 赤&黒 + 解決編 → false (caseStatus:事件編)', () => {
    expect(evalCond(withCase(['赤', '黒'], '解決編'), cond(), ctx())).toBe(false);
  });
});

describe('B09097 a1 effect chain: discard(赤/黒)→draw2→(L7+で)相手deck3 mill', () => {
  function run(hand: string[]): GameState {
    const s = baseTurn5();
    s.players.self.scene = [makeChar({ uid: 'korn#1', cardId: 'B09097', state: 'active' })];
    s.players.self.hand = hand;
    s.players.self.deck = fillers(6);   // draw2 用
    s.players.opp.deck = fillers(6);    // mill3 用
    const eff = B09097.abilities.find((a) => a.id === 'a1')!.effect! as Effect;
    const ctx: EffectCtx = { source: { cardId: 'B09097', uid: 'korn#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
    let after = produce(s, (d) => runEffect(d, eff, ctx));
    after = produce(after, (d) => _drainAllEffectPicksForTest(d, new HeuristicPolicy()));
    return after;
  }
  it('赤 L8 を discard → draw2 → L7+ で相手deck 3 mill', () => {
    const after = run([RED8, GRN5]);
    expect(after.players.self.hand.includes(RED8), '赤L8 discard 済').toBe(false);
    expect(after.players.self.hand.includes(GRN5), '緑(color違反)は手札残').toBe(true);
    // draw2: hand = [GRN5(残)] + deck top2。net hand = 1(残)+2(draw)=3
    expect(after.players.self.hand.length, 'GRN5残(1)+draw(2)').toBe(3);
    expect(after.players.opp.deck.length, '相手deck 6-3=3 (L7+ mill)').toBe(3);
  });
  it('赤 L4 を discard → draw2 → L<7 で mill なし', () => {
    const after = run([RED4, GRN5]);
    expect(after.players.self.hand.includes(RED4), '赤L4 discard 済').toBe(false);
    expect(after.players.opp.deck.length, '相手deck 不変 (L<7 で mill 不発)').toBe(6);
  });
  it('緑のみ (赤/黒 候補無) → discard 不成立 → chain break (draw/mill skip)', () => {
    const after = run([GRN5]);
    expect(after.players.self.hand, '緑は discard 対象外 → 手札不変').toEqual([GRN5]);
    expect(after.players.self.deck.length, 'draw 不発 (chain break)').toBe(6);
    expect(after.players.opp.deck.length, 'mill 不発').toBe(6);
  });
  it('赤 *event* L7 を discard → 「カード」=event も対象 → L7+ で mill', () => {
    const after = run([REDEV7, GRN5]);
    expect(after.players.self.hand.includes(REDEV7), '赤event は kind 制限無で discard 対象').toBe(false);
    expect(after.players.opp.deck.length, 'event L7 でも mill 3 発火').toBe(3);
  });
});

describe('B09097P (parallel) — a1 effect は B09097 と同一', () => {
  it('byte-twin: effect 構造一致', () => {
    expect(JSON.stringify(B09097P.abilities.find((a) => a.id === 'a1')!.effect))
      .toBe(JSON.stringify(B09097.abilities.find((a) => a.id === 'a1')!.effect));
  });
});
