import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingDeckReorderSide } from '@/engine/effect/atom-handlers';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register, _resetRegistry, def } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';

type FlowSummary = {
  acquiredMatch: boolean;
  cardConserved: boolean;
  deck: string[];
  decisionsCleared: boolean;
  eventSpent: boolean;
  handTargetDeclined: boolean;
  noRefresh: boolean;
  reorderCardIds: string[];
  revealCandidateIds: string[];
  revealSelectionRange: [number, number];
  scene: string[];
};

type DecisionSummary = Pick<FlowSummary, 'reorderCardIds' | 'revealCandidateIds' | 'revealSelectionRange'>;

function character(id: string, colors: string[]): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors,
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

function nonMatchingColors(colors: string[]): string[] {
  const color = ['赤', '青', '緑', '黄', '黒', '白'].find((candidate) => !colors.includes(candidate));
  if (!color) throw new Error(`could not build non-matching color fixture for: ${colors.join(',')}`);
  return [color];
}

function reset(): void {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  _drainPendingDeckReorderSide();
  (globalThis as { __humanPlayerSide?: 'self' | null }).__humanPlayerSide = 'self';
  registerAll();
  registerTriggeredListener();
}

function cardCount(state: GameState): number {
  const self = state.players.self;
  return self.hand.length + self.deck.length + self.remove.length + self.scene.length;
}

function start(eventCardId: string, deck: string[], deckMatchesReveal = true): { state: GameState; handTarget: string } {
  const eventCard = def.card(eventCardId);
  if (!eventCard) throw new Error(`missing card definition: ${eventCardId}`);

  const handTarget = `${eventCardId}-HAND`;
  const deckColors = deckMatchesReveal ? eventCard.colors : nonMatchingColors(eventCard.colors);
  for (const cardId of deck) register(character(cardId, deckColors));
  register(character(handTarget, eventCard.colors));

  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = eventCard.colors;
  state.players.self.file = [{ type: 'card-back' }, { type: 'card-back' }];
  state.players.self.hand = [eventCardId, handTarget];
  state.players.self.deck = deck;

  handUseCard(state, 'self', eventCardId);
  runAllUntilEmpty(state);
  return { state, handTarget };
}

function finishByDecliningSceneEnter(state: GameState, selectedCardId?: string): DecisionSummary {
  const reveal = _drainPendingEffectPickSide();
  expect(reveal?.atomVerb).toBe('deckRevealUntil');
  const revealCandidateIds = reveal!.candidates.map((candidate) => candidate.cardId);
  const revealSelectionRange: [number, number] = [reveal!.nMin, reveal!.nMax];
  if (selectedCardId) {
    const selected = reveal?.candidates.find((candidate) => candidate.cardId === selectedCardId);
    expect(selected).toBeDefined();
    applyPickAndContinuation(state, reveal!, selected!.uid ?? selected!.cardId);
  } else {
    applyPickSkipAndContinuation(state, reveal!, true);
  }
  runAllUntilEmpty(state);

  const reorder = _drainPendingDeckReorderSide();
  const reorderCardIds = reorder?.cardIds ?? [];
  if (reorder) {
    applyDeckReorderAndContinuation(state, reorder, [...reorder.cardIds].reverse());
    runAllUntilEmpty(state);
  }

  const sceneEnter = _drainPendingEffectPickSide();
  expect(sceneEnter?.atomVerb).toBe('sceneEnter');
  applyPickSkipAndContinuation(state, sceneEnter!, false);
  runAllUntilEmpty(state);
  return { reorderCardIds, revealCandidateIds, revealSelectionRange };
}

function summary(state: GameState, eventCardId: string, handTarget: string, decisions: DecisionSummary, matchCardId?: string): FlowSummary {
  const pendingPick = _drainPendingEffectPickSide();
  const pendingReorder = _drainPendingDeckReorderSide();
  return {
    acquiredMatch: matchCardId ? state.players.self.hand.includes(matchCardId) : false,
    cardConserved: cardCount(state) === 4,
    deck: state.players.self.deck,
    decisionsCleared: pendingPick === null && pendingReorder === null,
    eventSpent: state.players.self.remove.includes(eventCardId),
    handTargetDeclined: state.players.self.hand.includes(handTarget),
    noRefresh: state.refreshCount.self === 0,
    ...decisions,
    scene: state.players.self.scene.map((card) => card.cardId),
  };
}

function runEligibleMatchSkippedShortDeckFlow(eventCardId: string): FlowSummary {
  const remainder = `${eventCardId}-REMAINDER`;
  const match = `${eventCardId}-MATCH`;
  const { state, handTarget } = start(eventCardId, [remainder, match]);
  const decisions = finishByDecliningSceneEnter(state);
  return summary(state, eventCardId, handTarget, decisions, match);
}

function runNoMatchShortDeckFlow(eventCardId: string): FlowSummary {
  const first = `${eventCardId}-NO-MATCH-1`;
  const second = `${eventCardId}-NO-MATCH-2`;
  const { state, handTarget } = start(eventCardId, [first, second], false);
  const decisions = finishByDecliningSceneEnter(state);
  return summary(state, eventCardId, handTarget, decisions);
}

beforeEach(reset);

const matchedShortDeckRevealCards = [
  'B03132', 'B04013', 'B04026', 'B04040', 'B04061', 'B04083',
  'D01014', 'D02014', 'D03014', 'D05014', 'D07023',
] as const;

describe('common short-deck reveal event public flow', () => {
  it.each(matchedShortDeckRevealCards)('%s skips an eligible match, bottoms every revealed card, and declines scene enter', (eventCardId) => {
    expect(runEligibleMatchSkippedShortDeckFlow(eventCardId)).toEqual({
      acquiredMatch: false, cardConserved: true, deck: [`${eventCardId}-MATCH`, `${eventCardId}-REMAINDER`], decisionsCleared: true,
      eventSpent: true, handTargetDeclined: true, noRefresh: true, scene: [],
      reorderCardIds: [`${eventCardId}-REMAINDER`, `${eventCardId}-MATCH`], revealCandidateIds: [`${eventCardId}-REMAINDER`, `${eventCardId}-MATCH`], revealSelectionRange: [0, 1],
    });
  });

  const noMatchShortDeckRevealCards = [
    'B03132', 'B04013', 'B04026', 'B04040', 'B04061', 'B04083',
    'D01014', 'D02014', 'D03014', 'D05014', 'D07023',
  ] as const;

  it.each(noMatchShortDeckRevealCards)('%s resolves a two-card no-match deck without refresh or stale decisions', (eventCardId) => {
    expect(runNoMatchShortDeckFlow(eventCardId)).toEqual({
      acquiredMatch: false, cardConserved: true, deck: [`${eventCardId}-NO-MATCH-2`, `${eventCardId}-NO-MATCH-1`], decisionsCleared: true,
      eventSpent: true, handTargetDeclined: true, noRefresh: true, scene: [],
      reorderCardIds: [`${eventCardId}-NO-MATCH-1`, `${eventCardId}-NO-MATCH-2`], revealCandidateIds: [], revealSelectionRange: [0, 0],
    });
  });
});
