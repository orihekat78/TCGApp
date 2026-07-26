import { beforeEach, describe, expect, it } from 'vitest';

import { evalCond } from '@/engine/cond/eval';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, Condition, EffectCtx } from '@/engine/types';

const gin: CardDef = {
  id: 'GIN', no: 'GIN', kind: 'character', names: ['ジン'], colors: ['黒'], level: 8, ap: 8000, lp: 2,
  traits: [], keywords: [], rarity: 'R', imageUrl: '', abilities: [], ruleRefs: [],
};
const target: CardDef = { ...gin, id: 'TARGET', no: 'TARGET', names: ['対象'] };

const condition = {
  kind: 'contactCharMatches', who: 'byUid', requireSource: true, filter: { cardName: 'ジン' },
} as unknown as Condition;

function stateAndCtx(sourceUid: string): { state: ReturnType<typeof createEmptyGameState>; ctx: EffectCtx } {
  const state = createEmptyGameState();
  state.players.self.scene = [sceneChar('GIN', 'gin-contact'), sceneChar('GIN', 'gin-bystander')];
  state.players.opp.scene = [sceneChar('TARGET', 'target')];
  return {
    state,
    ctx: {
      source: { player: 'self', cardId: 'GIN', uid: sourceUid, abilityId: 'a1', area: 'scene' },
      bindings: {}, contact: { byUid: 'gin-contact', targetUid: 'target' },
    } as EffectCtx,
  };
}

describe('contactCharMatches.requireSource', () => {
  beforeEach(() => { _resetRegistry(); register(gin); register(target); });

  it('requires the selected contact participant to be the ability source', () => {
    const nonParticipant = stateAndCtx('gin-bystander');
    const participant = stateAndCtx('gin-contact');
    expect(evalCond(nonParticipant.state, condition, nonParticipant.ctx)).toBe(false);
    expect(evalCond(participant.state, condition, participant.ctx)).toBe(true);
  });

  it('keeps existing contactCharMatches conditions source-agnostic when omitted', () => {
    const { state, ctx } = stateAndCtx('gin-bystander');
    const legacy = { kind: 'contactCharMatches', who: 'byUid', filter: { cardName: 'ジン' } } as Condition;
    expect(evalCond(state, legacy, ctx)).toBe(true);
  });
});
