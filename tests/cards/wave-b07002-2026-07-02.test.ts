// wave-10 (2026-07-02) — B07002 江戸川コナン exemplar E2E probe。
// 新 primitive の生きた検証: boundDistinctColorCount cond + setCutinBan/setDisguiseBan (turn-flag) +
// BUG-165 fix (discard n:2 multi-pick) の実カード使用形。
//   a1: 【登場時】draw2 → discard2(bind) → 「それぞれ色の異なる探偵2枚なら」AP8000以下を1枚まで選びリムーブ。
//   a2: 【宣言】cost[このキャラか特徴[探偵]を1枚スリープ] → このターン中 相手はカットイン+変装不可。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { cards as engineCards } from '@/engine/cards/index';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/evaluate';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { drainAiEffectPicks, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength } from '@/engine/effect/resolve-picks';
import { canCutIn, canDisguise } from '@/engine/flow/contact';
import { flag as mutateFlag } from '@/engine/mutate/flag';
import { char as readChar } from '@/engine/read/char';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { B07002 } from '@/cards/ct-p07/B07002';
import { B07002P } from '@/cards/ct-p07/B07002P';
import { D02002 } from '@/cards/ct-d02/D02002';
import type { GameState, CardDef, EffectCtx, AbilityDef, ActionContext } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};

function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const CUT: CardDef = {
  id: 'CUT', no: '9/CUT', kind: 'event', names: ['CUT'], colors: ['青'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{ id: 'ci', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'cutin', ruleRefs: [] }],
  ruleRefs: [],
};
const DISG: CardDef = {
  id: 'DISG', no: '9/DISG', kind: 'character', names: ['DISG'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: ['変装'], rarity: 'C', imageUrl: '',
  abilities: [{ id: 'a1', type: 'icon-disguise', description: '変装', ruleRefs: [] }],
  ruleRefs: [],
};
function summonFrom(cardId: string): unknown {
  return { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId, viaEffect: true, target: { query: { area: 'remove', side: 'self' } } } };
}
const srcCtx = (): EffectCtx => ({ source: { cardId: 'SRC', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} });

describe('B07002 江戸川コナン — wave-10 exemplar', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetCardDefRegistry();
    for (const def of [
      B07002,
      pchar('T_AO', { traits: ['探偵'], colors: ['青'] }),
      pchar('T_AO2', { traits: ['探偵'], colors: ['青'] }),
      pchar('T_AKA', { traits: ['探偵'], colors: ['赤'] }),
      pchar('K_AKA', { traits: ['警察'], colors: ['赤'] }),
      pchar('LOWAP', { ap: 5000 }),
      pchar('OPPLOW', { ap: 4000 }),
      pchar('BIGAP', { ap: 9000 }),
      CUT, DISG,
    ]) {
      registerCardDef(def);
      engineCards.register(def);
    }
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  // ===== descriptor sanity =====
  it('descriptor: a1 enter(draw2→discard2 bind→conditional→sceneRemove) / a2 declared cost[sleepChar 探偵] → cutin+変装 ban', () => {
    expect(B07002).toMatchObject({ id: 'B07002', kind: 'character', level: 8, ap: 7000, lp: 2, colors: ['青'], traits: ['探偵', '毛利探偵事務所', '少年探偵団'] });
    const [a1, a2] = B07002.abilities as AbilityDef[];
    expect(a1).toMatchObject({ type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true } });
    const steps = (a1.effect as { steps: Array<{ kind: string; verb?: string; args?: Record<string, unknown>; if?: unknown; then?: unknown }> }).steps;
    expect(steps[0]).toMatchObject({ verb: 'draw', args: { player: 'self', n: 2 } });
    expect(steps[1]).toMatchObject({ verb: 'discard', args: { player: 'self', n: 2, bind: '$discarded' } });
    expect(steps[2]!.kind).toBe('conditional');
    expect(steps[2]!.if).toMatchObject({ kind: 'boundDistinctColorCount', bindKey: '$discarded', filter: { kind: 'character', trait: '探偵' }, n: 2 });
    // 「AP8000以下のキャラを1枚まで選び、リムーブする」= D02002 a1 step2 と VERBATIM (clone 原器)
    const d02002Step = (D02002.abilities[0]!.effect as { steps: Array<{ verb?: string; args?: unknown }> }).steps[1];
    expect(steps[2]!.then).toMatchObject({ kind: 'atom', verb: 'sceneRemove' });
    expect((steps[2]!.then as { args: unknown }).args).toEqual(d02002Step!.args);
    // a2
    expect(a2).toMatchObject({ type: 'declared', scope: 'on-scene' });
    expect(a2.limit, '【ターン1】表記なし → limit なし').toBeUndefined();
    const costItems = (a2.cost as { items: Array<{ kind: string }> }).items;
    expect(costItems.map(i => i.kind)).toEqual(['sleepChar']);
    const effSteps = (a2.effect as { steps: Array<{ verb?: string; args?: unknown }> }).steps;
    expect(effSteps.map(x => x.verb)).toEqual(['setCutinBan', 'setDisguiseBan']);
    expect(effSteps[0]!.args).toEqual({ player: 'opp' });
    expect(effSteps[1]!.args).toEqual({ player: 'opp' });
    // parallel
    expect(B07002P.abilities).toEqual(B07002.abilities);
    expect(B07002P.id).toBe('B07002P');
  });

  // ===== a1 human: enter → draw2 → discard pick surface (nMin=2) =====
  it('a1 human: 登場 → draw2 → discard pick surface (nMin=nMax=2、候補=手札全体)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['T_AO', 'T_AKA', 'PAD1'];
    s.players.self.hand = [];
    s.players.self.remove = ['B07002'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('B07002') as never, srcCtx());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand, 'draw2').toEqual(['T_AO', 'T_AKA']);
    expect(_peekPendingEffectPickQueueLength(), 'discard pick surface').toBeGreaterThanOrEqual(1);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('discard');
    expect(pending?.nMin, '「2枚リムーブする」= 固定 2').toBe(2);
    expect(pending?.nMax).toBe(2);
    _clearPendingEffectPickQueue();
    setHuman(null);
  });

  // ===== a1 happy (manual pick): 異色探偵2枚 → sceneRemove pick (apMax8000, side either) → リムーブ =====
  it('a1 happy: 異色探偵2枚リムーブ → AP8000以下 pick surface (両現場、AP9000 decoy 除外) → 選択リムーブ', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['T_AO', 'T_AKA', 'PAD1'];
    s.players.self.hand = [];
    s.players.self.scene = [sceneChar('LOWAP', 'w#1'), sceneChar('BIGAP', 'b#1')];
    s.players.opp.scene = [sceneChar('OPPLOW', 'ol#1'), sceneChar('BIGAP', 'ob#1')];
    s.players.self.remove = ['B07002'];
    runEffect(s, summonFrom('B07002') as never, srcCtx());
    runAllUntilEmpty(s);
    const discardPick = _drainPendingEffectPickSide();
    expect(discardPick?.atomVerb).toBe('discard');
    const uids = discardPick!.candidates.map(x => x.uid);
    expect(uids.length, '手札2枚 (forced)').toBe(2);
    applyPickAndContinuation(s, discardPick!, uids[0]!, uids);
    // 異色探偵2枚 → conditional true → sceneRemove PA pick surface
    expect(s.players.self.remove).toEqual(expect.arrayContaining(['T_AO', 'T_AKA']));
    const removePick = _drainPendingEffectPickSide();
    expect(removePick, 'conditional true → sceneRemove pick').toBeTruthy();
    expect(removePick!.atomVerb).toBe('sceneRemove');
    expect(removePick!.nMin, '「1枚まで」= 0可').toBe(0);
    expect(removePick!.nMax).toBe(1);
    const cand = removePick!.candidates.map(c => c.uid);
    expect(cand, '自現場 AP5000').toContain('w#1');
    expect(cand, '相手現場 AP4000 (side either)').toContain('ol#1');
    const b07002Uid = s.players.self.scene.find(c => c.cardId === 'B07002')!.uid;
    expect(cand, 'B07002 自身 (AP7000≤8000、unscoped=自身も可)').toContain(b07002Uid);
    expect(cand, 'AP9000 decoy 除外 (自)').not.toContain('b#1');
    expect(cand, 'AP9000 decoy 除外 (相手)').not.toContain('ob#1');
    applyPickAndContinuation(s, removePick!, 'ol#1');
    expect(s.players.opp.scene.find(c => c.uid === 'ol#1'), '選択キャラ リムーブ').toBeUndefined();
    expect(s.players.opp.remove).toContain('OPPLOW');
    setHuman(null);
  });

  // ===== a1 decline: sceneRemove は「まで」なので 0枚 (pending drop) 可 =====
  it('a1 decline: sceneRemove pick を drop → 何もリムーブされない (「1枚まで」=0可)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['T_AO', 'T_AKA', 'PAD1'];
    s.players.opp.scene = [sceneChar('OPPLOW', 'ol#1')];
    s.players.self.remove = ['B07002'];
    runEffect(s, summonFrom('B07002') as never, srcCtx());
    runAllUntilEmpty(s);
    const discardPick = _drainPendingEffectPickSide();
    applyPickAndContinuation(s, discardPick!, discardPick!.candidates[0]!.uid, discardPick!.candidates.map(x => x.uid));
    const removePick = _drainPendingEffectPickSide();
    expect(removePick?.atomVerb).toBe('sceneRemove');
    // drop (apply しない) = 辞退
    expect(s.players.opp.scene.find(c => c.uid === 'ol#1'), '辞退 → 残存').toBeTruthy();
    setHuman(null);
  });

  // ===== a1 false path (AI 全自動): 同色探偵2枚 → conditional false → リムーブ pick 無し =====
  it('a1 false (AI): 同色探偵2枚 → discard 2枚 (BUG-165 AI 経路) だが sceneRemove 発生せず', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['T_AO', 'T_AO2', 'PAD1'];
    s.players.self.hand = [];
    s.players.opp.scene = [sceneChar('OPPLOW', 'ol#1')];
    s.players.self.remove = ['B07002'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('B07002') as never, srcCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.hand.length, 'draw2 → discard2 (multi-pick fix)').toBe(0);
    expect(s.players.self.remove).toEqual(expect.arrayContaining(['T_AO', 'T_AO2']));
    expect(s.players.opp.scene.find(c => c.uid === 'ol#1'), '同色 → conditional false → リムーブ無し').toBeTruthy();
    expect(_peekPendingEffectPickQueueLength(), 'pending 残なし').toBe(0);
  });

  // ===== a1 false path: 探偵1枚+警察1枚 =====
  it('a1 false: 異色でも片方 非探偵 → conditional false', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['T_AO', 'K_AKA', 'PAD1'];
    s.players.opp.scene = [sceneChar('OPPLOW', 'ol#1')];
    s.players.self.remove = ['B07002'];
    s = produce(s, (d) => {
      runEffect(d, summonFrom('B07002') as never, srcCtx());
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.hand.length).toBe(0);
    expect(s.players.opp.scene.find(c => c.uid === 'ol#1'), '非探偵混在 → リムーブ無し').toBeTruthy();
  });

  // ===== a2: cost sleepChar (探偵 filter) → 相手 cutin+変装 ban / QA: 離場後も有効 / ターン境界で解除 =====
  it('a2: cost で探偵1枚スリープ → 相手のみ canCutIn/canDisguise false → 離場後も有効 (QA) → resetTurnFlags で解除', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07002', 'y#1'), sceneChar('T_AKA', 't#1'), sceneChar('K_AKA', 'k#1')];
    s.players.opp.scene = [sceneChar('OPPLOW', 'x#1', { state: 'sleep' })];
    s.players.self.hand = ['CUT', 'DISG'];
    s.players.opp.hand = ['CUT', 'DISG'];
    expect(canDeclaredAbility(s, 'y#1', 'a2'), '宣言可 (active 探偵あり)').toBe(true);
    s = produce(s, (d) => {
      activateDeclaredAbility(d, 'y#1', 'a2');
      runAllUntilEmpty(d);
    });
    // cost: 探偵 (y#1 or t#1) のうち 1枚だけ sleep、警察 k#1 は対象外
    const sleptTantei = ['y#1', 't#1'].filter(u => readChar.state(s, u) === 'sleep');
    expect(sleptTantei.length, 'cost: 探偵1枚のみ sleep').toBe(1);
    expect(readChar.state(s, 'k#1'), '警察は cost 対象外').toBe('active');
    // effect: 相手側 turn-flag
    expect(s.turnState.opp.cutinBanned).toBe(true);
    expect(s.turnState.opp.disguiseBanned).toBe(true);
    const ax: ActionContext = { id: 'ax1', byUid: 'y#1', byPlayer: 'self', target: { kind: 'char', uid: 'x#1' }, phase: 'guard-window', startedAt: { turn: 5, nano: 0 } };
    expect(canCutIn(s, ax, 'opp', 'CUT'), '相手カットイン不可').toBe(false);
    expect(canDisguise(s, ax, 'opp', 'DISG'), '相手変装不可').toBe(false);
    expect(canCutIn(s, ax, 'self', 'CUT'), '自分は可').toBe(true);
    // QA: 「使用した後でこのキャラが現場を離れても有効」— side-level flag
    s = produce(s, (d) => {
      d.players.self.scene = d.players.self.scene.filter(c => c.uid !== 'y#1');
    });
    expect(canCutIn(s, ax, 'opp', 'CUT'), 'B07002 離場後も有効 (QA)').toBe(false);
    expect(canDisguise(s, ax, 'opp', 'DISG'), '同上 (変装)').toBe(false);
    // 「このターン中」→ ターン境界 (turn:start resetTurnFlags) で解除
    s = produce(s, (d) => mutateFlag.resetTurnFlags(d, 'opp'));
    expect(canCutIn(s, ax, 'opp', 'CUT'), '次ターンは解除').toBe(true);
    expect(canDisguise(s, ax, 'opp', 'DISG'), '同上').toBe(true);
  });

  // ===== a2 cost 不可: active 探偵ゼロ (cost gate は UI 列挙層の engine.cost.canPay、wave-7 と同流儀で直叩き) =====
  it('a2 cost canPay: 探偵が全員 sleep → false (rules/21 コスト全払い) / active 探偵ありなら true', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07002', 'y#1', { state: 'sleep' }), sceneChar('T_AKA', 't#1', { state: 'sleep' }), sceneChar('K_AKA', 'k#1')];
    const ctx: EffectCtx = { source: { cardId: 'B07002', uid: 'y#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} };
    const a2cost = (B07002.abilities[1] as AbilityDef).cost!;
    expect(canPay(s, a2cost, ctx), 'active 探偵なし (警察のみ active) → 支払不可').toBe(false);
    s.players.self.scene = [sceneChar('B07002', 'y#1', { state: 'sleep' }), sceneChar('T_AKA', 't#1'), sceneChar('K_AKA', 'k#1')];
    expect(canPay(s, a2cost, ctx), 'active 探偵 (t#1) あり → 支払可 (自身 sleep でも他探偵で払える)').toBe(true);
  });
});
