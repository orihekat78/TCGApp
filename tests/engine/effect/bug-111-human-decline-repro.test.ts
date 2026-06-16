// BUG-111 manifestation #2 REPRO — human-decline 経路の chain-gate / 必須末尾。
//
// 目的: 「0-pick (max:1=min:0, 「〜まで」/「〜してもよい」) を candidate 在で human-decline したとき」、
//   後続 step の扱いが構造 (chain か sequence か) により正しく分岐するかを実機 (production decline 経路)
//   で踏む。AI greedy auto-pick (certify 経路) は decline しないため masking される (本ファイル下段で実証)。
//
// 期待 (rules/15, 25 「そうした場合」chain-gate / sequence 独立 step):
//   - chain[0-pick, step2]      : step1 を decline → step2 は **発火しない** (chain break = 「そうした場合」不成立)
//   - sequence[0-pick, mandatory]: step1 を decline → mandatory tail は **発火する** (sequence step は独立)
//
// 対応カード (全て DEFER): B05028 (chain[charRemoveSetCard, sceneRemove]) / B09056 (seq mandatory choice) /
//   B09038 (seq mandatory draw)。本 repro は両 manifestation を最小合成 def で再現する。
//
// rules: 15-abilities-effects.md / 25-qa-effects-resolution.md / 16-card-set.md
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { event } from '@/engine/event/index';
import { useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueueLen = (): number => (g.__pendingEffectPickQueue ?? []).length;
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- 合成 declared-ability char (abilities は本体のみ — 再帰トリガー無し) ----
function makeReproDef(id: string, ability: AbilityDef): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [ability], ruleRefs: [],
  } as unknown as CardDef;
}

const CHAIN_ID = 'REPRO_CHAIN'; // chain[charRemoveSetCard(0-pick), sceneRemove] = B05028 a1 同型
const SEQ_ID = 'REPRO_SEQ';     // sequence[charRemoveSetCard(0-pick), draw] = B09038 mandatory-tail 同型
const SEQ_CHOICE_ID = 'REPRO_SEQ_CHOICE'; // sequence[charRemoveSetCard(0-pick), choice[A,B]] = B09056 同型 (既知 gap)
const DECOY_ID = 'REPRO_DECOY'; // step2 sceneRemove の対象 (AP≤8000 の opp char)

// B05028 a1 を **正確に** 再構築 (side:'either' 両ステップ、condition/limit は effect 機構に無関係なので省略)。
const chainAbility: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', max: 1, side: 'either', filter: { hasSetCards: true } } },
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
    ],
  },
  description: 'chain repro (B05028 a1 同型)', ruleRefs: [],
};

const seqAbility: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', max: 1, side: 'self', filter: { hasSetCards: true } } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: 'sequence repro', ruleRefs: [],
};

// B09056 同型: 末尾が2択 choice。chooser:self。option0=draw1 / option1=draw2 で自動選択を観測可能化。
const seqChoiceAbility: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', max: 1, side: 'self', filter: { hasSetCards: true } } },
      {
        kind: 'choice', chooser: 'self',
        options: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
        ],
      },
    ],
  },
  description: 'sequence-choice repro (B09056 同型)', ruleRefs: [],
} as unknown as AbilityDef;

function baseState(sourceCardId: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main' } as GameState['turn'];
  // source char (set-card 保持 → charRemoveSetCard の唯一の候補 = 自身)
  s.players.self.scene = [sceneChar(sourceCardId, 'src#0', { state: 'active', setCards: [{ cardId: 'X', faceUp: false }] })];
  // opp decoy char (AP4000 ≤ 8000 → chain step2 sceneRemove の対象)
  s.players.opp.scene = [sceneChar(DECOY_ID, 'decoy#0', { state: 'sleep' })];
  // deck に 5 枚 (draw 観測用)
  s.players.self.deck = ['d1', 'd2', 'd3', 'd4', 'd5'];
  s.players.self.hand = [];
  return s;
}

function register(): void {
  registerCardDef(makeReproDef(CHAIN_ID, chainAbility));
  registerCardDef(makeReproDef(SEQ_ID, seqAbility));
  registerCardDef(makeReproDef(SEQ_CHOICE_ID, seqChoiceAbility));
  registerCardDef({
    id: DECOY_ID, no: `9/${DECOY_ID}`, kind: 'character', names: [DECOY_ID], colors: ['緑'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef);
}

/** declared ability を発動 → chain/seq が step1 で pause → pending を store へ surface。 */
function fireAndSurface(s0: GameState, sourceCardId: string): GameState {
  const s1 = produce(s0, (d) => {
    const ctx = { source: { cardId: sourceCardId, uid: 'src#0', abilityId: 'a1', player: 'self' as const, area: 'scene' }, bindings: {} };
    useDeclaredAbility(d, 'src#0', 'a1', ctx);
    runAllUntilEmpty(d);
  });
  useGameStateStore.getState().setGameState(s1);
  surfacePendingSideChannels(); // queue → store.pendingEffectPick
  return s1;
}

describe('BUG-111 #2 — human-decline 経路の chain-gate / mandatory-tail', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    resetDefRegistry();
    registerAll();
    register();
    registerTriggeredListener();
    useGameStateStore.getState().setGameState(null);
    useGameStateStore.getState().setPendingEffectPick(null);
  });
  afterAll(() => setHuman(null));

  it('chain[0-pick, sceneRemove]: step1 を decline → step2 は発火しない (chain break)', () => {
    setHuman('self');
    fireAndSurface(baseState(CHAIN_ID), CHAIN_ID);
    // step1 pending が surface しているはず
    const pendingBefore = useGameStateStore.getState().pendingEffectPick;
    expect(pendingBefore?.atomVerb).toBe('charRemoveSetCard');

    // 0枚 decline
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState();
    // 期待: step2 sceneRemove が発火しない = opp decoy が現場に残る + 新たな pending pick が surface しない
    const oppScene = after.gameState!.players.opp.scene;
    expect(oppScene.length).toBe(1); // decoy がリムーブされていない
    expect(after.pendingEffectPick).toBeNull(); // step2 sceneRemove の pick が surface していない
    expect(pickQueueLen()).toBe(0);
    setHuman(null);
  });

  it('chain (フル dispatch 経路): declaredAbility → decline → step2 不発火 (path fidelity 確認)', () => {
    setHuman('self');
    useGameStateStore.getState().setGameState(baseState(CHAIN_ID));
    // 完全な production 経路: declaredAbility を dispatch (isAllowed → activateDeclaredAbility → runAllUntilEmpty)
    const r1 = dispatchEngineAction({ type: 'declaredAbility', uid: 'src#0', abilId: 'a1' });
    expect(r1.ok).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('charRemoveSetCard');
    // decline
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
    const after = useGameStateStore.getState();
    const total = after.gameState!.players.self.scene.length + after.gameState!.players.opp.scene.length;
    expect(total).toBe(2); // step2 sceneRemove 不発火 → 両 char 残存
    expect(after.pendingEffectPick).toBeNull(); // step2 の pick が surface しない
    setHuman(null);
  });

  it('sequence[0-pick, draw]: step1 を decline → mandatory tail (draw) は発火する', () => {
    setHuman('self');
    fireAndSurface(baseState(SEQ_ID), SEQ_ID);
    const pendingBefore = useGameStateStore.getState().pendingEffectPick;
    expect(pendingBefore?.atomVerb).toBe('charRemoveSetCard');

    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState();
    // 期待: draw 1 が発火 = hand +1 / deck -1
    expect(after.gameState!.players.self.hand.length).toBe(1);
    expect(after.gameState!.players.self.deck.length).toBe(4);
    setHuman(null);
  });

  it('choice-tail は壊さない (double-run 無し): sequence[0-pick, choice] decline → choice は pending 維持・remainder-run は no-op', () => {
    // 観測実機 (2026-06-16): 末尾 choice は初期 walk で eager surface する (pendingEffectChoice SET)。
    // decline 時の my fix の remainder-run は marker への no-op で auto-option0 も二重実行も起こさない。
    // → choice/optional-tail の 6 出荷カード (B04080/B07079/B07055/B07031) を回帰させない保証。
    // ※ B09056 を本修正で解禁しないのは別理由: eager-surface は optional wrapper 未達でも surface する
    //   fragile な挙動 (BUG-145 系) で、B09056 の optional[seq[..,choice]] 構造での正しさが未検証のため。
    setHuman('self');
    useGameStateStore.getState().setPendingEffectChoice(null);
    useGameStateStore.getState().setGameState(baseState(SEQ_CHOICE_ID));
    dispatchEngineAction({ type: 'declaredAbility', uid: 'src#0', abilId: 'a1' });
    expect(useGameStateStore.getState().pendingEffectChoice).not.toBeNull(); // eager surface

    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null }); // 0-pick decline
    const afterDecline = useGameStateStore.getState();
    expect(afterDecline.pendingEffectChoice).not.toBeNull(); // choice は pending 維持
    expect(afterDecline.gameState!.players.self.hand.length).toBe(0); // auto-option0 していない (draw 未発火)

    dispatchEngineAction({ type: 'choiceResolve', choiceIndex: 1 }); // option1 = draw 2 を human が選ぶ
    const afterChoice = useGameStateStore.getState();
    expect(afterChoice.gameState!.players.self.hand.length).toBe(2); // draw 2 のみ (二重実行なら 3)
    setHuman(null);
  });

  it('control: AI auto-pick (humanSide=null) は chain step1 を greedy 解決 → step2 も発火 (masking 実証)', () => {
    setHuman(null);
    const policy = new HeuristicPolicy();
    // chain: AI が set-card を pick → step1 適用 → chain step2 sceneRemove も発火
    const sc = produce(baseState(CHAIN_ID), (d) => {
      const ctx = { source: { cardId: CHAIN_ID, uid: 'src#0', abilityId: 'a1', player: 'self' as const, area: 'scene' }, bindings: {} };
      useDeclaredAbility(d, 'src#0', 'a1', ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, policy); // policy.playTurn 相当 (runAllUntilEmpty は AI pick を drain しない)
      runAllUntilEmpty(d);
    });
    // AI greedy で step1 解決 → step2 発火 → 候補 (src/decoy) のどちらかが removed (合計 2→1)
    const total = sc.players.self.scene.length + sc.players.opp.scene.length;
    expect(total).toBe(1);
  });
});
