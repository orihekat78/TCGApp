// Phase 4 Task 4.3 — flow.main.usePartnerAbility
// rules: 06-card-types.md, 21-declared-ability-cost.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canPartnerAbility, usePartnerAbility } from '@/engine/flow/main/partner-ability';
import { activatePartnerAbility } from '@/engine/flow/main/ability-activate';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve';
import { startCausalSession, validateCausalLog } from '@/engine/log/causal';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, CausalLogEntryV1, GameState } from '@/engine/types';

function makeStateWithPartner(opts: { state?: 'active' | 'sleep' | 'stun'; location?: 'partner-area' | 'file-area' | 'mr-removed' } = {}): GameState {
  const initial = createEmptyGameState();
  return produce(initial, draft => {
    mutate.partner.init(draft, 'self', 'P-SELF');
    draft.players.self.partner.state = opts.state ?? 'active';
    draft.players.self.partner.location = opts.location ?? 'partner-area';
  });
}

describe('engine.flow.main.usePartnerAbility', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
  });

  it('パートナーが active かつ partner-area → canPartnerAbility=true', () => {
    const s = makeStateWithPartner({ state: 'active', location: 'partner-area' });
    expect(canPartnerAbility(s, 'self', 'ABIL1')).toBe(true);
  });

  it('パートナーが sleep → false', () => {
    const s = makeStateWithPartner({ state: 'sleep', location: 'partner-area' });
    expect(canPartnerAbility(s, 'self', 'ABIL1')).toBe(false);
  });

  it('パートナーが file-area (アシスト中) → false', () => {
    const s = makeStateWithPartner({ state: 'sleep', location: 'file-area' });
    expect(canPartnerAbility(s, 'self', 'ABIL1')).toBe(false);
  });

  it('パートナーが未 init (cardId="") → false', () => {
    const initial = createEmptyGameState();
    expect(canPartnerAbility(initial, 'self', 'ABIL1')).toBe(false);
  });

  it('usePartnerAbility で effect:declared が emit される', () => {
    const s = makeStateWithPartner();
    let fired = false;
    event.on('effect:declared', (_st, payload) => {
      const p = payload as { kind?: string };
      if (p && p.kind === 'partnerAbility') fired = true;
    });
    produce(s, draft => {
      usePartnerAbility(draft, 'self', 'ABIL1');
    });
    expect(fired).toBe(true);
  });

  it('canPartnerAbility=false 状態で usePartnerAbility は throw', () => {
    const s = makeStateWithPartner({ state: 'sleep' });
    expect(() =>
      produce(s, draft => {
        usePartnerAbility(draft, 'self', 'ABIL1');
      }),
    ).toThrow(/not allowed/);
  });

  it('direct use owns one partner declaration root and correlates its observer effect', () => {
    event.on('effect:declared', () => ({ kind: 'atom', verb: 'noop', args: {} }));
    const state = produce(makeStateWithPartner(), (draft) => {
      startCausalSession(draft, 'partner-direct');
    });

    const after = produce(state, (draft) => {
      usePartnerAbility(draft, 'self', 'ABIL1');
      runAllUntilEmpty(draft);
    });
    const graph = validateCausalLog(after.log as CausalLogEntryV1[]);
    const roots = graph.filter((entry) =>
      entry.parentEventId === undefined && entry.correlationEventId === undefined);

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      kind: 'declare',
      source: { kind: 'card', side: 'self', zone: 'partner' },
    });
    expect(graph.filter((entry) =>
      entry.parentEventId === undefined
      && entry.correlationEventId === roots[0]!.eventId)).toHaveLength(1);
  });

  it('activation correlates its cost observer and partner effect without exposing face-down evidence', () => {
    const cardId = 'CAUSAL-PARTNER';
    registerCardDef({
      id: cardId,
      no: cardId,
      kind: 'partner',
      names: ['Causal partner'],
      colors: ['青'],
      lp: 1,
      traits: [],
      keywords: [],
      rarity: 'C',
      imageUrl: '',
      ruleRefs: [],
      abilities: [{
        id: 'causal',
        type: 'declared',
        scope: 'on-partner-area',
        cost: { kind: 'discardEvidence', n: 1 },
        description: 'causal partner test',
        ruleRefs: [],
      }],
    } as CardDef);
    event.on('evidence:removed', () => ({ kind: 'atom', verb: 'noop', args: {} }));
    event.on('effect:declared', () => ({ kind: 'atom', verb: 'noop', args: {} }));
    const state = produce(createEmptyGameState(), (draft) => {
      mutate.partner.init(draft, 'self', cardId);
      draft.players.self.evidence.push({
        cardId: 'PRIVATE-PARTNER-COST',
        faceUp: false,
        origin: { turn: 1, via: 'reasoning' },
      });
      startCausalSession(draft, 'partner-activation');
    });

    const after = produce(state, (draft) => {
      activatePartnerAbility(draft, 'self', 'causal');
      runAllUntilEmpty(draft);
    });
    const graph = validateCausalLog(after.log as CausalLogEntryV1[]);
    const roots = graph.filter((entry) =>
      entry.parentEventId === undefined && entry.correlationEventId === undefined);

    expect(roots).toHaveLength(1);
    expect(graph.filter((entry) =>
      entry.parentEventId === undefined
      && entry.correlationEventId === roots[0]!.eventId)).toHaveLength(2);
    expect(JSON.stringify(graph)).not.toContain('PRIVATE-PARTNER-COST');
  });
});
