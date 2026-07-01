// engine additive wave-5 (2026-07-01) — 2 つの純 additive primitive の挙動テスト。
//
// #1 boundAnyMatchesFilter Condition (G17) — ctx.bindings[bindKey] の **全枚数のいずれか** が
//    TargetFilter に一致するか。既存 boundMatchesFilter は bound[0] のみを読むため N>1 の公開/リムーブ
//    集合を評価できなかった。PR132「上から3枚リムーブ…特徴[警察]のキャラがリムーブされた場合」= any /
//    D06013「上から4枚公開…【緑】と【白】が1枚以上」= and[boundAny{緑}, boundAny{白}] で合成。
//    各要素は matchOneFilter(c=null=CardDef 印字値) に委譲 (boundMatchesFilter と同流儀)。
// #2 handUseRestrictFilter ContinuousModifier (P05) — case card 継続能力
//    「自分は〚特徴[X]〛以外のキャラを手札から使用できない」(B05120 探偵 / B06109 高校生)。
//    手札の使用ゲート (canHandUseCard/Switch) + ネクストヒント (runNextHint) の **両経路** で
//    character のみ gate。event・効果登場・カットイン・変装・ヒラメキ は対象外 (公式 Q&A)。
//    既存 case card は未宣言 ⇒ 制限なし (allow、smoke baseline 不変)。専用テスト必須。
// rules: 06(カード種別) / 12(ネクストヒント) / 15(「〜の場合」) / 17(継続能力) / 20(色) / 24(常時有効型) / 25(公式 Q&A)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { evalCond } from '@/engine/cond/eval';
import { canHandUseCard, canHandUseCardSwitch, handUseCharRestrictAllows } from '@/engine/flow/main/hand-use-card';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { registerAll } from '@/cards/index';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition, ContinuousModifier } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: [], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

// ============================================================
// #1 boundAnyMatchesFilter Condition (G17)
// ============================================================
describe('engine-additive-wave5 #1 boundAnyMatchesFilter', () => {
  beforeEach(() => {
    registerCardDef(ch('KEISATSU', { traits: ['警察'] }));
    registerCardDef(ch('TANTEI', { traits: ['探偵'] }));
    registerCardDef(ch('GREEN', { colors: ['緑'] }));
    registerCardDef(ch('WHITE', { colors: ['白'] }));
    registerCardDef(ch('BLUE', { colors: ['青'] }));
  });
  const cond = (bindKey: string, filter: Record<string, unknown>): Condition =>
    ({ kind: 'boundAnyMatchesFilter', bindKey, filter } as unknown as Condition);
  const bind = (...ids: string[]) => makeCtx({ bindings: { removed: ids.map(cardId => ({ cardId })) } });

  it('PR132: 3枚リムーブに特徴[警察]が含まれる → true', () => {
    expect(evalCond(createEmptyGameState(), cond('removed', { trait: ['警察'] }), bind('TANTEI', 'KEISATSU', 'BLUE'))).toBe(true);
  });
  it('特徴[警察]が1枚も無い → false', () => {
    expect(evalCond(createEmptyGameState(), cond('removed', { trait: ['警察'] }), bind('TANTEI', 'GREEN', 'BLUE'))).toBe(false);
  });
  it('空 binding → false', () => {
    expect(evalCond(createEmptyGameState(), cond('removed', { trait: ['警察'] }), bind())).toBe(false);
  });
  it('binding 未設定 → false', () => {
    expect(evalCond(createEmptyGameState(), cond('removed', { trait: ['警察'] }), makeCtx())).toBe(false);
  });
  it('D06013 合成: and[boundAny{緑}, boundAny{白}] — 4枚に緑1+白1 → true', () => {
    const c: Condition = { kind: 'and', cs: [cond('removed', { color: ['緑'] }), cond('removed', { color: ['白'] })] } as unknown as Condition;
    expect(evalCond(createEmptyGameState(), c, bind('BLUE', 'GREEN', 'WHITE', 'TANTEI'))).toBe(true);
  });
  it('D06013 合成: 白が無い → false', () => {
    const c: Condition = { kind: 'and', cs: [cond('removed', { color: ['緑'] }), cond('removed', { color: ['白'] })] } as unknown as Condition;
    expect(evalCond(createEmptyGameState(), c, bind('BLUE', 'GREEN', 'GREEN', 'TANTEI'))).toBe(false);
  });
});

// ============================================================
// #2 handUseRestrictFilter ContinuousModifier (P05)
// ============================================================
describe('engine-additive-wave5 #2 handUseRestrictFilter', () => {
  // 特徴[探偵]以外のキャラを手札使用禁止する case card (B05120 型)
  const restrictMod = { handUseRestrictFilter: { trait: ['探偵'] } } as unknown as ContinuousModifier;
  const caseDef = (over: Partial<CardDef> = {}): CardDef => ({
    id: 'CASE', no: '9/CASE', kind: 'case', names: ['CASE'], colors: [], traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
    abilities: [{ id: 'a1', type: 'continuous', continuousModifier: restrictMod, description: '特徴[探偵]以外のキャラを手札から使用できない' }],
    ...over,
  } as unknown as CardDef);

  function setup(caseWithRestrict: boolean): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    registerCardDef(ch('TANTEI', { traits: ['探偵'] }));
    registerCardDef(ch('KEISATSU', { traits: ['警察'] }));
    registerCardDef(ev('EVENTX', { traits: ['警察'] })); // 探偵でない event
    registerCardDef(caseWithRestrict ? caseDef() : ({ id: 'CASE', no: '9/CASE', kind: 'case', names: ['CASE'], colors: [], traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [] } as unknown as CardDef));
    s.players.self.case = { cardId: 'CASE', status: '事件編', colors: [], declaredUseCount: {} } as GameState['players']['self']['case'];
    s.players.self.hand = ['TANTEI', 'KEISATSU', 'EVENTX'];
    s.players.self.file = [{ type: 'card-back', cardId: 'D08017' }, { type: 'card-back', cardId: 'D08017' }];
    return s;
  }

  it('制限あり: 特徴[探偵]キャラは手札使用可', () => {
    expect(canHandUseCard(setup(true), 'self', 'TANTEI')).toBe(true);
  });
  it('制限あり: 特徴[探偵]以外のキャラは手札使用不可', () => {
    expect(canHandUseCard(setup(true), 'self', 'KEISATSU')).toBe(false);
  });
  it('制限あり: event は種別対象外ゆえ使用可 (探偵でなくても)', () => {
    expect(canHandUseCard(setup(true), 'self', 'EVENTX')).toBe(true);
  });
  it('制限なし case: 非探偵キャラも使用可 (回帰0)', () => {
    expect(canHandUseCard(setup(false), 'self', 'KEISATSU')).toBe(true);
  });
  it('制限あり: switch 経路も同様に非探偵を阻止', () => {
    const s = setup(true);
    s.players.self.scene = Array.from({ length: 5 }, (_, i) => ({ uid: `f#${i}`, cardId: 'TANTEI', player: 'self', state: 'active', isNamed: false, setCards: [], stackedCount: 0 } as GameState['players']['self']['scene'][number]));
    expect(canHandUseCardSwitch(s, 'self', 'KEISATSU')).toBe(false);
    expect(canHandUseCardSwitch(s, 'self', 'TANTEI')).toBe(true);
  });

  it('制限あり but ability.type≠continuous は無視 (継続能力のみ honor)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    registerCardDef(ch('KEISATSU', { traits: ['警察'] }));
    // handUseRestrictFilter を triggered ability に (誤配置) → 無視されて許可されるべき
    registerCardDef({ id: 'CASE', no: '9/CASE', kind: 'case', names: ['CASE'], colors: [], traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
      abilities: [{ id: 'a1', type: 'triggered', continuousModifier: restrictMod, description: 'x' }] } as unknown as CardDef);
    s.players.self.case = { cardId: 'CASE', status: '事件編', colors: [], declaredUseCount: {} } as GameState['players']['self']['case'];
    s.players.self.hand = ['KEISATSU'];
    s.players.self.file = [{ type: 'card-back', cardId: 'D08017' }, { type: 'card-back', cardId: 'D08017' }];
    expect(canHandUseCard(s, 'self', 'KEISATSU')).toBe(true);
  });
  it('制限あり but ability.condition が false → 無効 (非探偵も許可) / true → 有効', () => {
    const mk = (cond: unknown): GameState => {
      const s = createEmptyGameState();
      s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      registerCardDef(ch('KEISATSU', { traits: ['警察'] }));
      registerCardDef({ id: 'CASE', no: '9/CASE', kind: 'case', names: ['CASE'], colors: [], traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
        abilities: [{ id: 'a1', type: 'continuous', condition: cond, continuousModifier: restrictMod, description: 'x' }] } as unknown as CardDef);
      s.players.self.case = { cardId: 'CASE', status: '事件編', colors: [], declaredUseCount: {} } as GameState['players']['self']['case'];
      s.players.self.hand = ['KEISATSU'];
      s.players.self.file = [{ type: 'card-back', cardId: 'D08017' }, { type: 'card-back', cardId: 'D08017' }];
      return s;
    };
    expect(canHandUseCard(mk({ kind: 'false' }), 'self', 'KEISATSU')).toBe(true);  // 条件 false → restrict 不成立 → 許可
    expect(canHandUseCard(mk({ kind: 'true' }), 'self', 'KEISATSU')).toBe(false);  // 条件 true → restrict 有効 → 阻止
  });

  // 単一ソース predicate (手札の使用 / ネクストヒント 両経路が呼ぶ)
  it('handUseCharRestrictAllows: 探偵=true / 非探偵=false / event=true / 制限無=true', () => {
    const s = setup(true);
    expect(handUseCharRestrictAllows(s, 'self', 'TANTEI')).toBe(true);
    expect(handUseCharRestrictAllows(s, 'self', 'KEISATSU')).toBe(false);
    expect(handUseCharRestrictAllows(s, 'self', 'EVENTX')).toBe(true);
    expect(handUseCharRestrictAllows(setup(false), 'self', 'KEISATSU')).toBe(true);
  });

  it('ネクストヒント: 非探偵キャラは runNextHint で専用エラー throw / 探偵は通る', () => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    const s = setup(true);
    registerTriggeredListener();
    s.players.self.file = [{ type: 'card-back', cardId: 'D08017' }, { type: 'card-back', cardId: 'D08017' }, { type: 'card-back', cardId: 'D08017' }];
    // runNextHint は mutate.file.popTop が Immer current() を呼ぶため produce(draft) 内で駆動 (cluster6 と同型)
    expect(() => produce(s, (d) => { runNextHint(d, 'self', 'KEISATSU'); })).toThrow(/hand-use restricted/);
    expect(() => produce(s, (d) => { runNextHint(d, 'self', 'TANTEI'); })).not.toThrow();
  });
});
