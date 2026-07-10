// m1-megasweep probe — B05015 小嶋元次 (character, engine変更0)
//
// 印字 (ground truth, payloads/B05015.json fullTexts):
//   a1 (effect):   相手が〚ミスリード〛したとき、ターン終了時までこのキャラをAP＋3000する。
//   a2 (hirameki): 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある
//                  レベル6以下の〚カード名［小嶋元太］〛を1枚まで選び、登場させる。
//   qA: 「ミスリードしたキャラ1枚ごとに能力が発動する」→ 2枚ミスリードなら AP＋6000。
//
// DSL:
//   a1 = triggered hook 'misread:performed' + condition triggerPlayerIs{side:opp}
//        → charModifyAP{ uid:$self, delta:3000, scope:turn }
//   a2 = triggered hook 'evidence:remove-by-action' optional (=ヒラメキ)
//        → sceneEnter{ player:self, from:remove, max:1, viaEffect:true,
//                      filter:{ cardName:小嶋元太, levelMax:6, kind:character } }
//
// novel 経路 = production dispatch:
//   a1: listeners/misread の AI defender(opp) 経路が実 emit する misread:performed を
//       doReasoning(self 推理) 経由で踏む。triggerPlayerIs{opp} は payload.player ⇔ ability owner の
//       相対判定 (cond/eval.ts:263) — 「相手が」= owner の相手が misread したときのみ発火。
//   a2: emit 'evidence:remove-by-action' → triggered.ts が optional hook を検出し pendingHirameki を
//       push → dispatchEngineAction('hiramekiResolve', fire) が effect を queue + AI pick 解決
//       (bug-140-hirameki-batch と同一 harness = 実 UI 発火経路)。
//
// BUG-174 (owner 反転しない pin): a1 を owner=opp 側に置き、「相手(=self)が misread」時のみ発火 /
//   owner 自身(opp)が misread しても発火しない、を direct-emit で相対性を pin。
// BUG-117/118 (filter 実評価): a2 で レベル6以下 小嶋元太 のみ登場 / Lv7 小嶋元太(level decoy) と
//   非小嶋元太キャラ(name decoy) は remove に残る、を実 engine 評価で踏む。
// 「1枚まで」= 0 選択許容: ヒラメキ skip → 有効候補があっても何も登場しない (optional gate)。
// beforeEach で registry 再登録 → event._resetRegistry() 必須 (handler 累積で N 重発火)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import {
  registerMisreadListener,
  _resetMisreadRegistered,
  _resetPendingMisread,
} from '@/engine/listeners/misread';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { read } from '@/engine/read/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { doReasoning } from '@/engine/flow/main/reasoning';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar as baseScene } from '../../helpers/fixtures';
import type { GameState, SceneCharacter, CardDef, AbilityDef } from '@/engine/types';
import { B05015 } from '@/cards/ct-p05/B05015';

type Player = 'self' | 'opp';
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  baseScene(cardId, uid, { state });
const setHuman = (s: Player | null) =>
  ((globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s);

function chDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as unknown as CardDef;
}
// ミスリード1 キャラ (icon-misread marker x1) — listeners/misread が candidate 化
const misreadDef = (id: string, x = 1): CardDef =>
  chDef(id, {
    abilities: [{
      id: 'm', type: 'icon-misread', scope: 'on-scene',
      effect: { kind: 'atom', verb: 'noop', args: { kind: 'misread-marker', x } },
      description: `ミスリード${x}`, ruleRefs: [],
    } as unknown as AbilityDef],
  });

// ─────────────────────────────────────────────────────────────
// a1 — 相手がミスリードしたとき AP＋3000 (misread:performed + triggerPlayerIs opp)
// ─────────────────────────────────────────────────────────────
describe('B05015 a1 — 相手がミスリードしたとき ターン終了時まで AP＋3000', () => {
  const MR = 'MR_MISREAD';
  const REASONER = 'REASONER';

  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetMisreadRegistered();
    _resetPendingMisread();
    resetDefRegistry();
    _resetUidCounter();
    setHuman(null);
    registerCardDef(B05015);
    registerCardDef(misreadDef(MR, 1));
    registerCardDef(chDef(REASONER, { names: ['reasoner'], lp: 1 }));
    registerTriggeredListener();
    registerMisreadListener();
  });

  // self 推理 → AI defender(opp) が misread を実 emit → B05015(self) が観測
  function board(nMisread: number, reasonerLp: number): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.deck = ['SD1', 'SD2', 'SD3', 'SD4'];
    s.players.self.scene = [sc('B05015', 'kojima'), { ...sc(REASONER, 'r1'), lpOverride: reasonerLp } as SceneCharacter];
    s.players.opp.scene = [];
    for (let i = 0; i < nMisread; i++) s.players.opp.scene.push(sc(MR, `mr${i}`));
    return s;
  }
  const fire = (s0: GameState) => produce(s0, (d) => { doReasoning(d, 'r1'); runAllUntilEmpty(d); });
  const apOf = (s: GameState, uid: string) => read.char.ap(s, uid);

  it('相手キャラ1枚がミスリード → B05015 は AP 6000→9000 (実 emit path)', () => {
    const after = fire(board(1, 1));
    expect(read.char.state(after, 'mr0'), 'ミスリード実行 → 相手 misread キャラは sleep').toBe('sleep');
    expect(apOf(after, 'kojima'), 'AP 6000 + 3000(turn)').toBe(9000);
  });

  it('相手キャラ2枚がミスリード → 1枚ごとに発動 → AP＋6000 = 12000 (公式 qA)', () => {
    // reasoner LP2 → heuristic が 2 枚とも採用 (acc 2 ≥ targetLp 2) → misread:performed ×2
    const after = fire(board(2, 2));
    expect(read.char.state(after, 'mr0'), 'misread キャラ1 sleep').toBe('sleep');
    expect(read.char.state(after, 'mr1'), 'misread キャラ2 sleep').toBe('sleep');
    expect(apOf(after, 'kojima'), '3000 × 2 回発動 = +6000').toBe(12000);
  });

  it('off-variant: 自分(=B05015 owner)がミスリードしても発火しない (triggerPlayerIs opp)', () => {
    // direct emit — misread.ts が発する同一 hook。payload.player=self = owner 自身 → triggerPlayerIs{opp} 偽。
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sc('B05015', 'kojima')];
    const after = produce(s, (d) => {
      event.emit(d, 'misread:performed', { player: 'self' }, { player: 'self', uid: 'kojima' });
      runAllUntilEmpty(d);
    });
    expect(apOf(after, 'kojima'), 'owner 自身の misread → 発火せず AP 不変').toBe(6000);
  });

  it('owner 反転 pin (BUG-174): owner=opp のとき「相手(=self)が misread」で +3000 / owner 自身では発火しない', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.opp.scene = [sc('B05015', 'kojimaOpp')];
    // self(=opp の相手) が misread → owner=opp 視点で「相手が」成立 → 発火
    const hit = produce(s, (d) => {
      event.emit(d, 'misread:performed', { player: 'self' }, { player: 'self', uid: 'x' });
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(hit, 'kojimaOpp'), 'owner=opp: 相手(self) misread → +3000').toBe(9000);
    // opp 自身(owner)が misread → 発火しない
    const miss = produce(s, (d) => {
      event.emit(d, 'misread:performed', { player: 'opp' }, { player: 'opp', uid: 'kojimaOpp' });
      runAllUntilEmpty(d);
    });
    expect(read.char.ap(miss, 'kojimaOpp'), 'owner=opp: 自身 misread → AP 不変').toBe(6000);
  });
});

// ─────────────────────────────────────────────────────────────
// a2 — 【ヒラメキ】リムーブの レベル6以下 小嶋元太 を1枚まで登場 (evidence:remove-by-action)
// ─────────────────────────────────────────────────────────────
describe('B05015 a2 — 【ヒラメキ】リムーブの レベル6以下[小嶋元太]を1枚まで登場', () => {
  const KOJI6 = 'KOJIMOTA_L6';   // 小嶋元太 Lv6 → 対象
  const KOJI7 = 'KOJIMOTA_L7';   // 小嶋元太 Lv7 → levelMax6 で除外 (level decoy)
  const OTHER = 'OTHER_L3';      // 非小嶋元太 Lv3 → cardName 不一致で除外 (name decoy)

  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetHiramekiRegistered();
    _resetPendingHirameki();
    resetDefRegistry();
    _resetUidCounter();
    setHuman(null);
    registerCardDef(B05015);
    registerCardDef(chDef(KOJI6, { names: ['小嶋元太'], level: 6 }));
    registerCardDef(chDef(KOJI7, { names: ['小嶋元太'], level: 7 }));
    registerCardDef(chDef(OTHER, { names: ['歩美'], level: 3 }));
    registerTriggeredListener();
    registerHiramekiListener();
    useGameStateStore.setState({ gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null });
  });

  function evidenceState(): GameState {
    const s = createEmptyGameState();
    s.players.self.evidence = [{ cardId: 'B05015', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
    s.players.self.remove = [KOJI6, KOJI7, OTHER];
    s.players.self.deck = ['D1', 'D2'];
    return s;
  }
  // 実 UI 発火経路: emit → pendingHirameki → hiramekiResolve(fire) → sceneEnter pick が
  // pendingEffectPick(EffectPickerModal) に surface → effectPickResolve で pick/decline。
  function fireHirameki(s: GameState): void {
    event.emit(s, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B05015' } }, { player: 'opp', uid: 'atk' });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ optional hook 検出 → pending push').not.toBeNull();
    expect(pending!.cardId).toBe('B05015');
    useGameStateStore.setState({ gameState: s, pendingHirameki: pending });
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' });
    expect(r.ok, 'hiramekiResolve fire ok').toBe(true);
  }

  it('fire → pick で レベル6以下 小嶋元太(KOJI6) のみ登場 / Lv7 小嶋元太・非小嶋元太は remove に残る', () => {
    fireHirameki(evidenceState());
    // sceneEnter pick が EffectPickerModal に surface。候補は filter 実評価で KOJI6 のみに絞られている。
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick, 'sceneEnter pick が surface').not.toBeNull();
    expect(pick.candidates.map((c) => c.cardId), 'filter 実評価: 候補は Lv6 小嶋元太 のみ (Lv7/非小嶋元太 除外)').toEqual([KOJI6]);
    const r2 = dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pick.candidates[0].uid });
    expect(r2.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some((c) => c.cardId === KOJI6), 'Lv6 小嶋元太 が登場').toBe(true);
    expect(after.players.self.remove, 'KOJI6 は remove から抜けた').not.toContain(KOJI6);
    expect(after.players.self.remove, 'Lv7 小嶋元太 は remove に残る (levelMax6 除外)').toContain(KOJI7);
    expect(after.players.self.remove, '非小嶋元太 は remove に残る (cardName 除外)').toContain(OTHER);
  });

  it('decline (pickedUid=null) → 有効候補があっても何も登場しない (「1枚まで」= 0選択許容)', () => {
    fireHirameki(evidenceState());
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.candidates.map((c) => c.cardId)).toEqual([KOJI6]);
    expect(pick.nMin, '「1枚まで」→ 0 選択可 (nMin 0)').toBe(0);
    const r2 = dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
    expect(r2.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.length, '0 選択 → 誰も登場しない').toBe(0);
    expect([...after.players.self.remove].sort(), 'remove は全て残存').toEqual([KOJI6, KOJI7, OTHER].sort());
  });
});
