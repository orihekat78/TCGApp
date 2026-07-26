// B04059 水無怜奈 — official Q&A: scene-only additional card name.
// rules: 19-special-rules.md, 24-qa-naming-stun.md

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards/index';
import { evalCond } from '@/engine/cond/eval';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import { resolve as resolveTarget } from '@/engine/target/resolve';
import { makeCtx, sceneChar } from '../../helpers/fixtures';
import type { Condition, GameState } from '@/engine/types';

const ctx = makeCtx({ source: { player: 'self', uid: 'reina', area: 'scene' } });

function sceneNameHits(state: GameState): string[] {
  return candidates(state, { kind: 'all', query: { side: 'self', filter: { cardName: '本堂瑛海' } } } as never, ctx)
    .filter((candidate) => candidate.kind === 'char')
    .map((candidate) => candidate.uid);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
});

describe('B04059 official QA — scene-only additional name', () => {
  // qa: card:B04059:05976c3dee901653f6992ace34a4f9e09b23956a1094cf1476d31f1190ee09cb
  it('treats the scene character as 水無怜奈 and 本堂瑛海 for reader, bond, and target filter', () => {
    const state = createEmptyGameState();
    state.players.self.scene.push(sceneChar('B04059', 'reina'));

    expect(charRead.names(state, 'reina').sort()).toEqual(['本堂瑛海', '水無怜奈']);
    expect(sceneNameHits(state)).toEqual(['reina']);
    expect(evalCond(state, { kind: 'bond', cardName: '本堂瑛海' } as Condition, ctx)).toBe(true);
  });

  // qa: card:B04059:676504180576b9b2569e3d806582ef24a9b9bcf230a60946aca4395f79a9ab83
  it('does not expose the additional name in hand, deck, or remove', () => {
    const state = createEmptyGameState();
    state.players.self.scene.push(sceneChar('B04059', 'reina'));
    state.players.self.hand.push('B04059');
    state.players.self.deck.push('B04059');
    state.players.self.remove.push('B04059');

    for (const area of ['hand', 'deck', 'remove'] as const) {
      const hits = candidates(state, { kind: 'all', query: { side: 'self', area, filter: { cardName: '本堂瑛海' } } } as never, ctx);
      expect(hits, area).toHaveLength(0);
    }
  });

  it('keeps distinct-name selection printed-only despite the scene alias', () => {
    const state = createEmptyGameState();
    state.players.self.scene.push(sceneChar('B04059', 'reina'), sceneChar('D04009', 'eikai'));
    const ref = { kind: 'pick', query: { side: 'self', area: 'scene', distinctNames: true }, n: { min: 2, max: 2 } } as const;
    const picked = candidates(state, ref, ctx);

    expect(resolveTarget(state, ref, ctx, picked)).toHaveLength(2);
  });

  // qa: card:B04059:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
  it('keeps its opponent-turn leave trigger active', () => {
    const state = produce(createEmptyGameState(), (draft) => {
      draft.turn.player = 'opp';
      const reina = mutate.scene.enter(draft, 'self', 'B04059', {});
      mutate.scene.removeToRemove(draft, reina.uid, 'effect');
    });

    expect(state.pendingEffects.some((effect) => effect.triggeredBy.hook === 'leave:to-remove')).toBe(true);
  });
});
