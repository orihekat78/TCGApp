// qa: card:B06052:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
// qa: card:B06052:ae7f52880f245b79ea26502eaca624f082c7777854d029f9cd6ca7c88b4fb8b4
// qa: card:B06053:789166124304989d9b4fa07711b90275986274798404b2ff8df9ee25725c552b
// qa: card:B06053:fd2c5177b466b8aa0ca13fefd957ad4642a0e177a3bb6bb2d792ae35ea5b579d

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B06052 } from '@/cards/ct-p06/B06052';
import { B06053 } from '@/cards/ct-p06/B06053';
import { B06053P } from '@/cards/ct-p06/B06053P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Entry sentinel.', ruleRefs: ['rules/17-icons.md'],
};
const ENTRY = fixture('W157_YAIBA_ENTRY', { level: 6, traits: ['YAIBA'], abilities: [enterDraw] });
const DISCARD = fixture('W157_DISCARD', { kind: 'event' });
const FILLER = fixture('W157_FILLER');
const FILE_CARD = fixture('W157_FILE', { kind: 'event' });
const DRAW = fixture('W157_DRAW', { kind: 'event' });
const YAIBA_EVENT = fixture('W157_YAIBA_EVENT', { kind: 'event', traits: ['YAIBA'] });
const YAIBA_CHARACTER = fixture('W157_YAIBA_CHARACTER', { traits: ['YAIBA'] });
const PLAIN_EVENT = fixture('W157_PLAIN_EVENT', { kind: 'event' });
const TAIL = fixture('W157_TAIL', { kind: 'event' });
const REVEAL_SOURCES = [B06053, B06053P] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave157 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave157-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, abilityId: string, verb: string): PendingPick {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: verb, source: { cardId, abilityId } });
  return pending!;
}

function choose(pending: PendingPick, uid: string | null, switchRemoveUid?: string): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: uid,
    ...(switchRemoveUid ? { switchRemoveUid } : {}),
  }))).toEqual({ ok: true });
}

function resolveOptional(cardId: string): void {
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional).toMatchObject({ source: { cardId, abilityId: 'a1' } });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
}

function sourceState(owner: Player, fullScene: boolean): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 157, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = Array.from({ length: B06052.level ?? 0 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].scene = Array.from(
    { length: fullScene ? 5 : 0 },
    (_value, index) => sceneChar(FILLER.id, `filler-${index}`),
  );
  state.players[owner].deck = [DRAW.id, DRAW.id, DRAW.id];
  state.players[other(owner)].deck = [DRAW.id, DRAW.id, DRAW.id];
  return state;
}

function revealState(source: CardDef, owner: Player, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 157, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = Array.from({ length: source.level ?? 0 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].hand = [source.id];
  state.players[owner].deck = [...deck];
  state.players[other(owner)].deck = [DRAW.id, DRAW.id];
  return state;
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
  for (const card of [ENTRY, DISCARD, FILLER, FILE_CARD, DRAW, YAIBA_EVENT, YAIBA_CHARACTER, PLAIN_EVENT, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave157: B06052 entry chain', () => {
  it.each(['self', 'opp'] as const)('owner=%s may re-enter the exact YAIBA character paid from hand', owner => {
    const state = sourceState(owner, false);
    state.players[owner].hand = [B06052.id, ENTRY.id];
    install(state, owner, `${owner}-hand-paid`);

    expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06052.id }))
      .toEqual({ ok: true });
    resolveOptional(B06052.id);
    const discard = pendingPick(B06052.id, 'a1', 'discard');
    const paid = discard.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
    expect(paid).toMatchObject({ player: owner, area: 'hand' });
    choose(discard, paid.uid);

    const enter = pendingPick(B06052.id, 'a1', 'sceneEnter');
    const sameCard = enter.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
    expect(sameCard).toMatchObject({ player: owner, area: 'remove' });
    choose(enter, sameCard.uid);

    expect(current().players[owner].scene.find(character => character.cardId === ENTRY.id)?.state)
      .toBe('sleep');
    expect(current().players[owner].remove).not.toContain(ENTRY.id);
    expect(current().players[owner].hand).toContain(DRAW.id);
  });

  it.each(['self', 'opp'] as const)('owner=%s may switch out the just-entered B06052 at a full scene', owner => {
    const state = sourceState(owner, true);
    state.players[owner].hand = [B06052.id, DISCARD.id];
    state.players[owner].remove = [ENTRY.id];
    install(state, owner, `${owner}-source-switch`);

    expect(dispatchEngineAction({
      type: 'handUseCardSwitch', player: owner, cardId: B06052.id, removeUid: 'filler-0',
    })).toEqual({ ok: true });
    const source = current().players[owner].scene.find(character => character.cardId === B06052.id)!;
    expect(source).toBeTruthy();
    resolveOptional(B06052.id);
    const discard = pendingPick(B06052.id, 'a1', 'discard');
    choose(discard, discard.candidates.find(candidate => candidate.cardId === DISCARD.id)!.uid);
    const enter = pendingPick(B06052.id, 'a1', 'sceneEnter');
    choose(enter, enter.candidates.find(candidate => candidate.cardId === ENTRY.id)!.uid, source.uid);

    const ownerState = current().players[owner];
    expect(ownerState.scene).toHaveLength(5);
    expect(ownerState.scene.some(character => character.uid === source.uid)).toBe(false);
    expect(ownerState.scene.find(character => character.cardId === ENTRY.id)?.state).toBe('sleep');
    expect(ownerState.remove).toEqual(expect.arrayContaining([FILLER.id, B06052.id, DISCARD.id]));
    expect(ownerState.hand).toContain(DRAW.id);
  });
});

describe('official QA Wave157: B06053/P forced reveal', () => {
  it.each(REVEAL_SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner=$owner returns and shuffles the whole deck when no YAIBA event exists',
    ({ source, owner }) => {
      const deck = [YAIBA_CHARACTER.id, PLAIN_EVENT.id, TAIL.id];
      install(revealState(source, owner, deck), owner, `${source.id}-${owner}-no-match`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
        .toEqual({ ok: true });
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
        player: owner, revealed: deck, matched: null,
        source: { cardId: source.id, abilityId: 'a1' },
      });
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].deck).toHaveLength(deck.length);
      expect(current().players[owner].deck).toEqual(expect.arrayContaining(deck));
      expect(current().players[owner].remove).toEqual([]);
      const actions = current().log.map(entry => entry.action);
      const revealIndex = actions.lastIndexOf('effect:deckRevealUntil');
      const bottomIndex = actions.lastIndexOf('effect:deckToBottomBound');
      const shuffleIndex = actions.lastIndexOf('effect:deckShuffle');
      expect(revealIndex).toBeGreaterThanOrEqual(0);
      expect(bottomIndex).toBeGreaterThan(revealIndex);
      expect(shuffleIndex).toBeGreaterThan(bottomIndex);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    },
  );

  it.each(REVEAL_SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner=$owner must take the first matching YAIBA event',
    ({ source, owner }) => {
      const deck = [YAIBA_CHARACTER.id, PLAIN_EVENT.id, YAIBA_EVENT.id, TAIL.id];
      install(revealState(source, owner, deck), owner, `${source.id}-${owner}-forced-match`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
        .toEqual({ ok: true });
      surfacePendingSideChannels();
      expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
        player: owner,
        revealed: [YAIBA_CHARACTER.id, PLAIN_EVENT.id, YAIBA_EVENT.id],
        matched: YAIBA_EVENT.id,
        source: { cardId: source.id, abilityId: 'a1' },
      });
      expect(current().players[owner].hand).toEqual([YAIBA_EVENT.id]);
      expect(current().players[owner].deck).not.toContain(YAIBA_EVENT.id);
      expect(current().players[owner].deck).toEqual(expect.arrayContaining([
        YAIBA_CHARACTER.id, PLAIN_EVENT.id, TAIL.id,
      ]));
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    },
  );
});
