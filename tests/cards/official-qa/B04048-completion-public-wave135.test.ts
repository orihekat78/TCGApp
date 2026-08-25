// qa: card:B04048:56d8adf38bad4a8ad033c6796edb1ba33e5f92e244cf396f8b741f465350ee09
// qa: card:B04048:8127180391146f281f02017be0156d8f5b94da8b98a1c5db243abb4c2bbd0054
// qa: card:B04048:81ca9d0c5d233174bf01264f196d510093f955d83f34d6820d51b61c7c0115ea
// qa: card:B04048:b1c71ee07fa1a0f80a4f5dbfe8e7346a01e33691457ea270bc26f3d5a45212c1
// qa: card:B04048:cc1f1a619e3ef13d327cf6c1772167ded167a8a5e272ff6a2f66d50a2ceed2d4

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04048 } from '@/cards/ct-p04/B04048';
import { B04048P } from '@/cards/ct-p04/B04048P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B04048, B04048P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const RED_PARTNER = fixture('W135_RED_PARTNER', { kind: 'partner', colors: ['赤'], ap: undefined, lp: undefined });
const ORIGINAL = fixture('W135_ORIGINAL');
const DRAWS = Array.from({ length: 7 }, (_value, index) => fixture(`W135_DRAW_${index + 1}`));
const TAILS = [fixture('W135_TAIL_1'), fixture('W135_TAIL_2')];
const SAME_NAME = '赤井秀一';
const SAME_CHAR = fixture('W135_SAME_CHAR', { names: [SAME_NAME], colors: ['青'] });
const SAME_EVENT = fixture('W135_SAME_EVENT', {
  kind: 'event', names: [SAME_NAME], colors: ['緑'], ap: undefined, lp: undefined,
});
const REFRESH = fixture('W135_REFRESH');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave135 state');
  return state;
}

function fileCards(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const, cardId: `file-${index + 1}`,
  }));
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave135-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(card: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 23, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['赤'];
  state.players[owner].partner = { cardId: RED_PARTNER.id, state: 'active', location: 'partner-area' };
  state.players[other(owner)].deck = [...TAILS.map(card => card.id), ...TAILS.map(card => card.id)];
  return state;
}

function pendingPick(verb?: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  if (verb) expect(pending?.atomVerb).toBe(verb);
  return pending!;
}

function choose(pending: NonNullable<ReturnType<typeof pendingPick>>, uids: string[]): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uids[0] ?? null,
    ...(uids.length > 1 ? { pickedUids: uids } : {}),
  }))).toEqual({ ok: true });
}

function declare(declaredName: string): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
    costParams: { declaredName },
  });
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [RED_PARTNER, ORIGINAL, ...DRAWS, ...TAILS, SAME_CHAR, SAME_EVENT, REFRESH]) {
    register(card);
  }
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave135: entry draw returns exactly the drawn count from the whole hand', () => {
  it.each(CASES)('$card.id owner $owner may include an original hand card in the exact return', ({ card, owner }) => {
    const state = base(card, owner);
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [card.id, ORIGINAL.id];
    state.players[owner].deck = [...DRAWS.slice(0, 6).map(item => item.id), ...TAILS.map(item => item.id)];
    install(state, owner, `${card.id}-${owner}-cycle`);
    expect(ROWS.map(row => row.id)).toContain(card.id);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
      .toEqual({ ok: true });
    const pending = pendingPick('handToDeckBottom');
    expect([pending.nMin, pending.nMax]).toEqual([6, 6]);
    expect(pending.source).toMatchObject({ cardId: card.id, abilityId: 'a1' });
    expect(pending.candidates.map(candidate => candidate.cardId).sort()).toEqual([
      ORIGINAL.id, ...DRAWS.slice(0, 6).map(item => item.id),
    ].sort());
    const selectedIds = [ORIGINAL.id, ...DRAWS.slice(0, 5).map(item => item.id)];
    const selectedUids = selectedIds.map(id => pending.candidates.find(candidate => candidate.cardId === id)!.uid);
    choose(pending, selectedUids);

    expect(current().players[owner].hand).toEqual([DRAWS[5]!.id]);
    expect(current().players[owner].deck.slice(0, 2)).toEqual(TAILS.map(item => item.id));
    expect(current().players[owner].deck.slice(2).sort()).toEqual([...selectedIds].sort());
  });

  it.each(CASES)('$card.id owner $owner does nothing when hand is already seven after entry', ({ card, owner }) => {
    const state = base(card, owner);
    state.players[owner].file = fileCards(5);
    state.players[owner].hand = [card.id, ...DRAWS.map(item => item.id)];
    state.players[owner].deck = TAILS.map(item => item.id);
    install(state, owner, `${card.id}-${owner}-seven`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: card.id }))
      .toEqual({ ok: true });
    expect(current().players[owner].hand).toEqual(DRAWS.map(item => item.id));
    expect(current().players[owner].deck).toEqual(TAILS.map(item => item.id));
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

describe('official QA Wave135: declared full card name spans colors and card types', () => {
  it.each(CASES)('$card.id owner $owner accepts the registered name and matches character/event', ({ card, owner }) => {
    const state = base(card, owner);
    state.players[owner].scene = [sceneChar(card.id, 'source')];
    state.players[owner].deck = [SAME_CHAR.id, SAME_EVENT.id, TAILS[0]!.id];
    install(state, owner, `${card.id}-${owner}-name-domain`);
    expect(ROWS.map(row => row.id)).toContain(card.id);

    expect(declare(SAME_NAME)).toEqual({ ok: true });
    const pending = pendingPick('deckRevealUntil');
    expect(pending.candidates.map(candidate => candidate.cardId).sort())
      .toEqual([SAME_CHAR.id, SAME_EVENT.id].sort());
    choose(pending, [pending.candidates.find(candidate => candidate.cardId === SAME_EVENT.id)!.uid]);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner, audience: 'all', cardIds: [SAME_EVENT.id], origin: 'deck-selected-card',
      source: { cardId: card.id, abilityId: 'a2' },
    });
    expect(current().players[owner].hand).toContain(SAME_EVENT.id);
    expect(current().players[owner].deck).toEqual([TAILS[0]!.id, SAME_CHAR.id]);

    const invalid = base(card, owner);
    invalid.players[owner].scene = [sceneChar(card.id, 'source')];
    invalid.players[owner].deck = [SAME_CHAR.id, TAILS[0]!.id];
    install(invalid, owner, `${card.id}-${owner}-invalid-name`);
    const before = current();
    expect(declare('未登録のカード名')).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
  });
});

describe('official QA Wave135: a selected sole deck card refreshes after leaving the look window', () => {
  it.each(CASES)('$card.id owner $owner keeps the look private then reveals only the selected card', ({ card, owner }) => {
    const opponent = other(owner);
    const state = base(card, owner);
    state.players[owner].scene = [sceneChar(card.id, 'source')];
    state.players[owner].deck = [SAME_CHAR.id];
    state.players[owner].remove = [REFRESH.id];
    install(state, owner, `${card.id}-${owner}-short-refresh`);

    expect(declare(SAME_NAME)).toEqual({ ok: true });
    const pending = pendingPick('deckRevealUntil');
    expect(pending.candidates.map(candidate => candidate.cardId)).toEqual([SAME_CHAR.id]);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: owner, visibility: 'private', viewer: owner, revealed: [SAME_CHAR.id], awaitingPick: true,
      source: { cardId: card.id, abilityId: 'a2' },
    });
    expect(current().players[owner].deck).toEqual([SAME_CHAR.id]);
    expect(current().refreshCount[owner]).toBe(0);

    choose(pending, [pending.candidates[0]!.uid]);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner, audience: 'all', cardIds: [SAME_CHAR.id], origin: 'deck-selected-card',
      source: { cardId: card.id, abilityId: 'a2' },
    });
    expect(current().players[owner].hand).toContain(SAME_CHAR.id);
    expect(current().players[owner].deck).toEqual([REFRESH.id]);
    expect(current().refreshCount[owner]).toBe(1);
    expect(current().players[opponent].evidence).toHaveLength(1);
    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  });
});
