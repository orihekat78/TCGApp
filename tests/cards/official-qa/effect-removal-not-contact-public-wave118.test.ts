// qa: card:B04089:0b6239f8b2e0d7252ecdbe7cdba6272d9a4d98a7a84f59d98bb3a2be00a36fc0
// qa: card:B04091:0b6239f8b2e0d7252ecdbe7cdba6272d9a4d98a7a84f59d98bb3a2be00a36fc0
// qa: card:B04094:0b6239f8b2e0d7252ecdbe7cdba6272d9a4d98a7a84f59d98bb3a2be00a36fc0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04089 } from '@/cards/ct-p04/B04089';
import { B04089P } from '@/cards/ct-p04/B04089P';
import { B04091 } from '@/cards/ct-p04/B04091';
import { B04091P } from '@/cards/ct-p04/B04091P';
import { B04094 } from '@/cards/ct-p04/B04094';
import { B04094P } from '@/cards/ct-p04/B04094P';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type Row = { card: CardDef; outcome: 'optional' | 'discard' | 'keyword' };
const ROWS: readonly Row[] = [
  { card: B04089, outcome: 'optional' }, { card: B04089P, outcome: 'optional' },
  { card: B04091, outcome: 'discard' }, { card: B04091P, outcome: 'discard' },
  { card: B04094, outcome: 'keyword' }, { card: B04094P, outcome: 'keyword' },
];
const PARTNER_BLACK = fixture('W118_PARTNER_BLACK', { kind: 'partner', colors: ['黒'], ap: undefined, lp: 5 });
const ATTACKER = fixture('W118_ATTACKER', { ap: 9000 });
const VICTIM = fixture('W118_VICTIM', { ap: 1000 });
const DRAW_A = fixture('W118_DRAW_A');
const DRAW_B = fixture('W118_DRAW_B');
const DRAW_C = fixture('W118_DRAW_C');
const REMOVE_EVENT = eventUseCard('W118_REMOVE_EVENT', 'opp');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黒'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function eventUseCard(id: string, side: 'self' | 'opp'): CardDef {
  const ability: AbilityDef = {
    id: 'a1', type: 'triggered', scope: 'on-hand',
    trigger: {
      hook: 'effect:declared', selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown } | undefined)?.kind === 'event-use',
    },
    effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side, max: 1 } },
    description: 'Wave118 public effect removal.', ruleRefs: ['rules/15-abilities-effects.md'],
  };
  return fixture(id, { kind: 'event', level: 0, abilities: [ability] });
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave118 state');
  return state;
}

function base(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['黒'];
  state.players[owner].partner = {
    cardId: PARTNER_BLACK.id, state: 'active', colors: ['黒'], location: 'partner-area',
  } as GameState['players']['self']['partner'];
  state.players[owner].scene = [sceneChar(row.card.id, 'observer')];
  state.players[other(owner)].scene = [sceneChar(VICTIM.id, 'victim', { state: 'sleep' })];
  state.players[owner].deck = [DRAW_A.id, DRAW_B.id, DRAW_C.id];
  return state;
}

function install(state: GameState, human: Player): void {
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function pendingPick(cardId: string, verb: string) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: verb, source: { cardId } });
  return pick!;
}

function resolvePick(pick: ReturnType<typeof pendingPick>, uid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: uid,
  }))).toEqual({ ok: true });
}

function expectNoObserverResolution(row: Row, owner: Player): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectOptional).toBeNull();
  expect(store.pendingEffectPick).toBeNull();
  expect(current().pendingEffects.some(entry => (
    entry.source.uid === 'observer' && entry.triggeredBy.hook === 'leave:to-remove'
  ))).toBe(false);
  expect(current().players[owner].scene.find(card => card.uid === 'observer')?.state).toBe('active');
  if (row.outcome === 'keyword') expect(readChar.hasKeyword(current(), 'observer', '突撃')).toBe(false);
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [PARTNER_BLACK, ATTACKER, VICTIM, DRAW_A, DRAW_B, DRAW_C, REMOVE_EVENT]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave118: contact removal is not owner effect removal', () => {
  // Card-bound physical rows: B04089/P B04091/P B04094/P.
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner fires after its event effect removes an opposing character',
    ({ row, owner }) => {
      const state = base(row, owner);
      state.players[owner].hand = [REMOVE_EVENT.id];
      install(state, owner);
      expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: REMOVE_EVENT.id }))
        .toEqual({ ok: true });
      const removal = pendingPick(REMOVE_EVENT.id, 'sceneRemove');
      expect(removal.candidates.map(candidate => candidate.uid)).toEqual(['victim']);
      resolvePick(removal, 'victim');
      expect(current().players[other(owner)].remove).toContain(VICTIM.id);

      if (row.outcome === 'optional') {
        const optional = useGameStateStore.getState().pendingEffectOptional;
        expect(optional?.source).toMatchObject({ uid: 'observer', cardId: row.card.id, abilityId: 'a1' });
        expect(dispatchEngineAction(bindPendingDecision(optional!, {
          type: 'optionalResolve', run: false,
        }))).toEqual({ ok: true });
      } else if (row.outcome === 'discard') {
        const discard = pendingPick(row.card.id, 'discard');
        expect(discard.candidates.map(candidate => candidate.cardId)).toEqual([DRAW_A.id, DRAW_B.id]);
        resolvePick(discard, discard.candidates[0]!.uid);
        expect(current().players[owner].hand).toEqual([DRAW_B.id]);
      } else {
        expect(readChar.hasKeyword(current(), 'observer', '突撃')).toBe(true);
      }
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    },
  );

  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner does not fire after contact removes the opposing character',
    ({ row, owner }) => {
      const state = base(row, owner);
      state.players[owner].scene.push(sceneChar(ATTACKER.id, 'attacker'));
      install(state, owner);
      expect(dispatchEngineAction({ type: 'actionAgainstChar', byUid: 'attacker', targetUid: 'victim' }))
        .toEqual({ ok: true });
      expect(current().players[other(owner)].remove).toContain(VICTIM.id);
      expect(current().players[owner].scene.find(card => card.uid === 'attacker')?.state).toBe('sleep');
      expect(current().players[owner].deck).toEqual([DRAW_A.id, DRAW_B.id, DRAW_C.id]);
      expectNoObserverResolution(row, owner);
    },
  );
});
