// TDD: isSceneDirectPick 述語 (UI picker Direct Manipulation 化 設計 v2 BLOCKER)
// scene-char pick を現場直接クリックで処理できるかを Playmat / EffectPickerModal が共有判定する。
// 重要: n.max>1 や非scene候補は false → EffectPickerModal フォールバック (soft-lock 回避)。

import { describe, it, expect } from 'vitest';
import { isSceneDirectPick } from '@/ui/services/scenePick';
import { createSampleGameState } from '@/ui/fixtures/sampleGameState';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import type { PendingEffectPick } from '@/ui/state/store';

function mkChar(uid: string, cardId = 'D08003'): SceneCharacter {
  return {
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

function gsWith(selfUids: string[], oppUids: string[]): GameState {
  const gs = createSampleGameState();
  gs.players.self.scene = selfUids.map((u) => mkChar(u));
  gs.players.opp.scene = oppUids.map((u) => mkChar(u));
  return gs;
}

function pick(partial: Partial<PendingEffectPick>): PendingEffectPick {
  return {
    player: 'self',
    candidates: [{ uid: 's1', cardId: 'D08003', player: 'self' }],
    atomVerb: 'sceneSetState',
    atomArgs: {},
    nMin: 0,
    nMax: 1,
    source: { cardId: 'X', abilityId: 'a1' },
    ...partial,
  };
}

describe('isSceneDirectPick', () => {
  it('self / nMax=1 / 候補が self 現場 → true', () => {
    const gs = gsWith(['s1', 's2'], []);
    expect(isSceneDirectPick(pick({ candidates: [{ uid: 's1', cardId: 'D08003', player: 'self' }] }), gs)).toBe(true);
  });

  it('self / nMax=1 / 候補が opp 現場 (either side) → true', () => {
    const gs = gsWith(['s1'], ['o1']);
    expect(isSceneDirectPick(pick({ candidates: [{ uid: 'o1', cardId: 'D08003', player: 'opp' }] }), gs)).toBe(true);
  });

  it('nMax>1 (multi-select) → false (modal フォールバック)', () => {
    const gs = gsWith(['s1', 's2'], []);
    expect(
      isSceneDirectPick(
        pick({ nMax: 2, candidates: [{ uid: 's1', cardId: 'D08003', player: 'self' }, { uid: 's2', cardId: 'D08003', player: 'self' }] }),
        gs,
      ),
    ).toBe(false);
  });

  it('候補が現場に無い uid (evidence synthetic) → false', () => {
    const gs = gsWith(['s1'], []);
    expect(isSceneDirectPick(pick({ candidates: [{ uid: 'evidence:self:0', cardId: 'D08003', player: 'self' }] }), gs)).toBe(false);
  });

  it('混在 (1件は現場, 1件は非現場) → false', () => {
    const gs = gsWith(['s1'], []);
    expect(
      isSceneDirectPick(
        pick({ candidates: [{ uid: 's1', cardId: 'D08003', player: 'self' }, { uid: 'card#0', cardId: 'D08003', player: 'self' }] }),
        gs,
      ),
    ).toBe(false);
  });

  it('player=opp (AI/相手) → false', () => {
    const gs = gsWith([], ['o1']);
    expect(isSceneDirectPick(pick({ player: 'opp', candidates: [{ uid: 'o1', cardId: 'D08003', player: 'opp' }] }), gs)).toBe(false);
  });

  it('linked public hand reveal stays in the required picker instead of direct scene UI', () => {
    const gs = gsWith(['s1'], []);
    expect(isSceneDirectPick(pick({ publicHandRevealToken: 'public-hand-reveal:linked' }), gs)).toBe(false);
  });

  it('候補0件 → false', () => {
    const gs = gsWith(['s1'], []);
    expect(isSceneDirectPick(pick({ candidates: [] }), gs)).toBe(false);
  });

  it('pending / gameState が null → false', () => {
    const gs = gsWith(['s1'], []);
    expect(isSceneDirectPick(null, gs)).toBe(false);
    expect(isSceneDirectPick(pick({}), null)).toBe(false);
  });
});
