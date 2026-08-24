// qa: card:B03110:778145d226f364876d2f75e0d6bc0336b6c61bdfdd1822254bb244878b57c818
// qa: card:B05037:380717ada1c87998940617c779095a769ab2293d76f781d461a0b31f080e0b8b
// qa: card:B05045:a7fa9913527fba6c52ba50e080f131ba501ab2b308a32b44ab20b71086daf0a2
// qa: card:B06082:778145d226f364876d2f75e0d6bc0336b6c61bdfdd1822254bb244878b57c818
// qa: card:B06104:778145d226f364876d2f75e0d6bc0336b6c61bdfdd1822254bb244878b57c818

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03110 } from '@/cards/ct-p03/B03110';
import { B03110P } from '@/cards/ct-p03/B03110P';
import { B05037 } from '@/cards/ct-p05/B05037';
import { B05045 } from '@/cards/ct-p05/B05045';
import { B05045P } from '@/cards/ct-p05/B05045P';
import { B06082 } from '@/cards/ct-p06/B06082';
import { B06082P } from '@/cards/ct-p06/B06082P';
import { B06104 } from '@/cards/ct-p06/B06104';
import { B06104P } from '@/cards/ct-p06/B06104P';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const BLACK_PARTNER = 'D07001';
const BLUE_PARTNER = 'D08001';
const FILLER = 'B01001';

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
  resetPresentationQueue(`qa-wave89-hand-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave89 hand state');
  return state;
}

function assist(partnerCardId: string): void {
  expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
  expect(current().players.self.partner.location).toBe('file-area');
  expect(current().players.self.file.at(-1)).toEqual({ type: 'assisted-partner', cardId: partnerCardId });
}

function acceptOptional(): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function resolvePickByCardId(cardId: string): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  const candidate = pending!.candidates.find(entry => entry.cardId === cardId);
  expect(candidate).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function resolveRequiredCurrentPick(): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  const picked = pending!.candidates.slice(0, pending!.nMin).map(candidate => candidate.uid);
  expect(picked).toHaveLength(pending!.nMin);
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: picked[0] ?? null, pickedUids: picked,
  }))).toEqual({ ok: true });
}

function base(partnerCardId: string, prefix: string, ordinary: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: partnerCardId, state: 'active', location: 'partner-area' };
  state.players.self.file = fileCards(prefix, ordinary);
  state.players.self.deck = [FILLER, 'B01002', 'B01003', 'B01004'];
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave89 public FILE hand/cost movement skips the assisted partner', () => {
  it.each([B03110, B03110P])('$id end-phase optional moves exactly two ordinary cards through hand', card => {
    const state = base(BLACK_PARTNER, card.id, 2);
    state.players.self.scene = [makeChar({ cardId: card.id, uid: 'source' })];
    install(state, card.id);
    assist(BLACK_PARTNER);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    acceptOptional();
    resolveRequiredCurrentPick();

    // Card-bound n=2 hand matrix: B03110 B03110P.
    expect(current().players.self.remove.filter(cardId => cardId.startsWith(card.id))).toHaveLength(2);
    expect(current().players.self.remove).not.toContain(BLACK_PARTNER);
    expect(current().players.self.file).toEqual([{ type: 'assisted-partner', cardId: BLACK_PARTNER }]);
    expect(current().players.self.partner.location).toBe('file-area');
  });

  it('B03110 partner-only optional gates the discard tail without moving the partner', () => {
    const state = base(BLACK_PARTNER, B03110.id, 0);
    state.players.self.scene = [makeChar({ cardId: B03110.id, uid: 'source' })];
    install(state, 'B03110-partner-only');
    assist(BLACK_PARTNER);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    acceptOptional();

    expect(current().players.self.file).toEqual([{ type: 'assisted-partner', cardId: BLACK_PARTNER }]);
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.remove).toEqual([]);
  });

  it('B05037 pays sleep plus one ordinary FILE card atomically and draws two', () => {
    const state = base(BLUE_PARTNER, B05037.id, 1);
    state.players.self.scene = [makeChar({ cardId: B05037.id, uid: 'source' })];
    install(state, B05037.id);
    assist(BLUE_PARTNER);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' })).toEqual({ ok: true });

    // Card-bound cost matrix: B05037.
    expect(current().players.self.scene[0]?.state).toBe('sleep');
    expect(current().players.self.remove).toContain(`${B05037.id}-0`);
    expect(current().players.self.hand).toEqual([FILLER, 'B01002']);
    expect(current().players.self.file).toEqual([{ type: 'assisted-partner', cardId: BLUE_PARTNER }]);
  });

  it('B05037 rejects partner-only FILE without partial sleep, draw, or turn use', () => {
    const state = base(BLUE_PARTNER, B05037.id, 0);
    state.players.self.scene = [makeChar({ cardId: B05037.id, uid: 'source' })];
    install(state, 'B05037-partner-only');
    assist(BLUE_PARTNER);
    const before = current();
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: 'a1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(current().players.self.scene[0]?.state).toBe('active');
    expect(current().players.self.deck).toEqual([FILLER, 'B01002', 'B01003', 'B01004']);
  });

  it.each([B05045, B05045P])('$id partner-area declaration returns the ordinary top card and keeps the partner', card => {
    const state = base(BLUE_PARTNER, card.id, 1);
    state.players.self.partnerAreaMR = makeChar({ cardId: card.id, uid: 'partnerMR:self' });
    state.players.self.hand = [FILLER];
    install(state, card.id);
    assist(BLUE_PARTNER);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2' })).toEqual({ ok: true });
    resolvePickByCardId(FILLER);

    // Card-bound MR hand matrix: B05045 B05045P.
    expect(current().players.self.hand).toEqual([`${card.id}-0`]);
    expect(current().players.self.file[0]).toMatchObject({ cardId: FILLER, faceUp: true });
    expect(current().players.self.file.at(-1)).toEqual({ type: 'assisted-partner', cardId: BLUE_PARTNER });
  });

  it.each([B06082, B06082P])('$id event optional returns the ordinary FILE top card, never the partner', card => {
    const state = base(BLUE_PARTNER, card.id, 5);
    state.players.self.case = { cardId: 'D08020', status: '解決編', requiredEvidence: 7, colors: [...card.colors], declaredUseCount: {} };
    state.players.self.hand = [card.id];
    install(state, card.id);
    assist(BLUE_PARTNER);
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
    acceptOptional();

    // Card-bound optional event matrix: B06082 B06082P.
    expect(current().players.self.hand.filter(cardId => cardId.startsWith(card.id))).toHaveLength(1);
    expect(current().players.self.file.at(-1)).toEqual({ type: 'assisted-partner', cardId: BLUE_PARTNER });
    expect(current().players.self.file).toHaveLength(5);
    expect(current().players.self.partner.location).toBe('file-area');
  });

  it.each([B06104, B06104P])('$id event returns exactly two ordinary FILE cards and preserves the partner', card => {
    const state = base(BLACK_PARTNER, card.id, 6);
    state.players.self.case = { cardId: 'D07020', status: '解決編', requiredEvidence: 7, colors: [...card.colors], declaredUseCount: {} };
    state.players.self.hand = [card.id];
    install(state, card.id);
    assist(BLACK_PARTNER);
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });

    // Card-bound n=2 event matrix: B06104 B06104P.
    expect(current().players.self.hand.filter(cardId => cardId.startsWith(card.id))).toHaveLength(2);
    expect(current().players.self.file.at(-1)).toEqual({ type: 'assisted-partner', cardId: BLACK_PARTNER });
    expect(current().players.self.file).toHaveLength(5);
    expect(current().players.self.partner.location).toBe('file-area');
  });
});
