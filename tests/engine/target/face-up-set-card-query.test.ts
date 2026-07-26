import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { scene } from '@/engine/mutate/scene';
import { candidates } from '@/engine/target/candidates';
import { makeChar, makeCtx } from '../../helpers/fixtures';
import type { CardDef, TargetQuery } from '@/engine/types';

function defOf(id: string, traits: string[] = []): CardDef {
  return { id, no: `T/${id}`, kind: 'event', names: [id], colors: [], traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

describe('face-up set-card target query', () => {
  beforeEach(() => _resetRegistry());

  it('enumerates every public set-card occurrence but never reads face-down identity', () => {
    registerCardDef(defOf('GADGET', ['gadget']));
    registerCardDef(defOf('DECOY', ['decoy']));
    const state = createEmptyGameState();
    state.players.self.scene = [
      makeChar({ uid: 'host-a', cardId: 'HOST', setCards: [
        { cardId: 'GADGET', faceUp: true, instanceId: 'set:a' },
        { cardId: 'GADGET', faceUp: true, instanceId: 'set:a-duplicate' },
        { cardId: 'GADGET', faceUp: false, instanceId: 'set:hidden' },
      ] }),
      makeChar({ uid: 'host-b', cardId: 'HOST', setCards: [
        { cardId: 'GADGET', faceUp: true, instanceId: 'set:b' },
        { cardId: 'DECOY', faceUp: true, instanceId: 'set:decoy' },
      ] }),
    ];
    const query = { area: 'set-card', side: 'self', filter: { trait: 'gadget' } } as TargetQuery;

    expect(candidates(state, { kind: 'all', query }, makeCtx())).toEqual([
      { kind: 'card', area: 'set-card', cardId: 'GADGET', player: 'self', hostUid: 'host-a', setCardInstanceId: 'set:a' },
      { kind: 'card', area: 'set-card', cardId: 'GADGET', player: 'self', hostUid: 'host-a', setCardInstanceId: 'set:a-duplicate' },
      { kind: 'card', area: 'set-card', cardId: 'GADGET', player: 'self', hostUid: 'host-b', setCardInstanceId: 'set:b' },
    ]);
  });

  it('uses the same public occurrences for sceneHas and removes them with their host', () => {
    registerCardDef(defOf('GADGET', ['gadget']));
    const state = createEmptyGameState();
    state.players.self.scene = [makeChar({ uid: 'host', cardId: 'HOST', setCards: [{ cardId: 'GADGET', faceUp: true, instanceId: 'set:a' }] })];
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'host' } });
    const cond = { kind: 'sceneHas', query: { area: 'set-card', side: 'self', filter: { trait: 'gadget' } }, nMin: 1 } as never;

    expect(evalCond(state, cond, ctx)).toBe(true);
    scene.toHand(state, 'host');
    expect(evalCond(state, cond, ctx)).toBe(false);
  });
});
