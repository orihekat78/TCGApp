// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md

import { ALL_CARDS } from '@/cards';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

type CardColor = CardDef['colors'][number];
type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;
type Shape = 'standard' | 'fbi' | 'level-seven';

interface FamilyCase {
  eventId: string;
  shape: Shape;
  color: CardColor;
}

interface Fixture {
  event: CardDef;
  acquired: CardDef;
  existing: CardDef;
  wrongCriterion: CardDef;
  highLevel: CardDef;
  invalidKind: CardDef;
  deckDecoys: CardDef[];
  tail: CardDef;
  fileCount: number;
}

const CE = 'ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb';
const D82 = 'd82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305';

const CASES: readonly FamilyCase[] = [
  { eventId: 'B03132', shape: 'standard', color: '黒' },
  { eventId: 'B04013', shape: 'standard', color: '青' },
  { eventId: 'B04026', shape: 'standard', color: '緑' },
  { eventId: 'B04040', shape: 'standard', color: '白' },
  { eventId: 'B04061', shape: 'standard', color: '赤' },
  { eventId: 'B04083', shape: 'standard', color: '黄' },
  { eventId: 'D01014', shape: 'standard', color: '青' },
  { eventId: 'D02014', shape: 'standard', color: '緑' },
  { eventId: 'D03014', shape: 'standard', color: '白' },
  { eventId: 'D04014', shape: 'standard', color: '赤' },
  { eventId: 'D05014', shape: 'standard', color: '黄' },
  { eventId: 'D07023', shape: 'standard', color: '黒' },
  { eventId: 'B05082', shape: 'fbi', color: '赤' },
  { eventId: 'B08060', shape: 'level-seven', color: '赤' },
] as const;

function familyCase(eventId: string): FamilyCase {
  const value = CASES.find(entry => entry.eventId === eventId);
  if (!value) throw new Error(`missing family case: ${eventId}`);
  return value;
}

function actualCard(cardId: string): CardDef {
  const value = ALL_CARDS.find(card => card.id === cardId);
  if (!value) throw new Error(`missing shipped CardDef: ${cardId}`);
  return value;
}

function character(
  id: string,
  color: CardColor,
  level: number,
  traits: string[] = [],
): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: [color],
    level,
    ap: 1000,
    lp: 1,
    traits,
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function eventDecoy(id: string, color: CardColor, level: number, traits: string[] = []): CardDef {
  return {
    id,
    no: id,
    kind: 'event',
    names: [id],
    colors: [color],
    level,
    traits,
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function buildFixture(c: FamilyCase): Fixture {
  const prefix = `QA-${c.eventId}`;
  const otherColor: CardColor = c.color === '赤' ? '青' : '赤';
  const fileCount = c.shape === 'fbi' ? 6 : c.shape === 'level-seven' ? 7 : 2;
  const requiredTraits = c.shape === 'fbi' ? ['FBI'] : [];
  const acquiredLevel = c.shape === 'level-seven' ? 7 : 1;
  const wrongTraits = c.shape === 'fbi' ? ['QA-NOT-FBI'] : requiredTraits;
  const wrongColor = c.shape === 'standard' ? otherColor : c.color;
  const wrongLevel = c.shape === 'level-seven' ? fileCount + 2 : 1;
  const decoyCount = c.shape === 'fbi' ? 4 : c.shape === 'standard' ? 2 : 1;

  return {
    event: actualCard(c.eventId),
    acquired: character(`${prefix}-ACQUIRED`, c.color, acquiredLevel, requiredTraits),
    existing: character(`${prefix}-EXISTING`, c.color, 1, requiredTraits),
    wrongCriterion: character(`${prefix}-WRONG`, wrongColor, wrongLevel, wrongTraits),
    highLevel: character(`${prefix}-HIGH`, c.color, fileCount + 1, requiredTraits),
    invalidKind: eventDecoy(`${prefix}-EVENT`, c.color, 1, requiredTraits),
    deckDecoys: Array.from({ length: decoyCount }, (_, index) =>
      character(`${prefix}-DECOY-${index + 1}`, otherColor, 2, ['QA-DECOY'])),
    tail: character(`${prefix}-TAIL`, otherColor, 2, ['QA-TAIL']),
    fileCount,
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(
  c: FamilyCase,
  fixture: Fixture,
  includeEligible = true,
  includeMatch = true,
): void {
  [
    fixture.event,
    fixture.acquired,
    fixture.existing,
    fixture.wrongCriterion,
    fixture.highLevel,
    fixture.invalidKind,
    ...fixture.deckDecoys,
    fixture.tail,
  ].forEach(register);

  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [c.color];
  state.players.self.file = Array.from(
    { length: fixture.fileCount },
    () => ({ type: 'card-back' as const, cardId: 'FILE' }),
  );
  state.players.self.hand = includeEligible
    ? [fixture.event.id, fixture.existing.id, fixture.wrongCriterion.id, fixture.highLevel.id, fixture.invalidKind.id]
    : [fixture.event.id, fixture.wrongCriterion.id, fixture.highLevel.id, fixture.invalidKind.id];
  state.players.self.deck = c.shape === 'level-seven'
    ? [...fixture.deckDecoys.map(card => card.id), ...(includeMatch ? [fixture.acquired.id] : []), fixture.tail.id]
    : [...(includeMatch ? [fixture.acquired.id] : []), ...fixture.deckDecoys.map(card => card.id), fixture.tail.id];
  startCausalSession(state, `qa-short-deck-${c.eventId}`);
  resetPresentationQueue(`qa-short-deck-${c.eventId}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function resolvePick(pending: PendingPick, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid }))).toEqual({ ok: true });
}

function resolveDeckOrder(): void {
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (!reorder) return;
  expect(dispatchEngineAction(bindPendingDecision(reorder, {
    type: 'deckReorderResolve',
    order: reorder.cardIds,
  }))).toEqual({ ok: true });
}

function driveToSceneEnter(c: FamilyCase, includeEligible = true): { fixture: Fixture; sceneEnter: PendingPick } {
  const fixture = buildFixture(c);
  install(c, fixture, includeEligible);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.eventId })).toEqual({ ok: true });

  if (c.shape === 'level-seven') {
    expect(current().players.self.hand).toContain(fixture.acquired.id);
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard).toMatchObject({ atomVerb: 'discard', nMin: 1, nMax: 1 });
    const spare = discard?.candidates.find(candidate => candidate.cardId === fixture.invalidKind.id);
    expect(spare).toBeDefined();
    resolvePick(discard!, spare!.uid);
  } else {
    const reveal = useGameStateStore.getState().pendingEffectPick;
    expect(reveal).toMatchObject({ atomVerb: 'deckRevealUntil', source: { cardId: c.eventId } });
    const acquired = reveal?.candidates.find(candidate => candidate.cardId === fixture.acquired.id);
    expect(acquired, `${c.eventId} exposes the exact shipped acquisition candidate`).toBeDefined();
    resolvePick(reveal!, acquired!.uid);
    resolveDeckOrder();
  }

  const sceneEnter = useGameStateStore.getState().pendingEffectPick;
  expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: includeEligible ? 1 : 0 });
  return { fixture, sceneEnter: sceneEnter! };
}

function driveToEmptySceneEnter(c: FamilyCase): { fixture: Fixture; sceneEnter: PendingPick } {
  const fixture = buildFixture(c);
  if (c.shape === 'level-seven') fixture.fileCount = 6;
  install(c, fixture, false, c.shape === 'level-seven');
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.eventId })).toEqual({ ok: true });
  if (c.shape === 'level-seven') {
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard).toMatchObject({ atomVerb: 'discard', nMin: 1, nMax: 1 });
    const spare = discard?.candidates.find(candidate => candidate.cardId === fixture.invalidKind.id);
    expect(spare).toBeDefined();
    resolvePick(discard!, spare!.uid);
  } else {
    const reveal = useGameStateStore.getState().pendingEffectPick;
    expect(reveal).toMatchObject({ atomVerb: 'deckRevealUntil', candidates: [], nMin: 0, nMax: 0 });
    resolvePick(reveal!, null);
    resolveDeckOrder();
  }
  const sceneEnter = useGameStateStore.getState().pendingEffectPick;
  expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', candidates: [], nMin: 0, nMax: 0 });
  return { fixture, sceneEnter: sceneEnter! };
}

function declineProof(c: FamilyCase) {
  const { fixture, sceneEnter } = driveToSceneEnter(c);
  const candidateIds = sceneEnter.candidates.map(candidate => candidate.cardId).sort();
  resolvePick(sceneEnter, null);
  const state = current();
  return {
    expectedCandidates: [fixture.acquired.id, fixture.existing.id].sort(),
    candidateIds,
    range: [sceneEnter.nMin, sceneEnter.nMax],
    acquiredInHand: state.players.self.hand.includes(fixture.acquired.id),
    existingInHand: state.players.self.hand.includes(fixture.existing.id),
    scene: state.players.self.scene.map(card => card.cardId),
    eventSpent: state.players.self.remove.includes(c.eventId),
    terminal: useGameStateStore.getState().pendingEffectPick === null
      && useGameStateStore.getState().pendingDeckReorder === null,
  };
}

function existingEntryProof(c: FamilyCase) {
  const { fixture, sceneEnter } = driveToSceneEnter(c);
  const candidateIds = sceneEnter.candidates.map(candidate => candidate.cardId).sort();
  const existing = sceneEnter.candidates.find(candidate => candidate.cardId === fixture.existing.id);
  expect(existing).toBeDefined();
  resolvePick(sceneEnter, existing!.uid);
  const completed = current();
  const completedSnapshot = structuredClone(completed);
  const stale = dispatchEngineAction(bindPendingDecision(sceneEnter, {
    type: 'effectPickResolve',
    pickedUid: existing!.uid,
  }));
  return {
    expectedCandidates: [fixture.acquired.id, fixture.existing.id].sort(),
    candidateIds,
    excluded: [fixture.wrongCriterion.id, fixture.highLevel.id, fixture.invalidKind.id]
      .every(cardId => !candidateIds.includes(cardId)),
    existingInScene: completed.players.self.scene.some(card => card.cardId === fixture.existing.id),
    acquiredInHand: completed.players.self.hand.includes(fixture.acquired.id),
    existingInHand: completed.players.self.hand.includes(fixture.existing.id),
    eventSpent: completed.players.self.remove.includes(c.eventId),
    stale,
    staleStateUnchanged: JSON.stringify(current()) === JSON.stringify(completedSnapshot),
  };
}

function expectDecline(eventId: string) {
  const proof = declineProof(familyCase(eventId));
  expect(proof).toEqual({
    expectedCandidates: proof.expectedCandidates,
    candidateIds: proof.expectedCandidates,
    range: [0, 1],
    acquiredInHand: true,
    existingInHand: true,
    scene: [],
    eventSpent: true,
    terminal: true,
  });
  return proof;
}

function expectExistingEntry(eventId: string) {
  const proof = existingEntryProof(familyCase(eventId));
  expect(proof).toEqual({
    expectedCandidates: proof.expectedCandidates,
    candidateIds: proof.expectedCandidates,
    excluded: true,
    existingInScene: true,
    acquiredInHand: true,
    existingInHand: false,
    eventSpent: true,
    stale: { ok: false, reason: 'not-allowed' },
    staleStateUnchanged: true,
  });
  return proof;
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
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('short-deck reveal families use public decisions for optional hand scene entry', () => {
  // qa: card:B03132:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B03132:${CE}`, () => expect(expectDecline('B03132').scene, 'B03132 optional decline').toEqual([]));
  // qa: card:B04013:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B04013:${CE}`, () => expect(expectDecline('B04013').scene, 'B04013 optional decline').toEqual([]));
  // qa: card:B04026:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B04026:${CE}`, () => expect(expectDecline('B04026').scene, 'B04026 optional decline').toEqual([]));
  // qa: card:B04040:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B04040:${CE}`, () => expect(expectDecline('B04040').scene, 'B04040 optional decline').toEqual([]));
  // qa: card:B04061:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B04061:${CE}`, () => expect(expectDecline('B04061').scene, 'B04061 optional decline').toEqual([]));
  // qa: card:B04083:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B04083:${CE}`, () => expect(expectDecline('B04083').scene, 'B04083 optional decline').toEqual([]));
  // qa: card:B05082:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:B05082:${CE}`, () => expect(expectDecline('B05082').scene, 'B05082 optional decline').toEqual([]));
  // qa: card:D01014:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:D01014:${CE}`, () => expect(expectDecline('D01014').scene, 'D01014 optional decline').toEqual([]));
  // qa: card:D02014:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:D02014:${CE}`, () => expect(expectDecline('D02014').scene, 'D02014 optional decline').toEqual([]));
  // qa: card:D03014:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:D03014:${CE}`, () => expect(expectDecline('D03014').scene, 'D03014 optional decline').toEqual([]));
  // qa: card:D04014:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:D04014:${CE}`, () => expect(expectDecline('D04014').scene, 'D04014 optional decline').toEqual([]));
  // qa: card:D05014:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:D05014:${CE}`, () => expect(expectDecline('D05014').scene, 'D05014 optional decline').toEqual([]));
  // qa: card:D07023:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
  it(`card:D07023:${CE}`, () => expect(expectDecline('D07023').scene, 'D07023 optional decline').toEqual([]));
});

describe('short-deck reveal families enumerate the full eligible hand after acquisition', () => {
  // qa: card:B03132:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B03132:${D82}`, () => expect(expectExistingEntry('B03132').existingInScene, 'B03132 preexisting hand entry').toBe(true));
  // qa: card:B04013:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B04013:${D82}`, () => expect(expectExistingEntry('B04013').existingInScene, 'B04013 preexisting hand entry').toBe(true));
  // qa: card:B04026:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B04026:${D82}`, () => expect(expectExistingEntry('B04026').existingInScene, 'B04026 preexisting hand entry').toBe(true));
  // qa: card:B04040:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B04040:${D82}`, () => expect(expectExistingEntry('B04040').existingInScene, 'B04040 preexisting hand entry').toBe(true));
  // qa: card:B04061:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B04061:${D82}`, () => expect(expectExistingEntry('B04061').existingInScene, 'B04061 preexisting hand entry').toBe(true));
  // qa: card:B04083:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B04083:${D82}`, () => expect(expectExistingEntry('B04083').existingInScene, 'B04083 preexisting hand entry').toBe(true));
  // qa: card:B05082:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B05082:${D82}`, () => expect(expectExistingEntry('B05082').existingInScene, 'B05082 preexisting hand entry').toBe(true));
  // qa: card:B08060:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:B08060:${D82}`, () => expect(expectExistingEntry('B08060').existingInScene, 'B08060 preexisting hand entry').toBe(true));
  // qa: card:D01014:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:D01014:${D82}`, () => expect(expectExistingEntry('D01014').existingInScene, 'D01014 preexisting hand entry').toBe(true));
  // qa: card:D02014:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:D02014:${D82}`, () => expect(expectExistingEntry('D02014').existingInScene, 'D02014 preexisting hand entry').toBe(true));
  // qa: card:D03014:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:D03014:${D82}`, () => expect(expectExistingEntry('D03014').existingInScene, 'D03014 preexisting hand entry').toBe(true));
  // qa: card:D04014:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:D04014:${D82}`, () => expect(expectExistingEntry('D04014').existingInScene, 'D04014 preexisting hand entry').toBe(true));
  // qa: card:D05014:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:D05014:${D82}`, () => expect(expectExistingEntry('D05014').existingInScene, 'D05014 preexisting hand entry').toBe(true));
  // qa: card:D07023:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
  it(`card:D07023:${D82}`, () => expect(expectExistingEntry('D07023').existingInScene, 'D07023 preexisting hand entry').toBe(true));
});

describe('printing aliases and zero-candidate branches preserve the family contract', () => {
  it.each([
    { eventId: 'B03132P', shape: 'standard' as const, color: '黒' as const },
    { eventId: 'B05082P', shape: 'fbi' as const, color: '赤' as const },
    { eventId: 'B08060P', shape: 'level-seven' as const, color: '赤' as const },
  ])('$eventId uses the same public scene-entry contract', (c) => {
    const proof = existingEntryProof(c);
    expect(proof).toMatchObject({ excluded: true, existingInScene: true, acquiredInHand: true, eventSpent: true });
  });

  it.each([
    familyCase('B03132'),
    familyCase('B05082'),
    familyCase('B08060'),
  ])('$eventId surfaces and resolves an explicit empty optional scene entry', (c) => {
    const { fixture, sceneEnter } = driveToEmptySceneEnter(c);
    expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', candidates: [], nMin: 0, nMax: 0 });
    resolvePick(sceneEnter, null);
    expect({
      eventSpent: current().players.self.remove.includes(c.eventId),
      noAcquisitionInHand: !current().players.self.hand.includes(fixture.acquired.id),
      terminal: useGameStateStore.getState().pendingEffectPick === null,
    }).toEqual({
      eventSpent: true,
      noAcquisitionInHand: c.shape !== 'level-seven',
      terminal: true,
    });
  });
});

describe('viewer-safe replay boundary', () => {
  it('removes the live scene-entry continuation and both private hand identities', () => {
    const { fixture, sceneEnter } = driveToSceneEnter(familyCase('B04026'));
    expect(sceneEnter.candidates.map(candidate => candidate.cardId)).toEqual([
      fixture.existing.id,
      fixture.acquired.id,
    ]);

    const projected = projectReplayStateForViewer(current(), 'spectator');
    const serialized = JSON.stringify(projected);
    expect(projected.players.self.hand).toHaveLength(current().players.self.hand.length);
    expect(projected.pendingEffects).toEqual([]);
    expect(projected.pendingRuntimeState).toBeUndefined();
    for (const privateCardId of [fixture.existing.id, fixture.acquired.id]) {
      expect(serialized).not.toContain(privateCardId);
    }
  });
});

function installShortDeck(c: FamilyCase, fixture: Fixture, deck: string[]): void {
  install(c, fixture);
  const state = structuredClone(current());
  state.players.self.deck = [...deck];
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function shortDeckRefreshProof(eventId: string) {
  const c = familyCase(eventId);
  const fixture = buildFixture(c);

  installShortDeck(c, fixture, [fixture.acquired.id]);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: eventId })).toEqual({ ok: true });
  const finalCardPick = useGameStateStore.getState().pendingEffectPick;
  expect(finalCardPick).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1 });
  const finalCard = finalCardPick?.candidates.find(candidate => candidate.cardId === fixture.acquired.id);
  expect(finalCard).toBeDefined();
  const beforeFinalTake = structuredClone(current());
  resolvePick(finalCardPick!, finalCard!.uid);
  const afterFinalTake = structuredClone(current());
  const terminalDecisionsCleared = useGameStateStore.getState().pendingEffectPick === null
    && useGameStateStore.getState().pendingDeckReorder === null;

  installShortDeck(c, fixture, [fixture.acquired.id]);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: eventId })).toEqual({ ok: true });
  const declinePick = useGameStateStore.getState().pendingEffectPick;
  expect(declinePick).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1 });
  resolvePick(declinePick!, null);
  const declineSceneEnter = useGameStateStore.getState().pendingEffectPick;
  expect(declineSceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
  resolvePick(declineSceneEnter!, null);
  const afterDecline = structuredClone(current());
  const declineDecisionsCleared = useGameStateStore.getState().pendingEffectPick === null
    && useGameStateStore.getState().pendingDeckReorder === null
    && afterDecline.pendingRuntimeState === undefined;
  const declinedCopies = [
    ...afterDecline.players.self.deck,
    ...afterDecline.players.self.hand,
    ...afterDecline.players.self.remove,
    ...afterDecline.players.self.scene.map(character => character.cardId),
  ].filter(cardId => cardId === fixture.acquired.id).length;

  installShortDeck(c, fixture, [fixture.acquired.id, fixture.tail.id]);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: eventId })).toEqual({ ok: true });
  const remainderPick = useGameStateStore.getState().pendingEffectPick;
  expect(remainderPick).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1 });
  const remainderReveal = useGameStateStore.getState().pendingDeckReveal;
  expect(remainderReveal).toMatchObject({
    player: 'self',
    revealed: [fixture.acquired.id, fixture.tail.id],
    awaitingPick: true,
    source: { cardId: eventId },
  });
  const selected = remainderPick?.candidates.find(candidate => candidate.cardId === fixture.acquired.id);
  expect(selected).toBeDefined();
  resolvePick(remainderPick!, selected!.uid);
  expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
  const remainderSceneEnter = useGameStateStore.getState().pendingEffectPick;
  expect(remainderSceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
  resolvePick(remainderSceneEnter!, null);
  const afterRemainder = structuredClone(current());

  return {
    lookedCardStayedInDeck: beforeFinalTake.players.self.deck.includes(fixture.acquired.id),
    noEarlyRefresh: beforeFinalTake.refreshCount.self === 0 && beforeFinalTake.gameResult === undefined,
    finalCardEnteredHand: afterFinalTake.players.self.hand.includes(fixture.acquired.id),
    exactExhaustionLost: afterFinalTake.gameResult,
    failedRefreshDidNotIncrement: afterFinalTake.refreshCount.self === 0,
    resolvingEventSettledAfterward: afterFinalTake.players.self.remove.includes(eventId),
    terminalDecisionsCleared,
    declinedCardReturned: afterDecline.players.self.deck.join(',') === fixture.acquired.id,
    declinedCardStayedOutOfHand: !afterDecline.players.self.hand.includes(fixture.acquired.id),
    declinedSceneStayedEmpty: afterDecline.players.self.scene.length === 0,
    declinedEventSettled: afterDecline.players.self.remove.includes(eventId),
    declinedCardConserved: declinedCopies === 1,
    declineDecisionsCleared,
    declineDidNotRefresh: afterDecline.refreshCount.self === 0 && afterDecline.gameResult === undefined,
    lookedAllAvailableCards: remainderReveal?.revealed.join(',') === `${fixture.acquired.id},${fixture.tail.id}`,
    remainderStayedInDeck: afterRemainder.players.self.deck.join(',') === fixture.tail.id,
    selectedCardEnteredHand: afterRemainder.players.self.hand.includes(fixture.acquired.id),
    remainderDidNotRefresh: afterRemainder.refreshCount.self === 0 && afterRemainder.gameResult === undefined,
  };
}

describe('short-deck reveal families refresh only after the selected final card leaves the deck', () => {
  const expected = {
    lookedCardStayedInDeck: true,
    noEarlyRefresh: true,
    finalCardEnteredHand: true,
    exactExhaustionLost: { winner: 'opp', reason: 'deck-out' },
    failedRefreshDidNotIncrement: true,
    resolvingEventSettledAfterward: true,
    terminalDecisionsCleared: true,
    declinedCardReturned: true,
    declinedCardStayedOutOfHand: true,
    declinedSceneStayedEmpty: true,
    declinedEventSettled: true,
    declinedCardConserved: true,
    declineDecisionsCleared: true,
    declineDidNotRefresh: true,
    lookedAllAvailableCards: true,
    remainderStayedInDeck: true,
    selectedCardEnteredHand: true,
    remainderDidNotRefresh: true,
  };

  // qa: card:B04013:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f
  it('card:B04013:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f', () => expect(shortDeckRefreshProof('B04013'), 'B04013 exact short-deck refresh timing').toEqual(expected));
  // qa: card:B04040:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f
  it('card:B04040:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f', () => expect(shortDeckRefreshProof('B04040'), 'B04040 exact short-deck refresh timing').toEqual(expected));
  // qa: card:B04061:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f
  it('card:B04061:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f', () => expect(shortDeckRefreshProof('B04061'), 'B04061 exact short-deck refresh timing').toEqual(expected));
  // qa: card:B04083:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f
  it('card:B04083:dd70a259653892d9d843c9211270cf79c9cb2eda55d5f30527545ebc60abfd6f', () => expect(shortDeckRefreshProof('B04083'), 'B04083 exact short-deck refresh timing').toEqual(expected));
});

describe('short-deck reveal occurrence authority', () => {
  it('rehydrates and resolves the exact non-first B04013 duplicate occurrence', () => {
    const c = familyCase('B04013');
    const fixture = buildFixture(c);
    installShortDeck(c, fixture, [fixture.acquired.id, fixture.tail.id, fixture.acquired.id]);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: c.eventId })).toEqual({ ok: true });
    const before = useGameStateStore.getState().pendingEffectPick!;
    const beforeDuplicates = before.candidates.filter(candidate => candidate.cardId === fixture.acquired.id);
    expect(beforeDuplicates.map(candidate => candidate.index)).toEqual([0, 2]);
    const persisted = JSON.parse(JSON.stringify(current())) as GameState;
    expect(persisted.pendingRuntimeState).toBeDefined();

    useGameStateStore.getState().setPendingEffectPick(null);
    expect(useGameStateStore.getState().setGameState(persisted)).toBe(true);

    const restored = useGameStateStore.getState().pendingEffectPick!;
    const restoredDuplicates = restored.candidates.filter(candidate => candidate.cardId === fixture.acquired.id);
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
    expect(useGameStateStore.getState().pendingDeckReorder?.deckSnapshot).toEqual([
      fixture.acquired.id,
      fixture.tail.id,
    ]);
    resolveDeckOrder();
    const sceneEnter = useGameStateStore.getState().pendingEffectPick;
    expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    resolvePick(sceneEnter!, null);
    expect({
      handCopies: current().players.self.hand.filter(cardId => cardId === fixture.acquired.id).length,
      exactRemainder: current().players.self.deck,
      terminal: useGameStateStore.getState().pendingEffectPick === null
        && useGameStateStore.getState().pendingDeckReorder === null,
    }).toEqual({
      handCopies: 1,
      exactRemainder: [fixture.acquired.id, fixture.tail.id],
      terminal: true,
    });
  });
});
