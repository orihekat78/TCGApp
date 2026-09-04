// qa: card:B06047:3632e94d50bc47ae346b59442957707c6dc4daeee6428f02d48162a52d31374f
// qa: card:B06047:3abd9296f96bbaf04a583be7b1fbc6cff2b9d1c71f5bad45dfd2157537647385
// qa: card:B06047:3fc9fa7a38cbc087684db70c4bdd94732788455f030cfc2ce13ed9a6e746d50b
// qa: card:B06047:955aafea8be90ddd0411f210ec516600cfbbd240d1cd9b04e4f33ac027b04927

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { registerAll } from '@/cards';
import { B06047 } from '@/cards/ct-p06/B06047';
import { B06062 } from '@/cards/ct-p06/B06062';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { canOfferNextHintOptionalCard } from '@/engine/flow/main/next-hint';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { getHandUseDisabledReason } from '@/ui/services/handUseReason';
import { sceneChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;
type Route = 'hand' | 'hint';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const setSelf: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: {
    hook: 'effect:declared', selfOnly: true,
    matcher: payload => (payload as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom', verb: 'charSetCard',
    args: { player: 'self', fromSelf: true, n: 1, filter: { cardId: B06047.id, kind: 'character' } },
  },
  description: 'Set this event on Iron Blade.', ruleRefs: ['rules/16-card-set.md'],
};
const payThenSet: AbilityDef = {
  ...setSelf,
  effect: {
    kind: 'sequence', steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      setSelf.effect!,
    ],
  },
};

const SETTER = fixture('W155_YAIBA_SETTER', { kind: 'event', traits: ['YAIBA'], abilities: [setSelf] });
const PAY_SETTER = fixture('W155_YAIBA_PAY_SETTER', { kind: 'event', traits: ['YAIBA'], abilities: [payThenSet] });
const ENTRY = fixture('W155_YAIBA_ENTRY', {
  level: 5, traits: ['YAIBA'], abilities: [{
    id: 'enter-draw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'Entry sentinel.', ruleRefs: ['rules/17-icons.md'],
  }],
});
const FILLER = fixture('W155_FILLER');
const FILE_CARD = fixture('W155_FILE', { kind: 'event' });
const DRAW = fixture('W155_DRAW', { kind: 'event' });

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave155 state');
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  resetPresentationQueue(`qa-wave155-${label}`);
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

function levelBoard(owner: Player, sourceCount: number, fileCount: number): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 155, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['白'];
  state.players[owner].file = Array.from({ length: fileCount }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD.id,
  }));
  state.players[owner].hand = [B06062.id];
  state.players[owner].scene = Array.from(
    { length: sourceCount },
    (_value, index) => sceneChar(B06047.id, `source-${index + 1}`),
  );
  state.players[owner].deck = [DRAW.id, DRAW.id, DRAW.id, DRAW.id, DRAW.id];
  state.players[other(owner)].deck = [DRAW.id, DRAW.id, DRAW.id, DRAW.id, DRAW.id];
  return state;
}

function useLevelEvent(owner: Player, route: Route): void {
  const action = route === 'hand'
    ? { type: 'handUseCard' as const, player: owner, cardId: B06062.id }
    : { type: 'nextHint' as const, player: owner, optionalCardId: B06062.id };
  expect(dispatchEngineAction(action)).toEqual({ ok: true });
  choose(pendingPick(B06062.id, 'a1', 'sceneRemove'), null);
  const set = pendingPick(B06062.id, 'a1', 'charSetCard');
  choose(set, set.candidates.find(candidate => candidate.cardId === B06047.id)!.uid);
  expect(current().players[owner].scene.some(character => (
    character.cardId === B06047.id
    && character.setCards.some(card => card.cardId === B06062.id)
  ))).toBe(true);
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
  for (const card of [SETTER, PAY_SETTER, ENTRY, FILLER, FILE_CARD, DRAW]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave155: B06047 effective hand level', () => {
  it.each((['self', 'opp'] as const).flatMap(owner => (
    ['hand', 'hint'] as const
  ).map(route => ({ owner, route }))))(
    'owner=$owner uses official B06062 at level 6 through $route',
    ({ owner, route }) => {
      const fileCount = route === 'hand' ? 6 : 7;
      const state = levelBoard(owner, 1, fileCount);
      expect(effectiveHandLevel(state, owner, B06062.id)).toBe(6);
      if (route === 'hand') {
        expect(getHandUseDisabledReason(state, owner, B06062.id)).toBeNull();
        expect(enumerateMoves(state, owner)).toContainEqual({ kind: 'handUseCard', cardId: B06062.id });
      } else {
        expect(canOfferNextHintOptionalCard(state, owner, B06062.id)).toBe(true);
      }
      install(state, owner, `${owner}-${route}-one-source`);
      useLevelEvent(owner, route);

      const withoutAura = levelBoard(owner, 0, fileCount);
      if (route === 'hand') {
        expect(getHandUseDisabledReason(withoutAura, owner, B06062.id)).toContain('レベル 7');
        expect(enumerateMoves(withoutAura, owner)).not.toContainEqual({ kind: 'handUseCard', cardId: B06062.id });
      } else {
        expect(canOfferNextHintOptionalCard(withoutAura, owner, B06062.id)).toBe(false);
      }
      install(withoutAura, owner, `${owner}-${route}-no-source`);
      const denied = route === 'hand'
        ? dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06062.id })
        : dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: B06062.id });
      expect(denied).toEqual({ ok: false, reason: 'not-allowed' });
    },
  );

  it.each((['self', 'opp'] as const).flatMap(owner => (
    ['hand', 'hint'] as const
  ).map(route => ({ owner, route }))))(
    'owner=$owner stacks two sources to use B06062 at level 5 through $route',
    ({ owner, route }) => {
      const fileCount = route === 'hand' ? 5 : 6;
      const state = levelBoard(owner, 2, fileCount);
      expect(effectiveHandLevel(state, owner, B06062.id)).toBe(5);
      if (route === 'hand') {
        expect(getHandUseDisabledReason(state, owner, B06062.id)).toBeNull();
        expect(enumerateMoves(state, owner)).toContainEqual({ kind: 'handUseCard', cardId: B06062.id });
      } else {
        expect(canOfferNextHintOptionalCard(state, owner, B06062.id)).toBe(true);
      }
      install(state, owner, `${owner}-${route}-two-sources`);
      useLevelEvent(owner, route);

      const oneSource = levelBoard(owner, 1, fileCount);
      expect(effectiveHandLevel(oneSource, owner, B06062.id)).toBe(6);
      if (route === 'hand') {
        expect(getHandUseDisabledReason(oneSource, owner, B06062.id)).toContain('レベル 6');
        expect(enumerateMoves(oneSource, owner)).not.toContainEqual({ kind: 'handUseCard', cardId: B06062.id });
      } else {
        expect(canOfferNextHintOptionalCard(oneSource, owner, B06062.id)).toBe(false);
      }
      install(oneSource, owner, `${owner}-${route}-one-source-denied`);
      const denied = route === 'hand'
        ? dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: B06062.id })
        : dispatchEngineAction({ type: 'nextHint', player: owner, optionalCardId: B06062.id });
      expect(denied).toEqual({ ok: false, reason: 'not-allowed' });
    },
  );
});

describe('official QA Wave155: B06047 set-trigger re-entry', () => {
  it.each(['self', 'opp'] as const)(
    'owner=%s may enter the exact YAIBA character paid from hand before the set trigger',
    owner => {
      const state = levelBoard(owner, 1, 2);
      state.players[owner].hand = [PAY_SETTER.id, ENTRY.id];
      state.players[owner].remove = [];
      install(state, owner, `${owner}-hand-paid`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: PAY_SETTER.id }))
        .toEqual({ ok: true });
      const discard = pendingPick(PAY_SETTER.id, 'a1', 'discard');
      const paid = discard.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
      choose(discard, paid.uid);
      choose(pendingPick(PAY_SETTER.id, 'a1', 'charSetCard'), 'source-1');

      const enter = pendingPick(B06047.id, 'a2', 'sceneEnter');
      const sameCard = enter.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
      expect(sameCard).toMatchObject({ player: owner, area: 'remove' });
      choose(enter, sameCard.uid);

      expect(current().players[owner].scene.find(character => character.cardId === ENTRY.id)?.state)
        .toBe('sleep');
      expect(current().players[owner].remove).not.toContain(ENTRY.id);
      expect(current().players[owner].hand).toContain(DRAW.id);
    },
  );

  it.each(['self', 'opp'] as const)(
    'owner=%s may switch out B06047 itself from a full scene',
    owner => {
      const state = levelBoard(owner, 1, 2);
      state.players[owner].hand = [SETTER.id];
      state.players[owner].remove = [ENTRY.id];
      state.players[owner].scene.push(...Array.from(
        { length: 4 },
        (_value, index) => sceneChar(FILLER.id, `filler-${index}`),
      ));
      install(state, owner, `${owner}-source-switch`);

      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: SETTER.id }))
        .toEqual({ ok: true });
      choose(pendingPick(SETTER.id, 'a1', 'charSetCard'), 'source-1');
      const enter = pendingPick(B06047.id, 'a2', 'sceneEnter');
      const entrant = enter.candidates.find(candidate => candidate.cardId === ENTRY.id)!;
      choose(enter, entrant.uid, 'source-1');

      const ownerState = current().players[owner];
      expect(ownerState.scene).toHaveLength(5);
      expect(ownerState.scene.some(character => character.uid === 'source-1')).toBe(false);
      expect(ownerState.scene.find(character => character.cardId === ENTRY.id)?.state).toBe('sleep');
      expect(ownerState.remove).toEqual(expect.arrayContaining([B06047.id, SETTER.id]));
      expect(ownerState.hand).toContain(DRAW.id);
    },
  );
});
