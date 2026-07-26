import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { makeChar, makeCtx } from '../../helpers/fixtures';

const cutinCtx = () => makeCtx({
  source: { player: 'self', area: 'scene', resolutionKind: 'cutin' },
});

describe('CutIn effect entry turn history', () => {
  it('marks successful sceneEnter while preserving the entry turnEffects shape', () => {
    const result = produce(createEmptyGameState(), draft => {
      runAtom(draft, 'sceneEnter', { player: 'self', cardId: 'CUTIN_ENTER' }, cutinCtx());
    });

    expect(result.players.self.scene[0]).toMatchObject({
      cardId: 'CUTIN_ENTER',
      turnEffects: {
        contactImmune: false,
        removeOnTurnEnd: false,
        enteredByCutinEffectThisTurn: true,
      },
    });
  });

  it('marks successful sceneSwitch, but not a failed full-scene entry', () => {
    const switching = createEmptyGameState();
    switching.players.self.scene = [makeChar({ uid: 'old', cardId: 'OLD' })];
    const switched = produce(switching, draft => {
      runAtom(draft, 'sceneSwitch', { player: 'self', cardId: 'CUTIN_SWITCH', removeUid: 'old' }, cutinCtx());
    });
    expect(switched.players.self.scene[0]!.turnEffects.enteredByCutinEffectThisTurn).toBe(true);

    const full = createEmptyGameState();
    full.players.self.scene = Array.from({ length: 5 }, (_, index) => makeChar({ uid: `old-${index}` }));
    const skipped = produce(full, draft => {
      runAtom(draft, 'sceneEnter', { player: 'self', cardId: 'CUTIN_SKIPPED' }, cutinCtx());
    });
    expect(skipped.players.self.scene).toHaveLength(5);
    expect(skipped.players.self.scene.every(char => char.turnEffects.enteredByCutinEffectThisTurn === undefined)).toBe(true);
  });

  it('does not mark entries from non-CutIn effect resolution', () => {
    const result = produce(createEmptyGameState(), draft => {
      runAtom(draft, 'sceneEnter', { player: 'self', cardId: 'NORMAL_ENTER' }, makeCtx());
    });
    expect(result.players.self.scene[0]!.turnEffects.enteredByCutinEffectThisTurn).toBeUndefined();
  });
});
