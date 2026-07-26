// BUG-135 回帰ガード — sequence 中間の nMin=0 pick を human-decline したとき、後続の必須 remainder が
//   実行されることを実出荷カードで踏む。
//
// 背景: BUG-135 (2026-06-12 起票) は「skip=pending 破棄で対の continuation も drop → sequence 中間の
//   必須 step が脱落しうる」を懸念した。だが BUG-111 #2 (2026-06-16) で skip 経路が continuation を
//   origin-kind で gate しつつ実行するよう構造修正済 (sequence-origin remainder は実行 / chain-origin は gate)。
//   本テストは「実際に sequence 中間 skippable pick + 必須 remainder を持つ唯一の出荷カード 2 枚」が
//   その挙動に従うことを production decline 経路 (dispatchEngineAction) で 1対1 検証する回帰ガード。
//   (synthetic 機構証明は tests/engine/effect/bug-111-human-decline-repro.test.ts。本ファイルは実カード版。)
//
// 対象カード (決定論 scan 2026-06-22 で確定した sequence-非終端-skippable-pick 形):
//   - PR155 阿笠博士 a1: sequence[ sceneEnter(hand 灰原哀 lv≤6, max:1), draw(n:1) ]
//       → sceneEnter を decline (誰も登場させない) でも draw は無条件発火 (rules/15「〜し、〜引く」)
//   - D03002 怪盗キッド a1: chain[ discard(max:1), sequence[ sceneSetState(pick min:0), evidenceGain(n:1) ] ]
//       → discard を適用 (chain proceed) 後、sceneSetState を decline でも evidenceGain は発火
//         (sequence 各 step は独立)。chain-step→内側 sequence の nest で remainder が脱落しない保証。
//
// rules: 15-abilities-effects.md (§各 step 独立 /「〜してもよい」), 25-qa-effects-resolution.md
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as unknown as CardDef;
}

const HAI = 'HAI_SYN';   // 灰原哀 char Lv3 (PR155 sceneEnter 候補)
const JUNK = 'JUNK_SYN'; // 非候補 hand card
const PWHITE = 'PWHITE';  // 白 partner (D03002 partnerColor 条件成立用)
const HC = 'HC_SYN';     // D03002 discard 候補 (hand)
const STUNTGT = 'STUN_SYN'; // D03002 sceneSetState 候補 (opp scene)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  g.__pendingEffectPickQueue = [];
  resetDefRegistry();
  registerAll(); // PR155 / D03002 込み
  registerCardDef(ch(HAI, { names: ['灰原哀'], level: 3, kind: 'character' }));
  registerCardDef(ch(JUNK, { names: ['雑魚'], level: 9, kind: 'character' }));
  registerCardDef(ch(PWHITE, { names: ['白パートナー'], colors: ['白'], kind: 'partner' }));
  registerCardDef(ch(HC, { names: ['手札カード'], level: 4, kind: 'character' }));
  registerCardDef(ch(STUNTGT, { names: ['対象'], level: 4, kind: 'character' }));
  registerTriggeredListener();
  useGameStateStore.getState().setGameState(null);
  useGameStateStore.getState().setPendingEffectPick(null);
});
afterAll(() => setHuman(null));

/** enter hook を emit して a1 を発火 → pick を store へ surface。 */
function fireEnterAndSurface(s0: GameState, uid: string, cardId: string): void {
  const s1 = produce(s0, (d) => {
    event.emit(d, 'enter', { uid, player: 'self', enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', cardId, uid });
    runAllUntilEmpty(d);
  });
  useGameStateStore.getState().setGameState(s1);
  surfacePendingSideChannels();
}

describe('BUG-135 回帰 — sequence 中間 skippable pick の decline で必須 remainder が実行される', () => {
  it('PR155 a1: sceneEnter(灰原哀 1枚まで) を decline → draw は無条件発火 (誰も登場しない)', () => {
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.scene = [sceneChar('PR155', 'pr0', { state: 'active' })];
      d.players.self.hand = [HAI, JUNK];
      d.players.self.deck = ['d1', 'd2', 'd3'];
    });
    fireEnterAndSurface(s0, 'pr0', 'PR155');

    // step1 sceneEnter pick が surface (候補 = 灰原哀 のみ、JUNK は名前不一致で除外)
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.atomVerb).toBe('sceneEnter');
    expect(pending?.candidates.map((c) => c.cardId)).toEqual([HAI]);

    // sceneEnter を decline (0枚 = 誰も登場させない)
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState().gameState!;
    // 期待: 誰も登場しない (scene は PR155 のみ) + draw 1 が発火 (hand 2→3 / deck 3→2)
    expect(after.players.self.scene.length).toBe(1);
    expect(after.players.self.hand.length).toBe(3);
    expect(after.players.self.deck.length).toBe(2);
    // 灰原哀 は手札に残る (登場辞退)
    expect(after.players.self.hand).toContain(HAI);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    setHuman(null);
  });

  it('D03002 a1: chain[discard, sequence[sceneSetState, evidenceGain]] — discard 適用 → 内側 sequence の必須 remainder (evidenceGain) が脱落しない', () => {
    // 内側 sequence の sceneSetState も human decision として surface する。decline 後も
    // 後続の必須 evidenceGain は脱落せず発火する (= BUG-135 が懸念した remainder-drop は起きない)。
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.partner.cardId = PWHITE; // 【パートナー白】成立
      d.players.self.scene = [sceneChar('D03002', 'kid0', { state: 'active' })];
      d.players.self.hand = [HC];
      d.players.self.deck = ['e1', 'e2'];
      d.players.opp.scene = [sceneChar(STUNTGT, 'st0', { state: 'sleep' })];
    });
    fireEnterAndSurface(s0, 'kid0', 'D03002');

    // step1 = discard(max:1) pick が surface (候補 = 手札 HC)
    const p1 = useGameStateStore.getState().pendingEffectPick;
    expect(p1?.atomVerb).toBe('discard');
    const hcUid = p1!.candidates.find((c) => c.cardId === HC)!.uid;

    // discard を適用 (HC をリムーブ) → chain proceed → 内側 sequence の sceneSetState pick が surface
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: hcUid });
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('sceneSetState');
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState().gameState!;
    // 期待: 必須 remainder evidenceGain が発火 (証拠 +1) — chain→内側sequence の nest で remainder 脱落なし
    expect(after.players.self.evidence.length).toBe(1);
    // sceneSetState を decline したため、誰もスタンしていない (kid0 active / st0 sleep のまま)
    expect(after.players.self.scene.find((c) => c.uid === 'kid0')!.state).toBe('active');
    expect(after.players.opp.scene.find((c) => c.uid === 'st0')!.state).toBe('sleep');
    // HC は discard 済 (手札 0 / リムーブ +1)
    expect(after.players.self.hand.length).toBe(0);
    expect(after.players.self.remove).toContain(HC);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    setHuman(null);
  });

  it('control: D03002 a1 discard 自体を decline → chain break (step2 sequence 不発火 = 証拠 +0)', () => {
    // chain head の decline は「そうした場合」不成立 → step2 全体が gate される (BUG-135 不変条件の chain 側)。
    setHuman('self');
    const s0 = produce(createEmptyGameState(), (d) => {
      d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.partner.cardId = PWHITE;
      d.players.self.scene = [sceneChar('D03002', 'kid0', { state: 'active' })];
      d.players.self.hand = [HC];
      d.players.self.deck = ['e1', 'e2'];
      d.players.opp.scene = [sceneChar(STUNTGT, 'st0', { state: 'sleep' })];
    });
    fireEnterAndSurface(s0, 'kid0', 'D03002');
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('discard');

    // discard を decline (手札を捨てない) → chain break
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBe(0); // evidenceGain 不発火
    expect(after.players.self.hand.length).toBe(1);     // HC 残存
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull(); // step2 sceneSetState pick は surface しない
    setHuman(null);
  });
});
