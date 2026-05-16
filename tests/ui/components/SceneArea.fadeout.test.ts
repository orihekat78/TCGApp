// Phase 8.10g-2: SceneArea ゴーストトラッカー (pickRemovedCharacters helper)

import { describe, it, expect } from 'vitest';
import { pickRemovedCharacters } from '@/ui/components/SceneArea';
import type { SceneCharacter } from '@/engine/types/game-state';

function ch(uid: string, cardId = 'D08003'): SceneCharacter {
  return {
    uid,
    cardId,
    state: 'active',
    isNamed: false,
    apOverride: null,
    lpOverride: null,
    setCards: [],
    stackedCards: 0,
    enterOrder: 0,
    enterTurn: 1,
  } as unknown as SceneCharacter;
}

describe('pickRemovedCharacters', () => {
  it('returns empty when no characters changed', () => {
    const prev = [ch('a'), ch('b')];
    const cur = [ch('a'), ch('b')];
    expect(pickRemovedCharacters(prev, cur)).toEqual([]);
  });

  it('returns characters present in prev but not in current', () => {
    const a = ch('a');
    const b = ch('b');
    const removed = pickRemovedCharacters([a, b], [a]);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.uid).toBe('b');
  });

  it('returns multiple removed characters', () => {
    const removed = pickRemovedCharacters([ch('a'), ch('b'), ch('c')], [ch('a')]);
    expect(removed.map((c) => c.uid).sort()).toEqual(['b', 'c']);
  });

  it('does not include newly added characters', () => {
    const removed = pickRemovedCharacters([ch('a')], [ch('a'), ch('b')]);
    expect(removed).toEqual([]);
  });
});
