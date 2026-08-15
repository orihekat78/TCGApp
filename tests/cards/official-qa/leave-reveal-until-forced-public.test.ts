// qa: card:B02058:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03019:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05021:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B05094:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// Rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { B02058 } from '@/cards/ct-p02/B02058';
import { B03019 } from '@/cards/ct-p03/B03019';
import { B05012 } from '@/cards/ct-p05/B05012';
import { B05021 } from '@/cards/ct-p05/B05021';
import { B05094 } from '@/cards/ct-p05/B05094';
import { B10022 } from '@/cards/ct-p10/B10022';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const ATTACKER = 'QA_FORCED_REVEAL_ATTACKER';
const DECOY_A = 'QA_FORCED_REVEAL_DECOY_A';
const DECOY_B = 'QA_FORCED_REVEAL_DECOY_B';
const TAIL = 'QA_FORCED_REVEAL_TAIL';
const OKIYA = 'QA_FORCED_REVEAL_OKIYA';
const AGASA = 'QA_FORCED_REVEAL_AGASA';
const KOGORO = 'QA_FORCED_REVEAL_KOGORO';
const NAGANO = 'QA_FORCED_REVEAL_NAGANO';
const NAGANO_EVENT = 'QA_FORCED_REVEAL_NAGANO_EVENT';

type Family = {
  card: CardDef;
  abilityId: string;
  matchId: string;
  leading: string[];
};

const FAMILIES: Family[] = [
  { card: B02058, abilityId: 'a2', matchId: OKIYA, leading: [DECOY_A, DECOY_B] },
  { card: B03019, abilityId: 'a1', matchId: AGASA, leading: [DECOY_A, DECOY_B] },
  { card: B05021, abilityId: 'a1', matchId: KOGORO, leading: [B05012.id, DECOY_B] },
  { card: B05094, abilityId: 'a1', matchId: NAGANO, leading: [NAGANO_EVENT, DECOY_B] },
];

function fixtureCard(
  id: string,
  options: { names?: string[]; traits?: string[]; kind?: CardDef['kind']; ap?: number } = {},
): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id,
    no: id,
    kind,
    names: options.names ?? [id],
    colors: ['青'],
    level: kind === 'character' ? 1 : 0,
    ap: kind === 'character' ? (options.ap ?? 1000) : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: options.traits ?? [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function restartSession(player: Player): void {
  endMatchSession();
  beginMatchSession(player);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(
  family: Family,
  turn: Player,
  deck: string[],
  includeVictim = false,
): void {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ cardId: family.card.id, uid: 'source', state: 'sleep' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
    ...(includeVictim ? [makeChar({ cardId: DECOY_B, uid: 'victim', state: 'sleep' })] : []),
  ];
  state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.self.deck = [...deck];
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function installMirrored(family: Family, deck: string[]): void {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  state.players.opp.scene = [makeChar({ cardId: family.card.id, uid: 'source', state: 'sleep' })];
  state.players.opp.deck = [...deck];
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function removeThroughPublicContact(targetUid = 'source', mirrored = false): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: mirrored ? 'opp' : 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: mirrored ? 'self' : 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function expectCompletedReveal(
  family: Family,
  player: Player,
  revealed: string[],
  matched: string | null,
): void {
  expect(useGameStateStore.getState().pendingDeckReveal, `${family.card.id}: forced public reveal completes`).toEqual({
    player,
    visibility: 'public',
    viewer: 'all',
    revealed,
    matched,
    presentation: undefined,
    source: { cardId: family.card.id, abilityId: family.abilityId, uid: 'source' },
  });
  expect(useGameStateStore.getState().pendingEffectPick, `${family.card.id}: matching card is mandatory`).toBeNull();
  expect(useGameStateStore.getState().pendingDeckReorder, `${family.card.id}: printed text grants no reorder choice`).toBeNull();
}

function settle(family: Family): void {
  useGameStateStore.getState().setPendingDeckReveal(null);
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 3 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${family.card.id}: terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingDeckReveal, `${family.card.id}: reveal presentation dismissed`).toBeNull();
  expect(store.pendingEffectPick, `${family.card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingDeckReorder, `${family.card.id}: no unresolved reorder`).toBeNull();
  expect(store.pendingEffectOptional, `${family.card.id}: no unresolved optional`).toBeNull();
  expect(store.activeActionId, `${family.card.id}: no open action`).toBeNull();
  expect(current().pendingRuntimeState, `${family.card.id}: no persisted decision authority`).toBeUndefined();
}

function provePositive(family: Family) {
  restartSession('self');
  const deck = [...family.leading, family.matchId, TAIL];
  install(family, 'opp', deck);
  removeThroughPublicContact();
  expectCompletedReveal(family, 'self', [...family.leading, family.matchId], family.matchId);
  const actions = current().log.map(entry => entry.action);
  const bottomIndex = actions.lastIndexOf('effect:deckToBottomBound');
  const shuffleIndex = actions.lastIndexOf('effect:deckShuffle');
  const proof = {
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck].sort(),
    sourceInRemove: current().players.self.remove.includes(family.card.id),
    forced: useGameStateStore.getState().pendingEffectPick === null,
    noReorder: useGameStateStore.getState().pendingDeckReorder === null,
    bottomBeforeShuffle: bottomIndex >= 0 && shuffleIndex > bottomIndex,
  };
  settle(family);
  return proof;
}

function proveNoMatch(family: Family) {
  restartSession('self');
  const deck = [...family.leading, TAIL];
  install(family, 'opp', deck);
  removeThroughPublicContact();
  expectCompletedReveal(family, 'self', deck, null);
  const proof = {
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck].sort(),
    sourceInRemove: current().players.self.remove.includes(family.card.id),
    shuffled: current().log.some(entry => entry.action === 'effect:deckShuffle'),
  };
  settle(family);
  return proof;
}

function proveWrongTiming(family: Family) {
  restartSession('self');
  const deck = [...family.leading, family.matchId, TAIL];
  install(family, 'self', deck);
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const removal = useGameStateStore.getState().pendingEffectPick;
  expect(removal).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' } });
  const source = removal?.candidates.find(candidate => candidate.uid === 'source');
  expect(source).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(removal!, {
    type: 'effectPickResolve',
    pickedUid: source!.uid,
  }))).toEqual({ ok: true });
  return {
    deck: [...current().players.self.deck],
    hand: [...current().players.self.hand],
    sourceInRemove: current().players.self.remove.includes(family.card.id),
    reveal: useGameStateStore.getState().pendingDeckReveal,
    sourceTriggers: current().pendingEffects.filter(entry => entry.source.cardId === family.card.id).length,
  };
}

function proveOtherLeave(family: Family) {
  restartSession('self');
  const deck = [...family.leading, family.matchId, TAIL];
  install(family, 'opp', deck, true);
  removeThroughPublicContact('victim');
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  return {
    deck: [...current().players.self.deck],
    hand: [...current().players.self.hand],
    sourceOnScene: current().players.self.scene.some(entry => entry.uid === 'source'),
    victimInRemove: current().players.self.remove.includes(DECOY_B),
    reveal: useGameStateStore.getState().pendingDeckReveal,
  };
}

function proveMirroredOwner(family: Family) {
  restartSession('self');
  const deck = [...family.leading, family.matchId, TAIL];
  installMirrored(family, deck);
  removeThroughPublicContact('source', true);
  expectCompletedReveal(family, 'opp', [...family.leading, family.matchId], family.matchId);
  const proof = {
    oppHand: [...current().players.opp.hand],
    selfHand: [...current().players.self.hand],
    oppSourceInRemove: current().players.opp.remove.includes(family.card.id),
  };
  settle(family);
  return proof;
}

function proveShortDeckRefresh(family: Family) {
  restartSession('self');
  install(family, 'opp', [family.matchId]);
  removeThroughPublicContact();
  expectCompletedReveal(family, 'self', [family.matchId], family.matchId);
  const proof = {
    hand: [...current().players.self.hand],
    deck: [...current().players.self.deck],
    remove: [...current().players.self.remove],
    refreshCount: current().refreshCount.self,
    opponentEvidence: current().players.opp.evidence.length,
    gameResult: current().gameResult,
  };
  settle(family);
  return proof;
}

function proveDuplicateOccurrence(family: Family) {
  restartSession('self');
  install(family, 'opp', [DECOY_A, family.matchId, family.matchId, TAIL]);
  removeThroughPublicContact();
  expectCompletedReveal(family, 'self', [DECOY_A, family.matchId], family.matchId);
  const proof = {
    handCopies: current().players.self.hand.filter(cardId => cardId === family.matchId).length,
    deckCopies: current().players.self.deck.filter(cardId => cardId === family.matchId).length,
    totalCopies: [
      ...current().players.self.hand,
      ...current().players.self.deck,
      ...current().players.self.remove,
    ].filter(cardId => cardId === family.matchId).length,
  };
  settle(family);
  return proof;
}

function proveFamily(family: Family) {
  return { positive: provePositive(family), noMatch: proveNoMatch(family) };
}

function expectedFamily(family: Family) {
  return {
    positive: {
      hand: [family.matchId],
      deck: [...family.leading, TAIL].sort(),
      sourceInRemove: true,
      forced: true,
      noReorder: true,
      bottomBeforeShuffle: true,
    },
    noMatch: {
      hand: [],
      deck: [...family.leading, TAIL].sort(),
      sourceInRemove: true,
      shuffled: true,
    },
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  registerAll();
  [
    fixtureCard(ATTACKER, { ap: 9000 }),
    fixtureCard(DECOY_A, { kind: 'event' }),
    fixtureCard(DECOY_B),
    fixtureCard(TAIL, { kind: 'event' }),
    fixtureCard(OKIYA, { names: ['沖矢昴'] }),
    fixtureCard(AGASA, { names: ['阿笠博士'] }),
    fixtureCard(KOGORO, { names: ['毛利小五郎'] }),
    fixtureCard(NAGANO, { traits: ['長野県警'] }),
    fixtureCard(NAGANO_EVENT, { kind: 'event', traits: ['長野県警'] }),
  ].forEach(register);
  registerTriggeredListener();
  restartSession('self');
});

afterEach(() => endMatchSession());

describe('forced leave reveal-until abilities through public dispatch', () => {
  it(`card:B02058:${QA}`, () => expect(proveFamily(FAMILIES[0]!), 'B02058 exact forced reveal and no-match public contract').toEqual(expectedFamily(FAMILIES[0]!)));
  it(`card:B03019:${QA}`, () => expect(proveFamily(FAMILIES[1]!), 'B03019 exact forced reveal and no-match public contract').toEqual(expectedFamily(FAMILIES[1]!)));
  it(`card:B05021:${QA}`, () => expect(proveFamily(FAMILIES[2]!), 'B05021 exact forced reveal and no-match public contract').toEqual(expectedFamily(FAMILIES[2]!)));
  it(`card:B05094:${QA}`, () => expect(proveFamily(FAMILIES[3]!), 'B05094 exact forced reveal and no-match public contract').toEqual(expectedFamily(FAMILIES[3]!)));

  it('applies only to the leaving card during its opponent turn', () => {
    const family = FAMILIES[0]!;
    const deck = [...family.leading, family.matchId, TAIL];
    expect({ wrongTiming: proveWrongTiming(family), otherLeave: proveOtherLeave(family) }).toEqual({
      wrongTiming: { deck, hand: [], sourceInRemove: true, reveal: null, sourceTriggers: 0 },
      otherLeave: { deck, hand: [], sourceOnScene: true, victimInRemove: true, reveal: null },
    });
  });

  it('resolves the mirrored owner, duplicate occurrence, and short-deck refresh paths', () => {
    expect({
      mirrored: proveMirroredOwner(FAMILIES[1]!),
      duplicate: proveDuplicateOccurrence(FAMILIES[0]!),
      shortDeck: proveShortDeckRefresh(FAMILIES[1]!),
    }).toEqual({
      mirrored: { oppHand: [AGASA], selfHand: [], oppSourceInRemove: true },
      duplicate: { handCopies: 1, deckCopies: 1, totalCopies: 2 },
      shortDeck: {
        hand: [AGASA],
        deck: [B03019.id],
        remove: [],
        refreshCount: 1,
        opponentEvidence: 1,
        gameResult: undefined,
      },
    });
  });
});
