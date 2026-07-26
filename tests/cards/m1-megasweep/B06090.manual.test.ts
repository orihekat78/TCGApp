// m1-megasweep probe — B06090 榎本梓 (character, engine変更0)
//
// 印字 (ground truth, payloads/B06090.json fullTexts):
//   a1 (effect):   【登場時】このキャラをスリープさせてもよい。そうした場合、自分のリムーブエリアにある
//                  レベル5以下の〚特徴［喫茶ポアロ］〛のキャラを1枚まで選び、登場させる。
//   a2 (hirameki): 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある
//                  〚特徴［喫茶ポアロ］〛のキャラを1枚まで選び、手札に加える。
//
// rules: 03 (状態), 10 (ヒラメキ = evidence:remove-by-action), 15 (「〜まで」=0枚可 / 「〜してもよい」=decline),
//        17 (【登場時】), 20 (効果による登場は色制限を受けない)。
//
// novel 経路 = production dispatch:
//   a1: enter(selfOnly) → optional[chain[sceneSetState{$self,sleep}, sceneEnter{from:remove, filter:
//       {trait:喫茶ポアロ, levelMax:5, kind:character}}]]。B09038 a2 と同 idiom (from:remove 版)。
//       driver = store + dispatchEngineAction (handUseCard → optionalResolve{run} → effectPickResolve)。
//       optional は AI 既定 skip (resolve-picks.ts:661) なので human 経路で opt-in を明示する。
//   a2: engine.event.emit('evidence:remove-by-action') で real trigger 発火 → hirameki listener が
//       pendingHirameki を set → resolveEffectPicks+runEffect+AI drain (B03078 a2 と同ハーネス)。
//       standalone atom (chain 無し) ゆえ B03078 の chain+owner=opp 二重 side バグは踏まない (opp でも正動作)。
// BUG-174: a2 owner='opp' 反転 pin — evidence 所有者相対で opp.remove→opp.hand が正しく解決される。
// beforeEach: registry 全 reset + event._resetRegistry + pending queue reset (handler 累積・
//   side-channel 残留で N 重発火/誤解決を回避)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B06090 } from '@/cards/ct-p06/B06090';
import type { GameState, CardDef, EffectCtx } from '@/engine/types';

type Player = 'self' | 'opp';
type G = { __pendingEffectPickQueue?: PendingEffectPickSide[]; __humanPlayerSide?: Player | null };
const g = globalThis as G;
const setHuman = (s: Player | null) => { g.__humanPlayerSide = s; };
const FB = { type: 'card-back' as const, cardId: 'FB' };

// synthetic decoy def — candidates が def の trait / level / kind を読むため実データを持たせる
function chDef(
  id: string, traits: string[], level: number, kind: 'character' | 'event' = 'character',
): CardDef {
  return {
    id, no: `9/${id}`, kind, names: [id], colors: ['黄'], level, ap: 1000, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}

// a1 (sceneEnter from:remove, filter{trait:喫茶ポアロ, levelMax:5, kind:character}) 候補 / decoy
const POARO_L5 = 'POARO_L5';   // 喫茶ポアロ / char / L5   = 唯一の有効候補
const POARO_L6 = 'POARO_L6';   // 喫茶ポアロ / char / L6   → levelMax:5 超で非対象
const DET_L3 = 'DET_L3';       // 探偵      / char / L3   → trait 違反で非対象
const POARO_EV = 'POARO_EV';   // 喫茶ポアロ / event / L3  → kind:character 違反で非対象
// a2 (handAddFromRemove, filter{trait:喫茶ポアロ, kind:character}) 候補 / decoy
const POARO_CH = 'POARO_CH';   // 喫茶ポアロ / char        = 有効候補 (self / opp 両用)
const DET_CH = 'DET_CH';       // 探偵      / char        → trait 違反で非対象
const POARO_EV2 = 'POARO_EV2'; // 喫茶ポアロ / event       → kind:character 違反で非対象
const SELF_DECOY = 'SELF_DECOY'; // opp シナリオで self 側 remove に置く反転検出用
const OPP_HAND = 'OPP_HAND';

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetHiramekiRegistered();
  _resetPendingHirameki();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  g.__pendingEffectPickQueue = [];
  resetDefRegistry();
  registerCardDef(B06090);
  registerCardDef(chDef(POARO_L5, ['喫茶ポアロ'], 5));
  registerCardDef(chDef(POARO_L6, ['喫茶ポアロ'], 6));
  registerCardDef(chDef(DET_L3, ['探偵'], 3));
  registerCardDef(chDef(POARO_EV, ['喫茶ポアロ'], 3, 'event'));
  registerCardDef(chDef(POARO_CH, ['喫茶ポアロ'], 4));
  registerCardDef(chDef(DET_CH, ['探偵'], 4));
  registerCardDef(chDef(POARO_EV2, ['喫茶ポアロ'], 4, 'event'));
  registerCardDef(chDef(SELF_DECOY, ['喫茶ポアロ'], 4));
  registerCardDef(chDef(OPP_HAND, ['探偵'], 4));
  registerTriggeredListener();
  registerHiramekiListener();
  setHuman(null);
  useGameStateStore.setState({
    gameState: null, pendingEffectOptional: null, pendingEffectPick: null,
    pendingEffectChoice: null, pendingHirameki: null, pendingMisread: null,
  } as never);
});

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const sortc = (a: readonly string[]): string[] => [...a].sort();

// ─── a1 driver: handUseCard('self') で B06090 登場 → enter optional surface → opt-in ───
// B06090 = 黄/L7 → 事件黄 + FILE7 で handUseCard 可 (rules/20 色制限 + rules/12 FILE≥level)。
function a1Base(remove: string[]): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.hand = ['B06090'];
  s.players.self.case.colors = ['黄'];
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7
  s.players.self.remove = [...remove];
  return s;
}
function fireA1(s: GameState, optRun: boolean): void {
  useGameStateStore.getState().setGameState(s);
  const r0 = dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'B06090' });
  expect(r0.ok, 'handUseCard ok').toBe(true);
  expect(useGameStateStore.getState().pendingEffectOptional, '【登場時】で optional surface (human)').not.toBeNull();
  const r1 = dispatchEngineAction({ type: 'optionalResolve', run: optRun });
  expect(r1.ok, `optionalResolve run=${optRun} ok`).toBe(true);
}

// ─── a2 driver: real emit で hirameki trigger 発火 → resolveEffectPicks + AI drain で解決 ───
function fireHirameki(evidenceOwner: Player, setup: (s: GameState) => void): GameState {
  const attacker: Player = evidenceOwner === 'self' ? 'opp' : 'self';
  let s = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 3, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    setup(d);
  });
  s = produce(s, (d) => {
    engine.event.emit(
      d, 'evidence:remove-by-action',
      { player: evidenceOwner, ev: { cardId: 'B06090' } },
      { player: attacker, uid: `${attacker}-attacker` },
    );
  });
  const pending = _drainPendingHirameki();
  expect(pending, 'ヒラメキ listener が pending を set').not.toBeNull();
  expect(pending!.cardId).toBe('B06090');
  expect(pending!.player).toBe(evidenceOwner);
  expect(pending!.abilityId).toBe('a2');
  const a2 = def.card('B06090')!.abilities.find((a) => a.id === 'a2')!.effect!;
  const ai = new HeuristicPolicy();
  const ctx = {
    source: { player: evidenceOwner, cardId: 'B06090', area: 'evidence', abilityId: 'a2' },
    bindings: {},
  } as unknown as EffectCtx;
  return produce(s, (d) => {
    const walked = resolveEffectPicks(d, a2 as never, ctx, {
      chooseAtomTarget: ai.chooseAtomTarget?.bind(ai), byPlayer: evidenceOwner, humanChooser: false,
      source: { cardId: 'B06090', abilityId: 'a2' },
    });
    runEffect(d, walked as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, ai);
      runAllUntilEmpty(d);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('B06090 a1 — 【登場時】 自スリープ→リムーブの[喫茶ポアロ]Lv5以下キャラを1枚まで登場', () => {
  it('happy: opt-in で B06090 sleep → リムーブの[喫茶ポアロ]Lv5 char を登場 (active) / L6・非ポアロ・event は候補外(decoy)', () => {
    setHuman('self');
    fireA1(a1Base([POARO_L5, POARO_L6, DET_L3, POARO_EV]), true);

    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending?.atomVerb, 'sceneEnter pick が surface').toBe('sceneEnter');
    expect(pending.nMin, '「1枚まで」= 0枚可').toBe(0);
    expect(pending.nMax, '上限1枚').toBe(1);
    const candIds = pending.candidates.map((c) => c.cardId);
    expect(candIds, '[喫茶ポアロ]Lv5 char が候補').toContain(POARO_L5);
    expect(candIds, 'Lv6 は levelMax:5 超で候補外(decoy)').not.toContain(POARO_L6);
    expect(candIds, '非[喫茶ポアロ]は候補外(decoy)').not.toContain(DET_L3);
    expect(candIds, '[喫茶ポアロ]event は kind:character 違反で候補外(decoy)').not.toContain(POARO_EV);
    // opt-in 済 → chain step0 で B06090 は sleep 済
    expect(useGameStateStore.getState().gameState!.players.self.scene.find((c) => c.cardId === 'B06090')?.state,
      'opt-in で B06090 は sleep 済').toBe('sleep');

    const cand = pending.candidates.find((c) => c.cardId === POARO_L5)!;
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: cand.uid });

    const after = useGameStateStore.getState().gameState!;
    const entered = after.players.self.scene.find((c) => c.cardId === POARO_L5);
    expect(entered, '[喫茶ポアロ]Lv5 が現場に登場').toBeTruthy();
    expect(entered?.state, '登場は active (enterSleep 無し)').toBe('active');
    expect(after.players.self.remove, 'POARO_L5 はリムーブから抜けた').not.toContain(POARO_L5);
    expect(sortc(after.players.self.remove), 'decoy 3枚はリムーブに残存').toEqual(sortc([POARO_L6, DET_L3, POARO_EV]));
    setHuman(null);
  });

  it('0-pick (「1枚まで」=0枚可): opt-in 後に登場を decline → B06090 は sleep のまま誰も登場しない', () => {
    setHuman('self');
    fireA1(a1Base([POARO_L5]), true); // 有効候補あり だが 0体 decline
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.nMin, '0枚 decline channel').toBe(0);
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find((c) => c.cardId === 'B06090')?.state, 'B06090 は sleep 済 (chain step0)').toBe('sleep');
    expect(inScene(after, POARO_L5), '0体 decline: 誰も登場しない').toBe(false);
    expect(after.players.self.remove, 'POARO_L5 はリムーブに残る').toContain(POARO_L5);
    setHuman(null);
  });

  it('optional decline (「〜してもよい」run=false): sleep もせず登場 pick も surface しない', () => {
    setHuman('self');
    fireA1(a1Base([POARO_L5]), false);
    const st = useGameStateStore.getState();
    expect(st.pendingEffectPick, 'run=false: sceneEnter pick は surface しない').toBeNull();
    expect(st.gameState!.players.self.scene.find((c) => c.cardId === 'B06090')?.state,
      'run=false: B06090 は active 維持 (sleep しない)').toBe('active');
    expect(inScene(st.gameState!, POARO_L5), 'run=false: 誰も登場しない').toBe(false);
    setHuman(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('B06090 a2 — 【ヒラメキ】 リムーブの[喫茶ポアロ]キャラを1枚まで手札へ', () => {
  it('happy: リムーブの[喫茶ポアロ]char を手札へ / 探偵char・[喫茶ポアロ]event は候補外(decoy)', () => {
    const after = fireHirameki('self', (s) => {
      s.players.self.remove = [DET_CH, POARO_EV2, POARO_CH]; // DET_CH/POARO_EV2=decoy, POARO_CH=候補
      s.players.self.hand = [];
    });
    expect(after.players.self.hand, '[喫茶ポアロ]char が手札に加わった').toContain(POARO_CH);
    expect(after.players.self.remove, 'POARO_CH はリムーブから抜けた').not.toContain(POARO_CH);
    expect(sortc(after.players.self.remove), 'decoy 2枚 (探偵char / ポアロevent) はリムーブに残存')
      .toEqual(sortc([DET_CH, POARO_EV2]));
    // 消失/複製なし
    expect(sortc([...after.players.self.hand, ...after.players.self.remove]), 'カードの消失/複製なし')
      .toEqual(sortc([DET_CH, POARO_EV2, POARO_CH]));
  });

  it('reversal pin (BUG-174): owner=opp — opp.remove の[喫茶ポアロ]char が opp.hand へ / self 側は不変', () => {
    const after = fireHirameki('opp', (s) => {
      s.players.opp.remove = [POARO_CH];
      s.players.opp.hand = [OPP_HAND];
      s.players.self.remove = [SELF_DECOY]; // self 側 [喫茶ポアロ] decoy — 反転すれば誤って拾われる
      s.players.self.hand = [];
    });
    expect(after.players.opp.hand, 'opp.remove の POARO_CH が opp.hand へ (evidence 所有者相対)').toContain(POARO_CH);
    expect(after.players.opp.remove, 'POARO_CH は opp.remove から抜けた').not.toContain(POARO_CH);
    expect(after.players.self.remove, 'self 側 SELF_DECOY は不変 (side 反転していない)').toEqual([SELF_DECOY]);
    expect(after.players.self.hand, 'self 側 hand は空のまま').toEqual([]);
  });
});
