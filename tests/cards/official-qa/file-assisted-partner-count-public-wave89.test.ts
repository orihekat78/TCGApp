// qa: card:B04027:3d48fd2885346e1f56efcdd259b31a7a5e33cf94f53ca3cfa08175b86a749f26
// qa: card:B04047:3d48fd2885346e1f56efcdd259b31a7a5e33cf94f53ca3cfa08175b86a749f26
// qa: card:B04064:3d48fd2885346e1f56efcdd259b31a7a5e33cf94f53ca3cfa08175b86a749f26
// qa: card:B05067:3d48fd2885346e1f56efcdd259b31a7a5e33cf94f53ca3cfa08175b86a749f26
// qa: card:B05083:e0f724507a4784bfc11308fcb6fbdc982897f1eb1d8d90ba30a31c734d9cbd10
// qa: card:B06074:235a009a9c6df00bd13465dbf1c777e425d5f871b9a9a5ca4d7c5bf38aecc821
// qa: card:B06074:380717ada1c87998940617c779095a769ab2293d76f781d461a0b31f080e0b8b

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04027 } from '@/cards/ct-p04/B04027';
import { B04027P } from '@/cards/ct-p04/B04027P';
import { B04047 } from '@/cards/ct-p04/B04047';
import { B04047P } from '@/cards/ct-p04/B04047P';
import { B04064 } from '@/cards/ct-p04/B04064';
import { B05067 } from '@/cards/ct-p05/B05067';
import { B05067P } from '@/cards/ct-p05/B05067P';
import { B05083 } from '@/cards/ct-p05/B05083';
import { B05083P } from '@/cards/ct-p05/B05083P';
import { B06074 } from '@/cards/ct-p06/B06074';
import { B06074P } from '@/cards/ct-p06/B06074P';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetReservedEffectsRegistered, registerReservedEffectListener } from '@/engine/listeners/reserved-effects';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const GREEN_PARTNER = 'D02001';
const RED_PARTNER = 'D04001';
const BLUE_PARTNER = 'D08001';

function fileCards(prefix: string, count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `${prefix}-${index}`,
  }));
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-wave89-count-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave89 count state');
  return state;
}

function assist(partnerCardId: string): void {
  expect(current().players.self.partner.cardId).toBe(partnerCardId);
  expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
  expect(current().players.self.partner.location).toBe('file-area');
  expect(current().players.self.file.at(-1)).toEqual({ type: 'assisted-partner', cardId: partnerCardId });
}

function skipOpenPicks(): void {
  for (let guard = 0; guard < 8; guard += 1) {
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    if (!pending) return;
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
  }
  throw new Error('Wave89 count pick loop did not settle');
}

function base(partnerCardId: string, prefix: string, ordinary: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: partnerCardId, state: 'active', location: 'partner-area' };
  state.players.self.file = fileCards(prefix, ordinary);
  state.players.self.deck = ['B01001', 'B01002', 'B01003', 'B01004'];
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetReservedEffectsRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  registerTriggeredListener();
  registerReservedEffectListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave89 public FILE count includes the assisted partner', () => {
  it.each([
    { card: B04027, partner: GREEN_PARTNER },
    { card: B04027P, partner: GREEN_PARTNER },
    { card: B04064, partner: RED_PARTNER },
  ])('$card.id event use accepts total FILE5 and rejects total FILE6', ({ card, partner }) => {
    const run = (ordinary: number) => {
      const state = base(partner, card.id, ordinary);
      state.players.self.case = { cardId: 'D04020', status: '解決編', requiredEvidence: 7, colors: [...card.colors], declaredUseCount: {} };
      state.players.self.hand = [card.id];
      install(state, `${card.id}-${ordinary}`);
      assist(partner);
      const before = current();
      const result = dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id });
      skipOpenPicks();
      return { result, before, after: current() };
    };

    // Card-bound event matrix: B04027 B04027P B04064.
    const atFive = run(4);
    expect(atFive.result).toEqual({ ok: true });
    expect(atFive.after.players.self.remove).toContain(card.id);
    const atSix = run(5);
    expect(atSix.result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(atSix.after).toBe(atSix.before);
    expect(atSix.after.players.self.hand).toEqual([card.id]);
  });

  it.each([B04047, B04047P, B05067, B05067P])('$id declared ability accepts total FILE5 and rejects total FILE6', card => {
    const run = (ordinary: number) => {
      const state = base(RED_PARTNER, card.id, ordinary);
      state.players.self.scene = [makeChar({ cardId: card.id, uid: 'source' })];
      install(state, `${card.id}-${ordinary}`);
      assist(RED_PARTNER);
      const before = current();
      const result = dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: card.id.startsWith('B05067') ? 'a2' : 'a1',
      });
      skipOpenPicks();
      return { result, before, after: current() };
    };

    // Card-bound declared matrix: B04047 B04047P B05067 B05067P.
    const atFive = run(4);
    expect(atFive.result).toEqual({ ok: true });
    const atSix = run(5);
    expect(atSix.result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(atSix.after).toBe(atSix.before);
    expect(atSix.after.players.self.scene[0]?.state).toBe('active');
  });

  it.each([B05083, B05083P])('$id case declaration counts the assisted partner at total FILE5/6', card => {
    const run = (ordinary: number) => {
      const state = base(RED_PARTNER, card.id, ordinary);
      state.players.self.case = { cardId: card.id, status: '解決編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
      state.players.self.scene = [0, 1, 2].map(index => makeChar({ cardId: B05067.id, uid: `akai-${index}` }));
      state.players.self.evidence = [0, 1, 2].map(index => ({
        cardId: `EVIDENCE-${index}`, faceUp: false, origin: { turn: 2, via: 'reasoning' as const },
      }));
      install(state, `${card.id}-${ordinary}`);
      assist(RED_PARTNER);
      const before = current();
      const result = dispatchEngineAction({
        type: 'declaredAbility', uid: 'case:self', abilId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1,
        costParams: { flipFaceUpEvidence: { indices: [0, 1, 2] } },
      });
      skipOpenPicks();
      return { result, before, after: current() };
    };

    // Card-bound case matrix: B05083 B05083P.
    const atFive = run(4);
    expect(atFive.result).toEqual({ ok: true });
    expect(atFive.after.players.self.evidence.every(entry => entry.faceUp)).toBe(true);
    const atSix = run(5);
    expect(atSix.result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(atSix.after).toBe(atSix.before);
    expect(atSix.after.players.self.evidence.every(entry => !entry.faceUp)).toBe(true);
  });

  it.each([B06074, B06074P])('$id pays two ordinary FILE cards, preserves the partner, and checks post-cost total at turn end', card => {
    const run = (ordinary: number) => {
      const state = base(BLUE_PARTNER, card.id, ordinary);
      state.players.self.partnerAreaMR = makeChar({ cardId: card.id, uid: 'partnerMR:self' });
      install(state, `${card.id}-${ordinary}`);
      assist(BLUE_PARTNER);
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2' })).toEqual({ ok: true });
      const afterCost = current().players.self.file.length;
      const removedOrdinary = current().players.self.remove.filter(cardId => cardId.startsWith(card.id)).length;
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
      return {
        afterCost,
        afterEnd: current().players.self.file.length,
        removedOrdinary,
        partnerEntries: current().players.self.file.filter(entry => entry.type === 'assisted-partner').length,
        partnerLocation: current().players.self.partner.location,
      };
    };

    // Card-bound MR matrix: B06074 B06074P.
    expect(run(6)).toEqual({
      afterCost: 5, afterEnd: 7, removedOrdinary: 2, partnerEntries: 1, partnerLocation: 'file-area',
    });
    expect(run(7)).toEqual({
      afterCost: 6, afterEnd: 6, removedOrdinary: 2, partnerEntries: 1, partnerLocation: 'file-area',
    });
  });

  it('B06074 rejects fileFrom two when only one ordinary card plus the partner exists', () => {
    const state = base(BLUE_PARTNER, 'B06074-insufficient', 1);
    state.players.self.partnerAreaMR = makeChar({ cardId: B06074.id, uid: 'partnerMR:self' });
    install(state, 'B06074-insufficient');
    assist(BLUE_PARTNER);
    const before = current();

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players.self.file).toEqual([
      { type: 'card-back', cardId: 'B06074-insufficient-0' },
      { type: 'assisted-partner', cardId: BLUE_PARTNER },
    ]);
  });
});
