// qa: card:B01013:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B01016:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B01034:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B01053:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B01055:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B01072:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B01090:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B02019:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:B05078:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:D01013:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:D02011:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:D03009:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:D04011:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// qa: card:D05012:d4c026b220211c53a0d4faa965e0250eb4fe8ab5abb2d43355fa2c2d224014b5
// rules: 14-refresh.md, 15-abilities-effects.md, 26-qa-deck-refresh.md

import { ALL_CARDS } from '@/cards';
import { buildReplayLogV3, replayStateAt } from '@/ai/replay/state-frame';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CardColor = CardDef['colors'][number];
type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

interface FamilyCase {
  cardId: string;
  maxN: number;
  discardAfterTake: boolean;
  matchShape: 'color' | 'blue-lp-zero' | 'white-lp-two' | 'green-event' | 'akai-or-detective';
  shufflesAfterBottom?: boolean;
}

interface Fixture {
  source: CardDef;
  matchA: CardDef;
  matchB: CardDef;
  decoys: CardDef[];
  tail: CardDef;
  spare: CardDef;
}

interface Proof {
  positive: {
    range: [number, number];
    candidates: string[];
    acquired: boolean;
    discardCount: number;
    residuals: string[];
    terminal: boolean;
  };
  decline: {
    acquired: boolean;
    discardCount: number;
    residuals: string[];
    terminal: boolean;
  };
  noMatch: {
    range: [number, number];
    candidates: string[];
    discardCount: number;
    residuals: string[];
    terminal: boolean;
  };
}

const CASES: readonly FamilyCase[] = [
  { cardId: 'B01013', maxN: 2, discardAfterTake: false, matchShape: 'blue-lp-zero' },
  { cardId: 'B01016', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'B01034', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'B01053', maxN: 2, discardAfterTake: false, matchShape: 'white-lp-two' },
  { cardId: 'B01055', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'B01072', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'B01090', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'B02019', maxN: 5, discardAfterTake: false, matchShape: 'green-event', shufflesAfterBottom: true },
  { cardId: 'B05078', maxN: 4, discardAfterTake: true, matchShape: 'akai-or-detective' },
  { cardId: 'D01013', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'D02011', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'D03009', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'D04011', maxN: 4, discardAfterTake: true, matchShape: 'color' },
  { cardId: 'D05012', maxN: 4, discardAfterTake: true, matchShape: 'color' },
] as const;

const PRINT_ALIASES = [
  { alias: 'B01013P', base: 'B01013' },
  { alias: 'B01016P', base: 'B01016' },
  { alias: 'B01034P', base: 'B01034' },
  { alias: 'B01055P', base: 'B01055' },
  { alias: 'B01072P', base: 'B01072' },
  { alias: 'B01090P', base: 'B01090' },
  { alias: 'B02019P', base: 'B02019' },
  { alias: 'B05078P', base: 'B05078' },
] as const;

function familyCase(cardId: string): FamilyCase {
  const value = CASES.find(entry => entry.cardId === cardId);
  if (!value) throw new Error(`missing family case: ${cardId}`);
  return value;
}

function actualCard(cardId: string): CardDef {
  const value = ALL_CARDS.find(card => card.id === cardId);
  if (!value) throw new Error(`missing shipped CardDef: ${cardId}`);
  return value;
}

function syntheticCard(
  id: string,
  kind: 'character' | 'event',
  color: CardColor,
  options: { lp?: number; traits?: string[] } = {},
): CardDef {
  const common = {
    id,
    no: id,
    kind,
    names: [id],
    colors: [color],
    level: 1,
    traits: options.traits ?? [],
    keywords: [],
    rarity: 'C' as const,
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
  return kind === 'character'
    ? { ...common, kind, ap: 1000, lp: options.lp ?? 1 }
    : common;
}

function otherColor(color: CardColor): CardColor {
  return color === '赤' ? '青' : '赤';
}

function buildFixture(c: FamilyCase): Fixture {
  const source = actualCard(c.cardId);
  const color = source.colors[0]!;
  const prefix = `QA-${c.cardId}`;
  let matchKind: 'character' | 'event' = 'character';
  let matchColor = color;
  let matchLp = 1;
  let matchTraits: string[] = [];
  let decoyKind: 'character' | 'event' = 'character';
  let decoyColor = otherColor(color);
  let decoyLp = 1;
  let decoyTraits: string[] = [];

  if (c.matchShape === 'blue-lp-zero') {
    matchColor = '青';
    matchLp = 0;
    decoyColor = '青';
    decoyLp = 1;
  } else if (c.matchShape === 'white-lp-two') {
    matchColor = '白';
    matchLp = 2;
    decoyColor = '白';
    decoyLp = 1;
  } else if (c.matchShape === 'green-event') {
    matchKind = 'event';
    matchColor = '緑';
    decoyKind = 'character';
    decoyColor = '緑';
  } else if (c.matchShape === 'akai-or-detective') {
    matchTraits = ['探偵'];
    decoyColor = color;
    decoyTraits = ['QA-NOT-AKAI-OR-DETECTIVE'];
  }

  const matchA = syntheticCard(`${prefix}-MATCH-A`, matchKind, matchColor, { lp: matchLp, traits: matchTraits });
  const matchB = syntheticCard(`${prefix}-MATCH-B`, matchKind, matchColor, { lp: matchLp, traits: matchTraits });
  const decoys = Array.from({ length: c.maxN }, (_, index) => syntheticCard(
    `${prefix}-DECOY-${index + 1}`,
    decoyKind,
    decoyColor,
    { lp: decoyLp, traits: decoyTraits },
  ));
  const tail = syntheticCard(`${prefix}-TAIL`, 'character', otherColor(color));
  const spare = syntheticCard(`${prefix}-SPARE`, 'event', otherColor(color));
  return { source, matchA, matchB, decoys, tail, spare };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(c: FamilyCase, fixture: Fixture, deck: string[]): void {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...fixture.source.colors];
  state.players.self.file = Array.from(
    { length: fixture.source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: 'FILE' }),
  );
  state.players.self.hand = [fixture.source.id, fixture.spare.id];
  state.players.self.deck = [...deck, fixture.tail.id];
  startCausalSession(state, `qa-deck-look-bottom-${c.cardId}`);
  resetPresentationQueue(`qa-deck-look-bottom-${c.cardId}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function resolvePick(pending: PendingPick, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid }))).toEqual({ ok: true });
}

function settleDiscard(fixture: Fixture, expected: boolean): number {
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (!expected) {
    expect(pending?.atomVerb).not.toBe('discard');
    return 0;
  }
  expect(pending).toMatchObject({ atomVerb: 'discard', nMin: 1, nMax: 1 });
  const spare = pending?.candidates.find(candidate => candidate.cardId === fixture.spare.id);
  expect(spare).toBeDefined();
  resolvePick(pending!, spare!.uid);
  return 1;
}

function settleBottomOrder(): string[] {
  const pending = useGameStateStore.getState().pendingDeckReorder;
  if (!pending) return [];
  const residuals = [...pending.cardIds].reverse();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'deckReorderResolve',
    order: residuals,
  }))).toEqual({ ok: true });
  return residuals;
}

function terminal(): boolean {
  const store = useGameStateStore.getState();
  return store.pendingEffectPick === null && store.pendingDeckReorder === null;
}

function deckWithMatches(c: FamilyCase, fixture: Fixture): string[] {
  if (c.maxN === 2) return [fixture.decoys[0]!.id, fixture.matchB.id];
  return [fixture.decoys[0]!.id, fixture.matchA.id, fixture.matchB.id, ...fixture.decoys.slice(1, c.maxN - 2).map(card => card.id)];
}

function runCase(cardId: string, semanticsCardId = cardId): Proof {
  const c = { ...familyCase(semanticsCardId), cardId };
  const fixture = buildFixture(c);
  [fixture.source, fixture.matchA, fixture.matchB, ...fixture.decoys, fixture.tail, fixture.spare].forEach(register);

  install(c, fixture, deckWithMatches(c, fixture));
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
  const positivePick = useGameStateStore.getState().pendingEffectPick;
  expect(positivePick).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, source: { cardId } });
  const selected = positivePick?.candidates.find(candidate => candidate.cardId === fixture.matchB.id)
    ?? positivePick?.candidates[0];
  expect(selected).toBeDefined();
  const positiveCandidates = positivePick!.candidates.map(candidate => candidate.cardId);
  resolvePick(positivePick!, selected!.uid);
  const positiveDiscardCount = settleDiscard(fixture, c.discardAfterTake);
  const positiveResiduals = settleBottomOrder();
  const expectedPositiveResiduals = deckWithMatches(c, fixture).filter(id => id !== selected!.cardId);
  const expectedPositiveOrder = c.shufflesAfterBottom
    ? expectedPositiveResiduals
    : [...expectedPositiveResiduals].reverse();
  const positiveDeck = current().players.self.deck.filter(id => id !== fixture.tail.id);
  const positiveAcquired = current().players.self.hand.includes(selected!.cardId);
  const positiveTerminal = terminal();

  install(c, fixture, deckWithMatches(c, fixture));
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
  const declinePick = useGameStateStore.getState().pendingEffectPick!;
  resolvePick(declinePick, null);
  const declineDiscardCount = settleDiscard(fixture, false);
  const declineResiduals = settleBottomOrder();
  const expectedDeclineResiduals = deckWithMatches(c, fixture);
  const expectedDeclineOrder = c.shufflesAfterBottom
    ? expectedDeclineResiduals
    : [...expectedDeclineResiduals].reverse();
  const declineDeck = current().players.self.deck.filter(id => id !== fixture.tail.id);
  const declineAcquired = current().players.self.hand.includes(fixture.matchA.id)
    || current().players.self.hand.includes(fixture.matchB.id);
  const declineTerminal = terminal();

  const noMatchDeck = fixture.decoys.slice(0, c.maxN).map(card => card.id);
  install(c, fixture, noMatchDeck);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
  const noMatchPick = useGameStateStore.getState().pendingEffectPick!;
  const noMatchRange: [number, number] = [noMatchPick.nMin, noMatchPick.nMax];
  const noMatchCandidates = noMatchPick.candidates.map(candidate => candidate.cardId);
  resolvePick(noMatchPick, null);
  const noMatchDiscardCount = settleDiscard(fixture, false);
  const noMatchResiduals = settleBottomOrder();
  const noMatchDeckAfter = current().players.self.deck.filter(id => id !== fixture.tail.id);
  const noMatchTerminal = terminal();

  const normalizeResiduals = (pending: string[], deck: string[], expected: string[], unordered = false) => {
    const actual = pending.length > 0 ? pending : deck;
    if (unordered) {
      expect(actual.slice().sort()).toEqual(expected.slice().sort());
      return actual.slice().sort();
    }
    expect(actual).toEqual(expected);
    return actual;
  };

  return {
    positive: {
      range: [positivePick!.nMin, positivePick!.nMax],
      candidates: positiveCandidates.sort(),
      acquired: positiveAcquired,
      discardCount: positiveDiscardCount,
      residuals: normalizeResiduals(positiveResiduals, positiveDeck, expectedPositiveOrder, c.shufflesAfterBottom),
      terminal: positiveTerminal,
    },
    decline: {
      acquired: declineAcquired,
      discardCount: declineDiscardCount,
      residuals: normalizeResiduals(declineResiduals, declineDeck, expectedDeclineOrder, c.shufflesAfterBottom),
      terminal: declineTerminal,
    },
    noMatch: {
      range: noMatchRange,
      candidates: noMatchCandidates,
      discardCount: noMatchDiscardCount,
      residuals: normalizeResiduals(
        noMatchResiduals,
        noMatchDeckAfter,
        c.shufflesAfterBottom ? noMatchDeck : [...noMatchDeck].reverse(),
        c.shufflesAfterBottom,
      ),
      terminal: noMatchTerminal,
    },
  };
}

function expected(cardId: string, semanticsCardId = cardId): Proof {
  const c = { ...familyCase(semanticsCardId), cardId };
  const fixture = buildFixture(c);
  const candidateIds = c.maxN === 2 ? [fixture.matchB.id] : [fixture.matchA.id, fixture.matchB.id];
  const looked = deckWithMatches(c, fixture);
  return {
    positive: {
      range: [0, 1],
      candidates: candidateIds.sort(),
      acquired: true,
      discardCount: c.discardAfterTake ? 1 : 0,
      residuals: c.shufflesAfterBottom
        ? looked.filter(id => id !== fixture.matchB.id).sort()
        : looked.filter(id => id !== fixture.matchB.id).reverse(),
      terminal: true,
    },
    decline: {
      acquired: false,
      discardCount: 0,
      residuals: c.shufflesAfterBottom ? looked.slice().sort() : looked.slice().reverse(),
      terminal: true,
    },
    noMatch: {
      range: [0, 0],
      candidates: [],
      discardCount: 0,
      residuals: c.shufflesAfterBottom
        ? fixture.decoys.slice(0, c.maxN).map(card => card.id).sort()
        : fixture.decoys.slice(0, c.maxN).map(card => card.id).reverse(),
      terminal: true,
    },
  };
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  vi.restoreAllMocks();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('official QA deck-look / optional take / bottom family through public dispatch', () => {
  it('B01013', () => { expect(runCase('B01013')).toEqual(expected('B01013')); });
  it('B01016', () => { expect(runCase('B01016')).toEqual(expected('B01016')); });
  it('B01034', () => { expect(runCase('B01034')).toEqual(expected('B01034')); });
  it('B01053', () => { expect(runCase('B01053')).toEqual(expected('B01053')); });
  it('B01055', () => { expect(runCase('B01055')).toEqual(expected('B01055')); });
  it('B01072', () => { expect(runCase('B01072')).toEqual(expected('B01072')); });
  it('B01090', () => { expect(runCase('B01090')).toEqual(expected('B01090')); });
  it('B02019', () => { expect(runCase('B02019')).toEqual(expected('B02019')); });
  it('B05078', () => { expect(runCase('B05078')).toEqual(expected('B05078')); });
  it('D01013', () => { expect(runCase('D01013')).toEqual(expected('D01013')); });
  it('D02011', () => { expect(runCase('D02011')).toEqual(expected('D02011')); });
  it('D03009', () => { expect(runCase('D03009')).toEqual(expected('D03009')); });
  it('D04011', () => { expect(runCase('D04011')).toEqual(expected('D04011')); });
  it('D05012', () => { expect(runCase('D05012')).toEqual(expected('D05012')); });

  it.each(PRINT_ALIASES)('$alias follows the same public physical-print flow as $base', ({ alias, base }) => {
    expect(runCase(alias, base)).toEqual(expected(alias, base));
  });

  it('keeps the selected non-first duplicate occurrence out of the bottom-order window', () => {
    const c = familyCase('B01016');
    const fixture = buildFixture(c);
    [fixture.source, fixture.matchA, ...fixture.decoys, fixture.tail, fixture.spare].forEach(register);
    install(c, fixture, [
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.matchA.id,
      fixture.decoys[1]!.id,
    ]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const duplicates = pending.candidates.filter(candidate => candidate.cardId === fixture.matchA.id);
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map(candidate => candidate.index)).toEqual([0, 2]);

    resolvePick(pending, duplicates[1]!.uid);
    settleDiscard(fixture, true);
    const reorder = useGameStateStore.getState().pendingDeckReorder!;
    expect(reorder.deckSnapshot).toEqual([
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.tail.id,
    ]);
  });

  it('rehydrates the exact non-first duplicate deck occurrence through public dispatch', () => {
    const c = familyCase('B01016');
    const fixture = buildFixture(c);
    [fixture.source, fixture.matchA, ...fixture.decoys, fixture.tail, fixture.spare].forEach(register);
    install(c, fixture, [
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.matchA.id,
      fixture.decoys[1]!.id,
    ]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const before = useGameStateStore.getState().pendingEffectPick!;
    const beforeDuplicates = before.candidates.filter(candidate => candidate.cardId === fixture.matchA.id);
    expect(beforeDuplicates).toHaveLength(2);
    const persisted = JSON.parse(JSON.stringify(current())) as GameState;
    expect(persisted.pendingRuntimeState).toBeDefined();

    useGameStateStore.getState().setPendingEffectPick(null);
    resetPendingRuntimeState();
    expect(useGameStateStore.getState().setGameState(persisted)).toBe(true);

    const restored = useGameStateStore.getState().pendingEffectPick!;
    const restoredDuplicates = restored.candidates.filter(candidate => candidate.cardId === fixture.matchA.id);
    expect(restoredDuplicates.map(candidate => ({
      uid: candidate.uid,
      index: candidate.index,
      occurrenceWitness: candidate.occurrenceWitness,
    }))).toEqual(beforeDuplicates.map(candidate => ({
      uid: candidate.uid,
      index: candidate.index,
      occurrenceWitness: candidate.occurrenceWitness,
    })));

    resolvePick(restored, restoredDuplicates[1]!.uid);
    settleDiscard(fixture, true);
    expect(useGameStateStore.getState().pendingDeckReorder?.deckSnapshot).toEqual([
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.tail.id,
    ]);
    settleBottomOrder();
    expect(terminal()).toBe(true);
    expect(current().players.self.hand.filter(cardId => cardId === fixture.matchA.id)).toHaveLength(1);
    expect(current().players.self.deck.filter(cardId => cardId === fixture.matchA.id)).toHaveLength(1);
  });

  it.each([
    { answer: 'a selected occurrence', pick: (pending: PendingPick) => pending.candidates[1]!.uid },
    { answer: 'a decline', pick: (_pending: PendingPick) => null },
  ])('fizzles $answer after an identity-preserving deck shuffle without reviving the prompt', ({ pick }) => {
    const c = familyCase('B01013');
    const fixture = buildFixture(c);
    [fixture.source, fixture.matchA, fixture.tail, fixture.spare].forEach(register);
    install(c, fixture, [fixture.matchA.id, fixture.matchA.id]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const before = structuredClone(current());
    const replaced = produce(current(), draft => {
      mutate.deck.shuffle(draft, 'self', () => 0.999999);
    });
    expect(replaced.players.self.deck).toEqual(before.players.self.deck);
    useGameStateStore.setState({ gameState: replaced });

    resolvePick(pending, pick(pending));
    const after = current();
    expect(after.players.self.deck).toEqual(before.players.self.deck);
    expect(after.players.self.hand).toEqual(before.players.self.hand);
    expect(after.players.self.remove).toEqual(before.players.self.remove);
    expect(after.log).toContainEqual(expect.objectContaining({ action: 'causal.fizzle', result: 'fizzled' }));

    const reloaded = structuredClone(after);
    useGameStateStore.getState().setPendingEffectPick(null);
    resetPendingRuntimeState();
    expect(useGameStateStore.getState().setGameState(reloaded)).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.deck).toEqual(before.players.self.deck);
    expect(current().players.self.hand).toEqual(before.players.self.hand);
    expect(current().players.self.remove).toEqual(before.players.self.remove);
  });

  it.each(['B02019', 'B02019P'] as const)('%s shuffles only the revealed remainder without a reorder decision', (cardId) => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const c = { ...familyCase('B02019'), cardId };
    const fixture = buildFixture(c);
    const tailTwo = syntheticCard(`QA-${cardId}-POSITIVE-TAIL-TWO`, 'character', otherColor(fixture.source.colors[0]!));
    [fixture.source, fixture.matchA, ...fixture.decoys, fixture.tail, fixture.spare, tailTwo].forEach(register);
    install(c, fixture, [
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.decoys[3]!.id,
      tailTwo.id,
    ]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const selected = pending.candidates.find(candidate => candidate.cardId === fixture.matchA.id)!;
    resolvePick(pending, selected.uid);

    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
    expect(current().players.self.deck).toEqual([
      tailTwo.id,
      fixture.tail.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.decoys[3]!.id,
      fixture.decoys[0]!.id,
    ]);
  });

  it.each(['B02019', 'B02019P'] as const)('%s decline shuffles only all five looked cards below the untouched tail', (cardId) => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const c = { ...familyCase('B02019'), cardId };
    const fixture = buildFixture(c);
    const tailTwo = syntheticCard(`QA-${cardId}-TAIL-TWO`, 'character', otherColor(fixture.source.colors[0]!));
    [fixture.source, fixture.matchA, ...fixture.decoys, fixture.tail, fixture.spare, tailTwo].forEach(register);
    install(c, fixture, [
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.decoys[3]!.id,
      tailTwo.id,
    ]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.candidates.some(candidate => candidate.cardId === fixture.matchA.id)).toBe(true);
    resolvePick(pending, null);

    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.hand).not.toContain(fixture.matchA.id);
    expect(current().players.self.deck).toEqual([
      tailTwo.id,
      fixture.tail.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.decoys[3]!.id,
      fixture.matchA.id,
    ]);
  });

  it.each(['B02019', 'B02019P'] as const)('%s no-match keeps off-color events in the exact shuffled remainder below the untouched tail', (cardId) => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const c = { ...familyCase('B02019'), cardId };
    const fixture = buildFixture(c);
    const tailTwo = syntheticCard(`QA-${cardId}-NO-MATCH-TAIL-TWO`, 'character', otherColor(fixture.source.colors[0]!));
    const offColorEvent = syntheticCard(
      `QA-${cardId}-OFF-COLOR-EVENT`,
      'event',
      otherColor(fixture.source.colors[0]!),
    );
    [fixture.source, ...fixture.decoys, fixture.tail, fixture.spare, tailTwo, offColorEvent].forEach(register);
    install(c, fixture, [
      offColorEvent.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.decoys[3]!.id,
      tailTwo.id,
    ]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    expect(pending.candidates).toEqual([]);
    resolvePick(pending, null);

    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.deck).toEqual([
      tailTwo.id,
      fixture.tail.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.decoys[3]!.id,
      offColorEvent.id,
    ]);
  });

  it('round-trips a paused non-first B02019 deck occurrence and its exact resolved deck through ReplayLogV3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const token = beginMatchSession('self');
    const c = familyCase('B02019');
    const fixture = buildFixture(c);
    const tailTwo = syntheticCard('QA-B02019-REPLAY-TAIL-TWO', 'character', otherColor(fixture.source.colors[0]!));
    [fixture.source, fixture.matchA, ...fixture.decoys, fixture.tail, fixture.spare, tailTwo].forEach(register);
    install(c, fixture, [
      fixture.matchA.id,
      fixture.decoys[0]!.id,
      fixture.matchA.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      tailTwo.id,
    ]);
    const initial = structuredClone(current());

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.cardId })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const duplicates = pending.candidates.filter(candidate => candidate.cardId === fixture.matchA.id);
    expect(duplicates.map(candidate => candidate.index)).toEqual([0, 2]);
    const paused = structuredClone(current());
    expect(paused.pendingRuntimeState).toBeDefined();

    resolvePick(pending, duplicates[1]!.uid);
    const resolved = structuredClone(current());
    expect(resolved.players.self.deck).toEqual([
      tailTwo.id,
      fixture.tail.id,
      fixture.decoys[0]!.id,
      fixture.decoys[1]!.id,
      fixture.decoys[2]!.id,
      fixture.matchA.id,
    ]);
    expect(resolved.players.self.hand.filter(cardId => cardId === fixture.matchA.id)).toHaveLength(1);
    expect(resolved.pendingRuntimeState).toBeUndefined();

    expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token })).toEqual({ ok: true });
    const terminalState = structuredClone(current());
    const sessionId = initial.causalLog!.sessionId;
    const replay = buildReplayLogV3({
      artifactId: 'qa-b02019-exact-occurrence',
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, paused, resolved, terminalState],
    });

    expect(replayStateAt(replay, 1).pendingRuntimeState).toEqual(paused.pendingRuntimeState);
    expect(replayStateAt(replay, 2).players.self.deck).toEqual(resolved.players.self.deck);
    expect(replayStateAt(replay, 2).players.self.hand).toEqual(resolved.players.self.hand);
    expect(replayStateAt(replay, 2).pendingRuntimeState).toBeUndefined();
  });
});
