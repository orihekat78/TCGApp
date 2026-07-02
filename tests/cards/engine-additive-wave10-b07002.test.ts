// engine additive wave-10 (2026-07-02) — B07002 江戸川コナン exemplar の 2 primitive 挙動テスト。
//
// #1 boundDistinctColorCount Condition (G17 残) — ctx.bindings[bindKey] 内に「filter 一致 かつ 相互に
//    同じ色を持たない (色集合の pairwise 交差が空)」カードが n 枚以上存在するか。
//    B07002 a1「この効果によってそれぞれ色の異なる（同じ色を持たない）〚特徴［探偵］〛のキャラを
//    2枚リムーブした場合」。boundAnyMatchesFilter (wave-5) と同流儀で各 cardId を
//    matchOneFilter(c=null=CardDef 印字値) に委譲。2色カード (rules/20) は色集合全体で交差判定
//    (1色でも共有すれば「同じ色を持つ」= 不成立、公式括弧書き「（同じ色を持たない）」)。
// #2 setCutinBan / setDisguiseBan atom verb + TurnScopedFlags.cutinBanned/disguiseBanned +
//    canCutIn/canDisguise gate — B07002 a2「このターン中、相手は【カットイン】と【変装】を使用できない」。
//    side-level turn flag (setNextHintBan/setEventUseBan template) ゆえ発動キャラ離場後も有効
//    (公式 Q&A B07002「使用した後でこのキャラが現場を離れても有効ですか？→はい」)。
//    清掃 = turn:start resetTurnFlags。per-char cutinBanOpp_action (action-scoped、wave-0629d) とは
//    別 axis (こちらは turn-scoped + side-level)。
// rules: 09(カットイン/変装) / 15(能力と効果) / 17(アイコン) / 20(色) / 25(Q&A)。

import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { runAtom } from '@/engine/effect/index';
import { canCutIn, canDisguise } from '@/engine/flow/contact';
import { flag as mutateFlag } from '@/engine/mutate/flag';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition, ActionContext } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

// ============================================================
// #1 boundDistinctColorCount Condition (G17 残)
// ============================================================
describe('engine-additive-wave10 #1 boundDistinctColorCount', () => {
  beforeEach(() => {
    registerCardDef(ch('T_AO', { traits: ['探偵'], colors: ['青'] }));
    registerCardDef(ch('T_AO2', { traits: ['探偵'], colors: ['青'] }));
    registerCardDef(ch('T_AKA', { traits: ['探偵'], colors: ['赤'] }));
    registerCardDef(ch('K_AKA', { traits: ['警察'], colors: ['赤'] }));
    registerCardDef(ch('T_AOKURO', { traits: ['探偵'], colors: ['青', '黒'] }));
    registerCardDef(ch('T_AKASHIRO', { traits: ['探偵'], colors: ['赤', '白'] }));
    // filter.kind='character' gate の実証用 (trait を持つ event。イベントは通常 traits:[] だが gate を直接検証)
    registerCardDef({ ...ch('EV_TANTEI', { traits: ['探偵'], colors: ['赤'] }), kind: 'event' });
  });
  const cond = (n: number): Condition =>
    ({ kind: 'boundDistinctColorCount', bindKey: '$discarded', filter: { kind: 'character', trait: '探偵' }, n } as unknown as Condition);
  const bind = (...ids: string[]) => makeCtx({ bindings: { $discarded: ids.map(cardId => ({ cardId })) } });

  it('B07002 happy: 青探偵 + 赤探偵 (n=2) → true', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AO', 'T_AKA'))).toBe(true);
  });
  it('同色ペア (青+青) →「それぞれ色の異なる」不成立 → false', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AO', 'T_AO2'))).toBe(false);
  });
  it('片方 非探偵 (青探偵+赤警察) → filter 一致 1枚のみ → false', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AO', 'K_AKA'))).toBe(false);
  });
  it('bound 1枚のみ → false', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AO'))).toBe(false);
  });
  it('空 binding → false / binding 未設定 → false', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind())).toBe(false);
    expect(evalCond(createEmptyGameState(), cond(2), makeCtx())).toBe(false);
  });
  it('2色カード: {青,黒} + {青} → 青を共有 =「同じ色を持つ」→ false (rules/20)', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AOKURO', 'T_AO'))).toBe(false);
  });
  it('2色カード: {青,黒} + {赤,白} → 交差空 → true', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AOKURO', 'T_AKASHIRO'))).toBe(true);
  });
  it('3枚 bound (青,青,赤) 中に disjoint pair あり → true (subset 探索)', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AO', 'T_AO2', 'T_AKA'))).toBe(true);
  });
  it('event は filter.kind=character で除外 → false', () => {
    expect(evalCond(createEmptyGameState(), cond(2), bind('T_AO', 'EV_TANTEI'))).toBe(false);
  });
});

// ============================================================
// #2 setCutinBan / setDisguiseBan verb + turn-flag gate
// ============================================================
describe('engine-additive-wave10 #2 setCutinBan/setDisguiseBan + canCutIn/canDisguise gate', () => {
  // カットイン札 (Option C 統合形: triggered/on-hand/effect:declared/optional)
  const CUT: CardDef = {
    id: 'CUT', no: '9/CUT', kind: 'event', names: ['CUT'], colors: ['青'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [{ id: 'ci', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'cutin', ruleRefs: [] }],
    ruleRefs: [],
  };
  // 変装札 (icon-disguise、ゲート条件なしの pure disguise = D06012 最小形)
  const DISG: CardDef = {
    id: 'DISG', no: '9/DISG', kind: 'character', names: ['DISG'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: ['変装'], rarity: 'C', imageUrl: '',
    abilities: [{ id: 'a1', type: 'icon-disguise', description: '変装', ruleRefs: [] }],
    ruleRefs: [],
  };
  function setup(): { s: GameState; ax: ActionContext } {
    registerCardDef(CUT);
    registerCardDef(DISG);
    registerCardDef(ch('ACTOR'));
    registerCardDef(ch('TGT'));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('ACTOR', 'act')]; // ターンP (self) の actor
    s.players.opp.scene = [sceneChar('TGT', 'x', { state: 'sleep' })]; // アクション対象 (防御側コンタクトキャラ)
    s.players.self.hand = ['CUT', 'DISG'];
    s.players.opp.hand = ['CUT', 'DISG'];
    const ax: ActionContext = { id: 'ax1', byUid: 'act', byPlayer: 'self', target: { kind: 'char', uid: 'x' }, phase: 'guard-window', startedAt: { turn: 1, nano: 0 } };
    return { s, ax };
  }

  it('verb: setCutinBan{player:opp} → turnState.opp.cutinBanned=true (source=self)', () => {
    const { s } = setup();
    runAtom(s, 'setCutinBan', { player: 'opp' }, makeCtx());
    expect(s.turnState.opp.cutinBanned).toBe(true);
    expect(s.turnState.self.cutinBanned).not.toBe(true);
  });
  it('verb: setDisguiseBan{player:opp} → turnState.opp.disguiseBanned=true', () => {
    const { s } = setup();
    runAtom(s, 'setDisguiseBan', { player: 'opp' }, makeCtx());
    expect(s.turnState.opp.disguiseBanned).toBe(true);
    expect(s.turnState.self.disguiseBanned).not.toBe(true);
  });
  it('verb: player 省略 → 所有者側 (setNextHintBan と同じ resolvePlayer 規約)', () => {
    const { s } = setup();
    runAtom(s, 'setCutinBan', {}, makeCtx());
    expect(s.turnState.self.cutinBanned).toBe(true);
  });
  it('gate: cutinBanned(opp) → opp のカットイン不可 / self は可 / 変装は不阻害', () => {
    const { s, ax } = setup();
    expect(canCutIn(s, ax, 'opp', 'CUT'), 'baseline').toBe(true);
    s.turnState.opp.cutinBanned = true;
    expect(canCutIn(s, ax, 'opp', 'CUT'), 'ban 後 opp 不可').toBe(false);
    expect(canCutIn(s, ax, 'self', 'CUT'), 'self は可').toBe(true);
    expect(canDisguise(s, ax, 'opp', 'DISG'), 'cutinBanned は変装を阻害しない').toBe(true);
  });
  it('gate: disguiseBanned(opp) → opp の変装不可 / self は可 / カットインは不阻害', () => {
    const { s, ax } = setup();
    expect(canDisguise(s, ax, 'opp', 'DISG'), 'baseline (防御側 x が対象)').toBe(true);
    s.turnState.opp.disguiseBanned = true;
    expect(canDisguise(s, ax, 'opp', 'DISG'), 'ban 後 opp 不可').toBe(false);
    expect(canDisguise(s, ax, 'self', 'DISG'), 'self (actor 側) は可').toBe(true);
    expect(canCutIn(s, ax, 'opp', 'CUT'), 'disguiseBanned はカットインを阻害しない').toBe(true);
  });
  it('清掃: resetTurnFlags(turn:start) で両 flag 解除 (「このターン中」rules/15)', () => {
    const { s, ax } = setup();
    s.turnState.opp.cutinBanned = true;
    s.turnState.opp.disguiseBanned = true;
    mutateFlag.resetTurnFlags(s, 'opp');
    expect(s.turnState.opp.cutinBanned).toBe(false);
    expect(s.turnState.opp.disguiseBanned).toBe(false);
    expect(canCutIn(s, ax, 'opp', 'CUT')).toBe(true);
    expect(canDisguise(s, ax, 'opp', 'DISG')).toBe(true);
  });
});
