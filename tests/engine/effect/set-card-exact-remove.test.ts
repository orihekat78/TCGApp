import { describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { makeChar, makeCtx } from '../../helpers/fixtures';

describe('charRemoveSetCard exact occurrence (B06012)', () => {
  it('matches the set host trait through the source ref', () => {
    resetDefRegistry();
    registerCardDef({ id: 'HOST', no: 'HOST', kind: 'character', names: ['Host'], colors: ['blue'], level: 1, ap: 1000, lp: 1, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({ uid: 'host', cardId: 'HOST' })];
    expect(evalCond(s, { kind: 'charMatches', ref: { kind: 'self' }, filter: { trait: '少年探偵団' } }, makeCtx({ source: { player: 'self', area: 'scene', uid: 'host' } }))).toBe(true);
  });

  it('removes the named face-up set event, not the host stack tail', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [makeChar({
      uid: 'host',
      setCards: [
        { cardId: 'DECOY_SET', faceUp: true, instanceId: 'decoy' },
        { cardId: 'B06012', faceUp: true, instanceId: 'target-1' },
        { cardId: 'B06012', faceUp: true, instanceId: 'target-2' },
        { cardId: 'TAIL_SET', faceUp: true, instanceId: 'tail' },
      ],
    })];

    const result = produce(s, draft => {
      runAtom(draft, 'charRemoveSetCard', { uid: 'host', setCardInstanceId: 'target-2' }, makeCtx());
    });

    expect(result.players.self.remove).toEqual(['B06012']);
    expect(result.players.self.scene[0]!.setCards.map((entry) => entry.instanceId)).toEqual(['decoy', 'target-1', 'tail']);
  });
});
