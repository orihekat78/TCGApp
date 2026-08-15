import { describe, expect, it } from 'vitest';
import type { GameState } from '@/engine/types/game-state';
import { selectAutonomousDecisionBlocked } from '@/ui/state/autonomousDecisionGate';
import { selectInteractionLocked, selectSwitchVictimBlocked } from '@/ui/state/interactionLock';

type Slice = Parameters<typeof selectInteractionLocked>[0]
  & Parameters<typeof selectAutonomousDecisionBlocked>[0];

function base(overrides: Partial<Slice> = {}): Slice {
  return {
    gameState: { pendingEffects: [] } as unknown as GameState,
    pendingEffectPick: null,
    pendingEffectChoice: null,
    pendingEffectOptional: null,
    pendingChooseIntercept: null,
    pendingLeaveIntercept: null,
    pendingSetCardChoice: null,
    pendingSetCardReplacement: null,
    pendingEffectRepeatOptional: null,
    pendingHirameki: null,
    pendingMisread: null,
    pendingDeckReveal: null,
    pendingPublicHandReveal: null,
    pendingDeckReorder: null,
    pendingDeckPlace: null,
    pendingRps: null,
    ...overrides,
  };
}

describe('selectInteractionLocked', () => {
  it('does not lock without an unresolved effect or decision', () => {
    expect(selectInteractionLocked(base())).toBe(false);
  });

  it('does not lock before game state is loaded', () => {
    expect(selectInteractionLocked(base({ gameState: null }))).toBe(false);
  });

  it.each(['pending', 'resolving'] as const)(
    'locks while an effect entry is %s',
    (state) => {
      const gameState = { pendingEffects: [{ id: 'e1', state }] } as unknown as GameState;
      expect(selectInteractionLocked(base({ gameState }))).toBe(true);
    },
  );

  it('ignores resolved and cancelled effect entries', () => {
    const gameState = {
      pendingEffects: [{ id: 'e1', state: 'resolved' }, { id: 'e2', state: 'cancelled' }],
    } as unknown as GameState;
    expect(selectInteractionLocked(base({ gameState }))).toBe(false);
  });

  it.each([
    'pendingEffectPick',
    'pendingEffectChoice',
    'pendingEffectOptional',
    'pendingChooseIntercept',
    'pendingLeaveIntercept',
    'pendingSetCardChoice',
    'pendingSetCardReplacement',
    'pendingEffectRepeatOptional',
    'pendingHirameki',
    'pendingMisread',
    'pendingDeckReveal',
    'pendingDeckReorder',
    'pendingDeckPlace',
    'pendingRps',
  ] as const)('locks every exclusive decision surface: %s', (key) => {
    const state = base({ [key]: {} as never } as Partial<Slice>);
    expect(selectInteractionLocked(state)).toBe(true);
    expect(selectAutonomousDecisionBlocked(state)).toBe(true);
  });

  it('locks effect-lifetime hand reveal but not presentation-only reveal', () => {
    const reveal = {
      owner: 'self',
      audience: 'all',
      cardIds: ['c1'],
      handSnapshot: ['c1'],
      resolutionToken: 'public-hand-reveal:1',
      source: {},
    } as const;
    const effectState = base({
      pendingPublicHandReveal: { ...reveal, lifetime: 'effect' },
    });
    const presentationState = base({
      pendingPublicHandReveal: { ...reveal, lifetime: 'presentation' },
    });

    expect(selectInteractionLocked(effectState)).toBe(true);
    expect(selectAutonomousDecisionBlocked(effectState)).toBe(true);
    expect(selectInteractionLocked(presentationState)).toBe(false);
    expect(selectAutonomousDecisionBlocked(presentationState)).toBe(false);
  });

  it('allows the effect pick, choice, or Hirameki decision that owns a switch victim picker', () => {
    expect(selectSwitchVictimBlocked(base({ pendingEffectPick: {} as never }))).toBe(false);
    expect(selectSwitchVictimBlocked(base({ pendingEffectChoice: {} as never }))).toBe(false);
    expect(selectSwitchVictimBlocked(base({ pendingHirameki: {} as never }))).toBe(false);
  });

  it('suspends a switch victim picker for a competing decision', () => {
    const reveal = {
      owner: 'self',
      audience: 'all',
      cardIds: ['c1'],
      handSnapshot: ['c1'],
      lifetime: 'effect',
      resolutionToken: 'public-hand-reveal:switch-lock',
      source: {},
    } as const;
    expect(selectSwitchVictimBlocked(base({ pendingPublicHandReveal: reveal }))).toBe(true);
  });
});
