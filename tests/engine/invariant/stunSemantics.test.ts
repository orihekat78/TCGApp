// rules: 03-field-areas.md (スタン特殊挙動)
import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { stunSemantics } from '@/engine/invariant/stunSemantics';
import type { GameState, SceneCharacter } from '@/engine/types';

function makeStateWithChar(state: SceneCharacter['state']): GameState {
  const s = createEmptyGameState();
  s.players.self.scene = [
    {
      cardId: 'C001',
      uid: 'test-uid',
      state,
      isNamed: false,
      enterOrder: 1,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    },
  ];
  return s;
}

describe('engine.invariant.stunSemantics', () => {
  it('スタン状態でアクティブ化を試みた場合、結果が sleep なら OK (rules/03)', () => {
    const s = makeStateWithChar('sleep'); // スタン→sleep に変換済み
    expect(() => stunSemantics(s, 'test-uid', 'active', 'stun')).not.toThrow();
  });

  it('スタン状態でアクティブ化を試みた場合、結果が stun のまま → throw', () => {
    const s = makeStateWithChar('stun'); // 変換されていない
    expect(() => stunSemantics(s, 'test-uid', 'active', 'stun')).toThrow(/stunSemantics/);
  });

  it('スタン状態でアクティブ化を試みた場合、結果が active → throw', () => {
    const s = makeStateWithChar('active'); // 誤って active になっている
    expect(() => stunSemantics(s, 'test-uid', 'active', 'stun')).toThrow(/stunSemantics/);
  });

  it('beforeState が stun でなければ確認しない', () => {
    const s = makeStateWithChar('active');
    expect(() => stunSemantics(s, 'test-uid', 'active', 'active')).not.toThrow();
    expect(() => stunSemantics(s, 'test-uid', 'active', 'sleep')).not.toThrow();
  });

  it('attempted が active でなければ確認しない', () => {
    const s = makeStateWithChar('stun');
    expect(() => stunSemantics(s, 'test-uid', 'sleep', 'stun')).not.toThrow();
    expect(() => stunSemantics(s, 'test-uid', 'stun', 'stun')).not.toThrow();
  });

  it('キャラが見つからない場合は no-op', () => {
    const s = makeStateWithChar('sleep');
    expect(() => stunSemantics(s, 'nonexistent-uid', 'active', 'stun')).not.toThrow();
  });
});
