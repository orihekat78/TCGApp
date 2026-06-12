// rules: 03-field-areas.md, 20-color-and-switch.md
import { describe, it, expect } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneAtMost5 } from '@/engine/invariant/sceneAtMost5';
import type { SceneCharacter } from '@/engine/types';
import { makeChar as baseChar } from '../../helpers/fixtures';

function makeChar(uid: string, cardId = 'C001'): SceneCharacter {
  return baseChar({ uid, cardId });
}

describe('engine.invariant.sceneAtMost5', () => {
  it('現場が5枚以下は OK', () => {
    const s = createEmptyGameState();
    s.players.self.scene = Array.from({ length: 5 }, (_, i) => makeChar(`uid-${i}`));
    expect(() => sceneAtMost5(s, 'self')).not.toThrow();
  });

  it('現場が0枚は OK', () => {
    const s = createEmptyGameState();
    expect(() => sceneAtMost5(s, 'self')).not.toThrow();
  });

  it('現場が6枚以上で throw (rules/03)', () => {
    const s = createEmptyGameState();
    s.players.self.scene = Array.from({ length: 6 }, (_, i) => makeChar(`uid-${i}`));
    expect(() => sceneAtMost5(s, 'self')).toThrow(/scene at most 5/);
  });

  it('opp も確認できる', () => {
    const s = createEmptyGameState();
    s.players.opp.scene = Array.from({ length: 6 }, (_, i) => makeChar(`uid-opp-${i}`));
    expect(() => sceneAtMost5(s, 'opp')).toThrow(/scene at most 5/);
  });
});
