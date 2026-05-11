import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { scene } from '@/engine/read/scene';
import type { GameState, SceneCharacter } from '@/engine/types';

function makeChar(overrides: Partial<SceneCharacter> = {}): SceneCharacter {
  return {
    cardId: 'C001',
    uid: 'uid-1',
    state: 'active',
    isNamed: false,
    enterOrder: 0,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...overrides,
  };
}

function withScene(chars: SceneCharacter[], side: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      ...s.players,
      [side]: { ...s.players[side], scene: chars },
    },
  };
}

describe('engine.read.scene', () => {
  it('all: 全キャラを返す', () => {
    const c1 = makeChar({ uid: 'a' });
    const c2 = makeChar({ uid: 'b' });
    const s = withScene([c1, c2]);
    expect(scene.all(s, 'self')).toHaveLength(2);
  });

  it('all: 空現場は空配列', () => {
    const s = createEmptyGameState();
    expect(scene.all(s, 'self')).toEqual([]);
  });

  it('count: 現場枚数', () => {
    const s = withScene([makeChar({ uid: 'a' }), makeChar({ uid: 'b' }), makeChar({ uid: 'c' })]);
    expect(scene.count(s, 'self')).toBe(3);
  });

  it('byUid: uid でキャラを検索', () => {
    const c = makeChar({ uid: 'target-uid' });
    const s = withScene([makeChar({ uid: 'other' }), c]);
    expect(scene.byUid(s, 'target-uid')).toBe(c);
  });

  it('byUid: 存在しない uid は null', () => {
    const s = createEmptyGameState();
    expect(scene.byUid(s, 'nonexistent')).toBeNull();
  });

  it('byUid: opp 側のキャラも検索できる', () => {
    const c = makeChar({ uid: 'opp-uid' });
    const s = withScene([c], 'opp');
    expect(scene.byUid(s, 'opp-uid')).toBe(c);
  });

  it('byCardId: cardId でフィルタリング', () => {
    const c1 = makeChar({ uid: 'a', cardId: 'CONAN' });
    const c2 = makeChar({ uid: 'b', cardId: 'HAIBARA' });
    const c3 = makeChar({ uid: 'c', cardId: 'CONAN' });
    const s = withScene([c1, c2, c3]);
    const result = scene.byCardId(s, 'self', 'CONAN');
    expect(result).toHaveLength(2);
    expect(result.map(c => c.uid)).toContain('a');
    expect(result.map(c => c.uid)).toContain('c');
  });

  it('activeOnes: アクティブキャラのみ', () => {
    const chars = [
      makeChar({ uid: 'a', state: 'active' }),
      makeChar({ uid: 'b', state: 'sleep' }),
      makeChar({ uid: 'c', state: 'stun' }),
      makeChar({ uid: 'd', state: 'active' }),
    ];
    const s = withScene(chars);
    const result = scene.activeOnes(s, 'self');
    expect(result).toHaveLength(2);
    expect(result.map(c => c.uid)).toContain('a');
    expect(result.map(c => c.uid)).toContain('d');
  });

  it('sleepOrStun: スリープ・スタンキャラ', () => {
    const chars = [
      makeChar({ uid: 'a', state: 'active' }),
      makeChar({ uid: 'b', state: 'sleep' }),
      makeChar({ uid: 'c', state: 'stun' }),
    ];
    const s = withScene(chars);
    const result = scene.sleepOrStun(s, 'self');
    expect(result).toHaveLength(2);
    expect(result.map(c => c.uid)).toContain('b');
    expect(result.map(c => c.uid)).toContain('c');
  });

  it('named: 名乗り状態のキャラのみ', () => {
    const chars = [
      makeChar({ uid: 'a', isNamed: true }),
      makeChar({ uid: 'b', isNamed: false }),
      makeChar({ uid: 'c', isNamed: true }),
    ];
    const s = withScene(chars);
    const result = scene.named(s, 'self');
    expect(result).toHaveLength(2);
  });

  it('nonNamed: 非名乗り状態のキャラのみ', () => {
    const chars = [
      makeChar({ uid: 'a', isNamed: true }),
      makeChar({ uid: 'b', isNamed: false }),
    ];
    const s = withScene(chars);
    expect(scene.nonNamed(s, 'self')).toHaveLength(1);
    expect(scene.nonNamed(s, 'self')[0].uid).toBe('b');
  });

  it('enterOrderOf: enterOrder を返す', () => {
    const c = makeChar({ uid: 'x', enterOrder: 42 });
    const s = withScene([c]);
    expect(scene.enterOrderOf(s, 'x')).toBe(42);
  });

  it('enterOrderOf: 存在しない uid は -1', () => {
    const s = createEmptyGameState();
    expect(scene.enterOrderOf(s, 'nonexistent')).toBe(-1);
  });

  it('opp 側の現場は self と独立', () => {
    const selfChar = makeChar({ uid: 'self-uid' });
    const oppChar = makeChar({ uid: 'opp-uid' });
    const s = createEmptyGameState();
    const s2 = {
      ...s,
      players: {
        self: { ...s.players.self, scene: [selfChar] },
        opp: { ...s.players.opp, scene: [oppChar] },
      },
    };
    expect(scene.count(s2, 'self')).toBe(1);
    expect(scene.count(s2, 'opp')).toBe(1);
    expect(scene.byUid(s2, 'self-uid')?.uid).toBe('self-uid');
    expect(scene.byUid(s2, 'opp-uid')?.uid).toBe('opp-uid');
  });
});
