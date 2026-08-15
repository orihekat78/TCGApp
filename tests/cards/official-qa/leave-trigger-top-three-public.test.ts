// qa: card:B03079:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B03079:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:D01012:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D01012:521a153c1557b494d89fb612b53cbcb3b06d1e373fb99f8d2350aa4d74d9bf57
// qa: card:D05007:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:D05007:216e4118ce0e6dee6b35cf6cb0ba410f2d0b61166b555fdebd7ea192a5d6903e
// Rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { B03079 } from '@/cards/ct-p03/B03079';
import { B03079P } from '@/cards/ct-p03/B03079P';
import { B10022 } from '@/cards/ct-p10/B10022';
import { D01012 } from '@/cards/ct-d01/D01012';
import { D05007 } from '@/cards/ct-d05/D05007';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const LEAVE_QA = '366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58';
const B03079_UP_TO_QA = '3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d';
const D01012_UP_TO_QA = '521a153c1557b494d89fb612b53cbcb3b06d1e373fb99f8d2350aa4d74d9bf57';
const D05007_UP_TO_QA = '216e4118ce0e6dee6b35cf6cb0ba410f2d0b61166b555fdebd7ea192a5d6903e';
const ATTACKER = 'QA_TOP3_ATTACKER';
const VICTIM = 'QA_TOP3_VICTIM';
const OTHER_COLOR = '緑';

type Destination = 'hand' | 'scene';

type Family = {
  card: CardDef;
  destination: Destination;
};

type Fixture = {
  matchA: CardDef;
  matchB: CardDef;
  wrongColor: CardDef;
  wrongColorSecond: CardDef;
  wrongColorThird: CardDef;
  wrongKind: CardDef;
  overLevel: CardDef;
  tail: CardDef;
};

const runtimeFamilies: Family[] = [
  { card: B03079, destination: 'hand' },
  { card: B03079P, destination: 'hand' },
  { card: D01012, destination: 'scene' },
  { card: D05007, destination: 'scene' },
];

function qa(card: CardDef, suffix: string): string {
  return `card:${card.id}:${suffix}`;
}

function syntheticCard(
  id: string,
  color: string,
  kind: CardDef['kind'] = 'character',
  level = 1,
  ap = 1000,
): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: [color],
    level: kind === 'character' ? level : 0,
    ap: kind === 'character' ? ap : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function buildFixture(family: Family): Fixture {
  const prefix = `QA_TOP3_${family.card.id}`;
  const color = family.card.colors[0]!;
  const handDestination = family.destination === 'hand';
  return {
    matchA: syntheticCard(`${prefix}_MATCH_A`, color, 'character', 1),
    matchB: syntheticCard(`${prefix}_MATCH_B`, color, handDestination ? 'event' : 'character', 4),
    wrongColor: syntheticCard(`${prefix}_WRONG_COLOR`, OTHER_COLOR, 'character', 1),
    wrongColorSecond: syntheticCard(`${prefix}_WRONG_COLOR_SECOND`, OTHER_COLOR, 'event'),
    wrongColorThird: syntheticCard(`${prefix}_WRONG_COLOR_THIRD`, OTHER_COLOR, 'character', 2),
    wrongKind: syntheticCard(`${prefix}_WRONG_KIND`, color, 'event'),
    overLevel: syntheticCard(`${prefix}_OVER_LEVEL`, color, 'character', 5),
    tail: syntheticCard(`${prefix}_TAIL`, OTHER_COLOR, 'event'),
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

function install(family: Family, turn: Player, deck: string[], includeVictim = false): void {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: turn, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ cardId: family.card.id, uid: 'source', state: 'sleep' }),
    ...(turn === 'self' ? [makeChar({ cardId: B10022.id, uid: 'remover', state: 'active' })] : []),
    ...(includeVictim ? [makeChar({ cardId: VICTIM, uid: 'victim', state: 'sleep' })] : []),
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

function removeThroughPublicContact(targetUid: string): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function removeMirroredThroughPublicContact(targetUid: string): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
}

function expectLeaveTrigger(family: Family): void {
  expect(current().pendingEffects.find((entry) => (
    entry.source.cardId === family.card.id
      && entry.source.uid === 'source'
      && entry.source.abilityId === 'a1'
      && entry.triggeredBy.hook === 'leave:to-remove'
  )), `${family.card.id}: exact public leave trigger provenance`).toMatchObject({
    source: { cardId: family.card.id, uid: 'source', abilityId: 'a1', player: 'self' },
    triggeredBy: { hook: 'leave:to-remove' },
  });
}

function pendingDeckPick(family: Family, revealed: string[]) {
  expect(useGameStateStore.getState().pendingDeckReveal, `${family.card.id}: private top-three presentation`).toMatchObject({
    player: 'self',
    revealed,
    awaitingPick: true,
    source: { cardId: family.card.id, abilityId: 'a1' },
  });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${family.card.id}: public decision-bound deck choice`).toMatchObject({
    atomVerb: 'deckRevealUntil',
    source: { cardId: family.card.id, abilityId: 'a1' },
  });
  return pending!;
}

function resolveDeckPick(family: Family, revealed: string[], cardId: string | null): void {
  const pending = pendingDeckPick(family, revealed);
  const candidate = cardId === null ? null : pending.candidates.find((entry) => entry.cardId === cardId);
  if (cardId !== null) expect(candidate, `${family.card.id}: exact non-first deck occurrence is selectable`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: candidate?.uid ?? null,
  }))).toEqual({ ok: true });
}

function dismissCompletedReveal(
  family: Family,
  revealed: string[],
  matched: string | null,
  player: Player = 'self',
): void {
  const presentation = useGameStateStore.getState().pendingDeckReveal;
  expect(presentation, `${family.card.id}: completed top-three presentation`).toMatchObject({
    player,
    revealed,
    matched,
    source: { cardId: family.card.id, abilityId: 'a1' },
  });
  expect(presentation?.awaitingPick).not.toBe(true);
  useGameStateStore.getState().setPendingDeckReveal(null);
}

function resolveBottomOrder(
  family: Family,
  expectedResiduals: string[],
  order: string[],
  player: Player = 'self',
): void {
  const pending = useGameStateStore.getState().pendingDeckReorder;
  expect(pending, `${family.card.id}: residual cards require public bottom ordering`).toMatchObject({
    player,
    cardIds: expectedResiduals,
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'deckReorderResolve',
    order,
  }))).toEqual({ ok: true });
}

function expectSettled(family: Family): void {
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 3 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId }), `${family.card.id}: terminal advance ${index + 1}`).toEqual({ ok: true });
  }
  const store = useGameStateStore.getState();
  expect(store.pendingDeckReveal, `${family.card.id}: no reveal presentation`).toBeNull();
  expect(store.pendingEffectPick, `${family.card.id}: no unresolved pick`).toBeNull();
  expect(store.pendingDeckReorder, `${family.card.id}: no unresolved reorder`).toBeNull();
  expect(store.activeActionId, `${family.card.id}: no open action`).toBeNull();
  expect(current().pendingRuntimeState, `${family.card.id}: no persisted decision authority`).toBeUndefined();
  expect(Object.keys(current().actionContexts ?? {}), `${family.card.id}: no retained action context`).toEqual([]);
}

function destinationSnapshot(family: Family, fixture: Fixture): unknown {
  return family.destination === 'hand'
    ? {
        hand: [...current().players.self.hand],
        entered: current().players.self.scene.filter((entry) => entry.cardId === fixture.matchB.id),
      }
    : {
        hand: [...current().players.self.hand],
        entered: current().players.self.scene
          .filter((entry) => entry.cardId === fixture.matchB.id)
          .map((entry) => ({ cardId: entry.cardId, state: entry.state })),
      };
}

function provePositive(family: Family) {
  const fixture = buildFixture(family);
  const revealed = [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id];
  restartSession('self');
  install(family, 'opp', [...revealed, fixture.tail.id]);
  removeThroughPublicContact('source');
  expectLeaveTrigger(family);
  const pending = pendingDeckPick(family, revealed);
  const selected = pending.candidates.find((entry) => entry.cardId === fixture.matchB.id);
  const choice = {
    range: [pending.nMin, pending.nMax],
    candidates: pending.candidates.map((entry) => ({ cardId: entry.cardId, index: entry.index })),
    selectedWitness: selected?.occurrenceWitness,
  };
  let handRevealEvents = 0;
  const stopListening = event.on('hand:reveal', () => { handRevealEvents += 1; });
  try {
    resolveDeckPick(family, revealed, fixture.matchB.id);
  } finally {
    stopListening();
  }
  expect(handRevealEvents, `${family.card.id}: deck publication is not a hand reveal hook`).toBe(0);
  const publicReveal = useGameStateStore.getState().pendingPublicHandReveal;
  if (family.destination === 'hand') {
    expect(publicReveal, `${family.card.id}: only the selected card is public`).toMatchObject({
      owner: 'self',
      audience: 'all',
      cardIds: [fixture.matchB.id],
      lifetime: 'presentation',
      origin: 'deck-selected-card',
      source: { cardId: family.card.id, abilityId: 'a1' },
    });
    expect(publicReveal).not.toHaveProperty('handSnapshot');
    expect(publicReveal?.cardIds).not.toContain(fixture.matchA.id);
    expect(publicReveal?.cardIds).not.toContain(fixture.wrongColor.id);
    useGameStateStore.getState().setPendingPublicHandReveal(null);
  } else {
    expect(publicReveal, `${family.card.id}: scene entry does not publish a hand card`).toBeNull();
  }
  const destinationBeforeOrder = destinationSnapshot(family, fixture);
  dismissCompletedReveal(family, revealed, fixture.matchB.id);
  resolveBottomOrder(family, [fixture.matchA.id, fixture.wrongColor.id], [fixture.wrongColor.id, fixture.matchA.id]);
  expectSettled(family);
  return {
    choice,
    publicReveal: publicReveal === null ? null : {
      owner: publicReveal.owner,
      cardIds: publicReveal.cardIds,
      lifetime: publicReveal.lifetime,
      origin: (publicReveal as { origin?: string }).origin,
    },
    destinationBeforeOrder,
    deck: [...current().players.self.deck],
    remove: [...current().players.self.remove],
  };
}

function proveDecline(family: Family) {
  const fixture = buildFixture(family);
  const revealed = [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id];
  restartSession('self');
  install(family, 'opp', [...revealed, fixture.tail.id]);
  removeThroughPublicContact('source');
  expectLeaveTrigger(family);
  const pending = pendingDeckPick(family, revealed);
  const choice = {
    range: [pending.nMin, pending.nMax],
    candidates: pending.candidates.map((entry) => entry.cardId),
  };
  resolveDeckPick(family, revealed, null);
  expect(useGameStateStore.getState().pendingPublicHandReveal, `${family.card.id}: decline publishes no identity`).toBeNull();
  const destinationBeforeOrder = destinationSnapshot(family, fixture);
  dismissCompletedReveal(family, revealed, null);
  resolveBottomOrder(family, revealed, [fixture.matchB.id, fixture.wrongColor.id, fixture.matchA.id]);
  expectSettled(family);
  return {
    choice,
    destinationBeforeOrder,
    deck: [...current().players.self.deck],
    remove: [...current().players.self.remove],
  };
}

function proveNoMatch(family: Family) {
  const fixture = buildFixture(family);
  const revealed = family.destination === 'hand'
    ? [fixture.wrongColor.id, fixture.wrongColorSecond.id, fixture.wrongColorThird.id]
    : [fixture.wrongColor.id, fixture.wrongKind.id, fixture.overLevel.id];
  restartSession('self');
  install(family, 'opp', [...revealed, fixture.tail.id]);
  removeThroughPublicContact('source');
  expectLeaveTrigger(family);
  const pending = pendingDeckPick(family, revealed);
  const choice = { range: [pending.nMin, pending.nMax], candidates: pending.candidates.map((entry) => entry.cardId) };
  resolveDeckPick(family, revealed, null);
  expect(useGameStateStore.getState().pendingPublicHandReveal, `${family.card.id}: no match publishes no identity`).toBeNull();
  dismissCompletedReveal(family, revealed, null);
  resolveBottomOrder(family, revealed, [...revealed].reverse());
  expectSettled(family);
  return {
    choice,
    destination: destinationSnapshot(family, fixture),
    deck: [...current().players.self.deck],
  };
}

function proveWrongTiming(family: Family) {
  const fixture = buildFixture(family);
  const deck = [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id];
  restartSession('self');
  install(family, 'self', deck);
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
  const removal = useGameStateStore.getState().pendingEffectPick;
  expect(removal).toMatchObject({ source: { cardId: B10022.id, abilityId: 'a1' } });
  const source = removal!.candidates.find((entry) => entry.uid === 'source');
  expect(source).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(removal!, {
    type: 'effectPickResolve',
    pickedUid: source!.uid,
  }))).toEqual({ ok: true });
  expectSettled(family);
  return {
    sourceInRemove: current().players.self.remove.includes(family.card.id),
    deck: [...current().players.self.deck],
    triggerCount: current().pendingEffects.filter((entry) => entry.source.cardId === family.card.id).length,
  };
}

function proveOtherLeave(family: Family) {
  const fixture = buildFixture(family);
  const deck = [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id];
  restartSession('self');
  install(family, 'opp', deck, true);
  removeThroughPublicContact('victim');
  expectSettled(family);
  return {
    sourceOnScene: current().players.self.scene.some((entry) => entry.uid === 'source'),
    victimInRemove: current().players.self.remove.includes(VICTIM),
    deck: [...current().players.self.deck],
    triggerCount: current().pendingEffects.filter((entry) => entry.source.cardId === family.card.id).length,
  };
}

function expectedPositive(family: Family) {
  const fixture = buildFixture(family);
  return {
    choice: {
      range: [0, 1],
      candidates: [
        { cardId: fixture.matchA.id, index: 0 },
        { cardId: fixture.matchB.id, index: 2 },
      ],
      selectedWitness: expect.stringMatching(/^occ:v1:self:deck:/),
    },
    destinationBeforeOrder: family.destination === 'hand'
      ? { hand: [fixture.matchB.id], entered: [] }
      : { hand: [], entered: [{ cardId: fixture.matchB.id, state: 'sleep' }] },
    publicReveal: family.destination === 'hand'
      ? { owner: 'self', cardIds: [fixture.matchB.id], lifetime: 'presentation', origin: 'deck-selected-card' }
      : null,
    deck: [fixture.tail.id, fixture.wrongColor.id, fixture.matchA.id],
    remove: [family.card.id],
  };
}

function expectedDecline(family: Family) {
  const fixture = buildFixture(family);
  return {
    choice: { range: [0, 1], candidates: [fixture.matchA.id, fixture.matchB.id] },
    destinationBeforeOrder: { hand: [], entered: [] },
    deck: [fixture.tail.id, fixture.matchB.id, fixture.wrongColor.id, fixture.matchA.id],
    remove: [family.card.id],
  };
}

function expectedNoMatch(family: Family) {
  const fixture = buildFixture(family);
  const revealed = family.destination === 'hand'
    ? [fixture.wrongColor.id, fixture.wrongColorSecond.id, fixture.wrongColorThird.id]
    : [fixture.wrongColor.id, fixture.wrongKind.id, fixture.overLevel.id];
  return {
    choice: { range: [0, 0], candidates: [] },
    destination: { hand: [], entered: [] },
    deck: [fixture.tail.id, ...revealed.slice().reverse()],
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  registerAll();
  register(syntheticCard(ATTACKER, OTHER_COLOR, 'character', 1, 9000));
  register(syntheticCard(VICTIM, OTHER_COLOR));
  for (const family of runtimeFamilies) {
    const fixture = buildFixture(family);
    Object.values(fixture).forEach(register);
  }
  registerTriggeredListener();
  restartSession('self');
});

afterEach(() => endMatchSession());

describe('top-three opponent-turn leave effects through public dispatch', () => {
  it(qa(B03079, LEAVE_QA), () => {
    const base = provePositive({ card: B03079, destination: 'hand' });
    const promo = provePositive({ card: B03079P, destination: 'hand' });
    const wrongTiming = proveWrongTiming({ card: B03079, destination: 'hand' });
    const otherLeave = proveOtherLeave({ card: B03079, destination: 'hand' });
    const fixture = buildFixture({ card: B03079, destination: 'hand' });
    expect({ base, promo, wrongTiming, otherLeave }, `${B03079.id}/${B03079P.id}: only opponent-turn self leave resolves top-three selection and chosen bottom order`).toEqual({
      base: expectedPositive({ card: B03079, destination: 'hand' }),
      promo: expectedPositive({ card: B03079P, destination: 'hand' }),
      wrongTiming: { sourceInRemove: true, deck: [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id], triggerCount: 0 },
      otherLeave: { sourceOnScene: true, victimInRemove: true, deck: [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id], triggerCount: 0 },
    });
  });

  it(qa(B03079, B03079_UP_TO_QA), () => {
    const base = { card: B03079, destination: 'hand' } as const;
    const promo = { card: B03079P, destination: 'hand' } as const;
    const baseDecline = proveDecline(base);
    const baseNoMatch = proveNoMatch(base);
    const promoDecline = proveDecline(promo);
    const promoNoMatch = proveNoMatch(promo);
    expect({ baseDecline, baseNoMatch, promoDecline, promoNoMatch }, `${B03079.id}/${B03079P.id}: up-to-one permits zero with eligible cards and still orders every residual`).toEqual({
      baseDecline: expectedDecline(base),
      baseNoMatch: expectedNoMatch(base),
      promoDecline: expectedDecline(promo),
      promoNoMatch: expectedNoMatch(promo),
    });
  });

  it(qa(D01012, LEAVE_QA), () => {
    const family = { card: D01012, destination: 'scene' } as const;
    const positive = provePositive(family);
    const wrongTiming = proveWrongTiming(family);
    const otherLeave = proveOtherLeave(family);
    const fixture = buildFixture(family);
    expect({ positive, wrongTiming, otherLeave }, `${D01012.id}: only opponent-turn self leave enters the selected blue level-four character asleep`).toEqual({
      positive: expectedPositive(family),
      wrongTiming: { sourceInRemove: true, deck: [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id], triggerCount: 0 },
      otherLeave: { sourceOnScene: true, victimInRemove: true, deck: [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id], triggerCount: 0 },
    });
  });

  it(qa(D01012, D01012_UP_TO_QA), () => {
    const family = { card: D01012, destination: 'scene' } as const;
    const decline = proveDecline(family);
    const noMatch = proveNoMatch(family);
    expect({ decline, noMatch }, `${D01012.id}: up-to-one permits zero and excludes events, level-five, and off-color cards`).toEqual({
      decline: expectedDecline(family),
      noMatch: expectedNoMatch(family),
    });
  });

  it(qa(D05007, LEAVE_QA), () => {
    const family = { card: D05007, destination: 'scene' } as const;
    const positive = provePositive(family);
    const wrongTiming = proveWrongTiming(family);
    const otherLeave = proveOtherLeave(family);
    const fixture = buildFixture(family);
    expect({ positive, wrongTiming, otherLeave }, `${D05007.id}: only opponent-turn self leave enters the selected yellow level-four character asleep`).toEqual({
      positive: expectedPositive(family),
      wrongTiming: { sourceInRemove: true, deck: [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id], triggerCount: 0 },
      otherLeave: { sourceOnScene: true, victimInRemove: true, deck: [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id, fixture.tail.id], triggerCount: 0 },
    });
  });

  it(qa(D05007, D05007_UP_TO_QA), () => {
    const family = { card: D05007, destination: 'scene' } as const;
    const decline = proveDecline(family);
    const noMatch = proveNoMatch(family);
    expect({ decline, noMatch }, `${D05007.id}: up-to-one permits zero and excludes events, level-five, and off-color cards`).toEqual({
      decline: expectedDecline(family),
      noMatch: expectedNoMatch(family),
    });
  });
});

describe('top-three scene-entry continuation switch authority', () => {
  it.each([
    { card: D01012, destination: 'scene' as const },
    { card: D05007, destination: 'scene' as const },
  ])('$card.id switches a full scene after selecting the second duplicate deck occurrence', (family) => {
    const fixture = buildFixture(family);
    const revealed = [fixture.matchB.id, fixture.wrongColor.id, fixture.matchB.id];
    restartSession('self');
    install(family, 'opp', [...revealed, fixture.tail.id]);
    removeThroughPublicContact('source');
    expectLeaveTrigger(family);

    const pending = pendingDeckPick(family, revealed);
    const duplicateCandidates = pending.candidates.filter((candidate) => candidate.cardId === fixture.matchB.id);
    expect(duplicateCandidates.map((candidate) => candidate.index), `${family.card.id}: both physical duplicate occurrences are selectable`)
      .toEqual([0, 2]);

    const filled = structuredClone(current());
    filled.players.self.scene = Array.from({ length: 5 }, (_, index) => makeChar({
      cardId: VICTIM,
      uid: `full-${index}`,
      state: 'active',
    }));
    expect(useGameStateStore.getState().setGameState(filled, { preserveRuntime: true })).toBe(true);
    const restored = JSON.parse(JSON.stringify(current())) as GameState;
    restartSession('self');
    expect(useGameStateStore.getState().setGameState(restored), `${family.card.id}: persisted look-ahead switch authority hydrates`).toBe(true);
    const livePending = useGameStateStore.getState().pendingEffectPick;
    expect(livePending).toMatchObject({
      atomVerb: 'deckRevealUntil',
      player: 'self',
      sceneEnterSwitchPlayer: 'self',
    });
    const beforeForgedSwitch = structuredClone(current());
    expect(dispatchEngineAction(bindPendingDecision(livePending!, {
      type: 'effectPickResolve',
      pickedUid: duplicateCandidates[1]!.uid,
      switchRemoveUid: 'forged-switch-victim',
    })), `${family.card.id}: forged switch victim is rejected before mutation`).toEqual({
      ok: false,
      reason: 'not-allowed',
    });
    expect(current(), `${family.card.id}: forged switch answer preserves authoritative state`).toEqual(beforeForgedSwitch);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(livePending?.decisionId);

    expect(dispatchEngineAction(bindPendingDecision(livePending!, {
      type: 'effectPickResolve',
      pickedUid: duplicateCandidates[1]!.uid,
      switchRemoveUid: 'full-2',
    })), `${family.card.id}: selected deck occurrence and switch victim resolve atomically`).toEqual({ ok: true });

    dismissCompletedReveal(family, revealed, fixture.matchB.id);
    resolveBottomOrder(
      family,
      [fixture.matchB.id, fixture.wrongColor.id],
      [fixture.wrongColor.id, fixture.matchB.id],
    );
    expectSettled(family);

    expect({
      sceneCount: current().players.self.scene.length,
      entered: current().players.self.scene
        .filter((character) => character.cardId === fixture.matchB.id)
        .map((character) => character.state),
      removedSwitchVictim: current().players.self.scene.some((character) => character.uid === 'full-2'),
      sourceCopiesInRemove: current().players.self.remove.filter((cardId) => cardId === family.card.id).length,
      victimCopiesInRemove: current().players.self.remove.filter((cardId) => cardId === VICTIM).length,
      remainingSelectedIdInDeck: current().players.self.deck.filter((cardId) => cardId === fixture.matchB.id).length,
      deck: current().players.self.deck,
    }, `${family.card.id}: exact second duplicate enters asleep while one existing character switches out`).toEqual({
      sceneCount: 5,
      entered: ['sleep'],
      removedSwitchVictim: false,
      sourceCopiesInRemove: 1,
      victimCopiesInRemove: 1,
      remainingSelectedIdInDeck: 1,
      deck: [fixture.tail.id, fixture.wrongColor.id, fixture.matchB.id],
    });
  });
});

describe('top-three mirrored opponent-controller flow', () => {
  it.each([
    { card: B03079, destination: 'hand' as const },
    { card: D01012, destination: 'scene' as const },
    { card: D05007, destination: 'scene' as const },
  ])('$card.id resolves the same leave, choice, destination, and reorder on the opponent side', (family) => {
    const fixture = buildFixture(family);
    const revealed = [fixture.matchA.id, fixture.wrongColor.id, fixture.matchB.id];
    restartSession('opp');
    installMirrored(family, [...revealed, fixture.tail.id]);
    removeMirroredThroughPublicContact('source');

    expect(current().pendingEffects.find((entry) => (
      entry.source.cardId === family.card.id
        && entry.source.uid === 'source'
        && entry.source.abilityId === 'a1'
        && entry.source.player === 'opp'
    )), `${family.card.id}: mirrored leave trigger keeps opponent ownership`).toMatchObject({
      source: { cardId: family.card.id, uid: 'source', abilityId: 'a1', player: 'opp' },
      triggeredBy: { hook: 'leave:to-remove' },
    });
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'opp',
      revealed,
      awaitingPick: true,
    });
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: 'opp',
      ownerPlayer: 'opp',
      atomVerb: 'deckRevealUntil',
      ...(family.destination === 'scene' ? { sceneEnterSwitchPlayer: 'opp' } : {}),
    });
    const selected = pending!.candidates.find((candidate) => candidate.cardId === fixture.matchB.id);
    expect(selected, `${family.card.id}: mirrored owner sees the non-first match`).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve',
      pickedUid: selected!.uid,
    }))).toEqual({ ok: true });

    dismissCompletedReveal(family, revealed, fixture.matchB.id, 'opp');
    if (family.destination === 'hand') {
      expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
        owner: 'opp',
        cardIds: [fixture.matchB.id],
        origin: 'deck-selected-card',
      });
      useGameStateStore.getState().setPendingPublicHandReveal(null);
    }
    resolveBottomOrder(
      family,
      [fixture.matchA.id, fixture.wrongColor.id],
      [fixture.wrongColor.id, fixture.matchA.id],
      'opp',
    );
    expectSettled(family);

    expect({
      selfDeck: current().players.self.deck,
      selfHand: current().players.self.hand,
      selfRemove: current().players.self.remove,
      opponentHand: current().players.opp.hand,
      opponentEntered: current().players.opp.scene
        .filter((character) => character.cardId === fixture.matchB.id)
        .map((character) => character.state),
      opponentRemove: current().players.opp.remove,
      opponentDeck: current().players.opp.deck,
    }, `${family.card.id}: mirrored flow mutates only the opponent-owned zones`).toEqual({
      selfDeck: [],
      selfHand: [],
      selfRemove: [],
      opponentHand: family.destination === 'hand' ? [fixture.matchB.id] : [],
      opponentEntered: family.destination === 'scene' ? ['sleep'] : [],
      opponentRemove: [family.card.id],
      opponentDeck: [fixture.tail.id, fixture.wrongColor.id, fixture.matchA.id],
    });
  });
});

describe('top-three duplicate publication authority', () => {
  it.each([B03079, B03079P])('$id publishes only the exact second duplicate selected from deck', (card) => {
    const family = { card, destination: 'hand' as const };
    const fixture = buildFixture(family);
    const revealed = [fixture.matchB.id, fixture.wrongColor.id, fixture.matchB.id];
    restartSession('self');
    install(family, 'opp', [...revealed, fixture.tail.id]);
    removeThroughPublicContact('source');
    expectLeaveTrigger(family);

    const pending = pendingDeckPick(family, revealed);
    const duplicateCandidates = pending.candidates.filter((candidate) => candidate.cardId === fixture.matchB.id);
    expect(duplicateCandidates.map((candidate) => candidate.index), `${card.id}: both same-ID physical occurrences remain selectable`)
      .toEqual([0, 2]);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: duplicateCandidates[1]!.uid,
    })), `${card.id}: the second physical occurrence is accepted`).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal, `${card.id}: duplicate selection publishes one identity only`).toMatchObject({
      owner: 'self',
      audience: 'all',
      cardIds: [fixture.matchB.id],
      origin: 'deck-selected-card',
    });
    useGameStateStore.getState().setPendingPublicHandReveal(null);
    dismissCompletedReveal(family, revealed, fixture.matchB.id);
    expect(useGameStateStore.getState().pendingDeckReorder?.occurrences,
      `${card.id}: only the selected index-2 occurrence is removed before residual ordering`).toEqual([
      { cardId: fixture.matchB.id, index: 0 },
      { cardId: fixture.wrongColor.id, index: 1 },
    ]);
    resolveBottomOrder(
      family,
      [fixture.matchB.id, fixture.wrongColor.id],
      [fixture.wrongColor.id, fixture.matchB.id],
    );
    expectSettled(family);

    expect({
      acquiredCopies: current().players.self.hand.filter((cardId) => cardId === fixture.matchB.id).length,
      residualCopies: current().players.self.deck.filter((cardId) => cardId === fixture.matchB.id).length,
      deck: current().players.self.deck,
      sourceInRemove: current().players.self.remove,
    }, `${card.id}: the selected duplicate leaves deck while the first physical copy remains in ordered residuals`).toEqual({
      acquiredCopies: 1,
      residualCopies: 1,
      deck: [fixture.tail.id, fixture.wrongColor.id, fixture.matchB.id],
      sourceInRemove: [card.id],
    });
  });
});
