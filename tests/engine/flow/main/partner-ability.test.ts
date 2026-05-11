// Phase 4 Task 4.3 — flow.main.usePartnerAbility
// rules: 06-card-types.md, 21-declared-ability-cost.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canPartnerAbility, usePartnerAbility } from '@/engine/flow/main/partner-ability';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import type { GameState } from '@/engine/types';

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
});
