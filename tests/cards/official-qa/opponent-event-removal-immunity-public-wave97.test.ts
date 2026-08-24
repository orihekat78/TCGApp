// qa: card:B10010:8acc30fd02aa7a57c56a3a40704c2abd0853dd036d083f11f04b3cf0687a4e11
// qa: card:B10011:8acc30fd02aa7a57c56a3a40704c2abd0853dd036d083f11f04b3cf0687a4e11
// qa: card:PR279:8acc30fd02aa7a57c56a3a40704c2abd0853dd036d083f11f04b3cf0687a4e11
// qa: card:B10010:d2649f12c376076d66067f8d7b0ce732b2fd8a8e4b651a732c09c8c562749635
// qa: card:B10011:d2649f12c376076d66067f8d7b0ce732b2fd8a8e4b651a732c09c8c562749635
// qa: card:PR279:d2649f12c376076d66067f8d7b0ce732b2fd8a8e4b651a732c09c8c562749635
// qa: card:B10010:a29432736c9e0da7f13b3e318a178351f577621ebd450b986296f9f839c94421
// qa: card:B10011:a29432736c9e0da7f13b3e318a178351f577621ebd450b986296f9f839c94421
// qa: card:PR279:a29432736c9e0da7f13b3e318a178351f577621ebd450b986296f9f839c94421

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B10010 } from '@/cards/ct-p10/B10010';
import { B10011 } from '@/cards/ct-p10/B10011';
import { PR279 } from '@/cards/pr-01/PR279';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, Effect, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

const SUBJECT_UID = 'wave97-subject';
const BOND_UID = 'wave97-bond';
const DECOY_UID = 'wave97-decoy';
const DECOY_ID = 'WAVE97_DECOY';
const FILLER_ID = 'WAVE97_FILLER';
const REMOVE_EVENT_ID = 'WAVE97_EVENT_REMOVE';
const SLEEP_EVENT_ID = 'WAVE97_EVENT_SLEEP';
const STUN_EVENT_ID = 'WAVE97_EVENT_STUN';
const DECK_EVENT_ID = 'WAVE97_EVENT_DECK';
const HIRAMEKI_EVENT_ID = 'WAVE97_HIRAMEKI_REMOVE';

type SubjectRow = { card: CardDef; bondCardId?: string };
const SUBJECTS: SubjectRow[] = [
  { card: B10010, bondCardId: B10011.id },
  { card: B10011, bondCardId: B10010.id },
  { card: PR279 },
];

function character(id: string): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['赤'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function eventUseCard(id: string, effect: Effect): CardDef {
  const ability: AbilityDef = {
    id: 'event-use',
    type: 'triggered',
    scope: 'on-hand',
    trigger: {
      hook: 'effect:declared',
      selfOnly: true,
      matcher: (payload: unknown) => (payload as { kind?: unknown } | undefined)?.kind === 'event-use',
    },
    effect,
    description: 'Wave97 public event effect.',
    ruleRefs: ['rules/15-abilities-effects.md'],
  };
  return {
    id,
    no: id,
    kind: 'event',
    names: [id],
    colors: ['赤'],
    level: 0,
    ap: 0,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [ability],
    ruleRefs: ['rules/15-abilities-effects.md'],
  };
}

const REMOVE_EVENT = eventUseCard(REMOVE_EVENT_ID, {
  kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'opp', max: 1 },
});
const SLEEP_EVENT = eventUseCard(SLEEP_EVENT_ID, {
  kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'opp', max: 1, state: 'sleep' },
});
const STUN_EVENT = eventUseCard(STUN_EVENT_ID, {
  kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'opp', max: 1, state: 'stun' },
});
const DECK_EVENT = eventUseCard(DECK_EVENT_ID, {
  kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' },
});
const HIRAMEKI_EVENT: CardDef = {
  ...eventUseCard(HIRAMEKI_EVENT_ID, { kind: 'sequence', steps: [] }),
  abilities: [{
    id: 'hirameki-remove',
    type: 'triggered',
    scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'opp', max: 1 } },
    description: 'Wave97 public Hirameki event removal.',
    ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
  }],
};
const DECOY = character(DECOY_ID);
const FILLER = character(FILLER_ID);

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function stateFor(row: SubjectRow, owner: Player, eventId?: string): GameState {
  const eventOwner = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 5, player: eventOwner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    makeChar({ cardId: row.card.id, uid: SUBJECT_UID }),
    makeChar({ cardId: row.bondCardId ?? FILLER_ID, uid: BOND_UID }),
    makeChar({ cardId: DECOY_ID, uid: DECOY_UID }),
  ];
  state.players[eventOwner].case.colors = ['赤'];
  state.players[eventOwner].hand = eventId ? [eventId] : [];
  state.players[eventOwner].file = Array.from({ length: 7 }, () => ({
    type: 'card-back' as const,
    cardId: FILLER_ID,
  }));
  state.players.self.deck = [FILLER_ID, FILLER_ID];
  state.players.opp.deck = [FILLER_ID, FILLER_ID];
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state), label).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave97 game state');
  return state;
}

function useEventOnSubject(row: SubjectRow, owner: Player, card: CardDef): GameState { // Card-bound: B10010 B10011 PR279.
  const eventOwner = other(owner);
  install(stateFor(row, owner, card.id), eventOwner, `${row.card.id}:${card.id}:${owner}`);
  expect(dispatchEngineAction({ type: 'handUseCard', player: eventOwner, cardId: card.id }))
    .toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.source).toMatchObject({ cardId: card.id });
  expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(
    expect.arrayContaining([SUBJECT_UID, DECOY_UID]),
  );
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve',
    pickedUid: SUBJECT_UID,
  }))).toEqual({ ok: true });
  return current();
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetRegistry();
  _resetUidCounter();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  _resetTriggeredRegistered();
  registerAll();
  for (const card of [REMOVE_EVENT, SLEEP_EVENT, STUN_EVENT, DECK_EVENT, HIRAMEKI_EVENT, DECOY, FILLER]) {
    register(card);
  }
  registerHiramekiListener();
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingHirameki();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave97: B10010 B10011 PR279 opponent event removal immunity', () => {
  it.each(SUBJECTS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner remains selectable but blocks the selected opponent event removal',
    ({ row, owner }) => {
      const state = useEventOnSubject(row, owner, REMOVE_EVENT);
      expect(state.players[owner].scene.map(card => card.uid)).toEqual(
        expect.arrayContaining([SUBJECT_UID, DECOY_UID]),
      );
      expect(state.players[owner].remove).not.toContain(row.card.id);
    },
  );

  it.each(SUBJECTS.flatMap(row => [
    { row, event: SLEEP_EVENT, expected: 'sleep' as const },
    { row, event: STUN_EVENT, expected: 'stun' as const },
    { row, event: DECK_EVENT, expected: 'deck' as const },
  ]))('$row.card.id still receives opponent event $expected effects', ({ row, event, expected }) => { // Card-bound: B10010 B10011 PR279.
    const state = useEventOnSubject(row, 'self', event);
    const subject = state.players.self.scene.find(card => card.uid === SUBJECT_UID);
    if (expected === 'deck') {
      expect(subject).toBeUndefined();
      expect(state.players.self.deck.at(-1)).toBe(row.card.id);
    } else {
      expect(subject?.state).toBe(expected);
    }
  });

  it.each(SUBJECTS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner blocks removal from an opponent event Hirameki effect',
    ({ row, owner }) => {
      const evidencePlayer = other(owner);
      const { actionId, pending } = openCaseHirameki(stateFor(row, owner), HIRAMEKI_EVENT_ID, {
        evidencePlayer,
        humanPlayer: evidencePlayer,
        sessionLabel: `${row.card.id}:wave97-hirameki:${owner}`,
      });
      expect(pending).toMatchObject({
        player: evidencePlayer,
        cardId: HIRAMEKI_EVENT_ID,
        abilityId: 'hirameki-remove',
      });
      expect(dispatchEngineAction(bindPendingDecision(pending, {
        type: 'hiramekiResolve',
        choice: 'fire',
      }))).toEqual({ ok: true });
      const pick = useGameStateStore.getState().pendingEffectPick; // Card-bound: B10010 B10011 PR279.
      expect(pick?.candidates.map(candidate => candidate.uid)).toEqual(
        expect.arrayContaining([SUBJECT_UID, DECOY_UID]),
      );
      expect(dispatchEngineAction(bindPendingDecision(pick!, {
        type: 'effectPickResolve',
        pickedUid: SUBJECT_UID,
      }))).toEqual({ ok: true });
      expect(current().players[owner].scene.some(card => card.uid === SUBJECT_UID)).toBe(true);
      expect(current().players[owner].remove).not.toContain(row.card.id);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

      for (let step = 0; step < 2 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
        expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      }
    },
  );
});
