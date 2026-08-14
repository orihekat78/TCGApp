// qa: card:B04012:633f9760add3d888abf4d567f7e31ef389cb534d862dd3b498f4422090bc6cb4
// qa: card:B04024:633f9760add3d888abf4d567f7e31ef389cb534d862dd3b498f4422090bc6cb4
// qa: card:B05057:633f9760add3d888abf4d567f7e31ef389cb534d862dd3b498f4422090bc6cb4
// qa: card:B05060:633f9760add3d888abf4d567f7e31ef389cb534d862dd3b498f4422090bc6cb4
// qa: card:PR194:633f9760add3d888abf4d567f7e31ef389cb534d862dd3b498f4422090bc6cb4
// Deck look keeps the card in deck until an acquisition resolves (rules/14, 21, 26).

import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04012 } from '@/cards/ct-p04/B04012';
import { B04024 } from '@/cards/ct-p04/B04024';
import { B05057 } from '@/cards/ct-p05/B05057';
import { B05060 } from '@/cards/ct-p05/B05060';
import { B01013 } from '@/cards/ct-p01/B01013';
import { PR194 } from '@/cards/pr-01/PR194';
import { event } from '@/engine/event';
import { isCausalLogEntry, startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry as resetDefRegistry, def as readDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, CausalLogEntryV1, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { projectPublicCausalLogEntry } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { makeChar } from '../../helpers/fixtures';

type OptionalSource = typeof B04012 | typeof B04024 | typeof B05057 | typeof B05060;

const OPTIONAL_SOURCES: readonly OptionalSource[] = [B04012, B04024, B05057, B05060];
const DECOY = PR194;
type Player = 'self' | 'opp';

function startSession(state: GameState, id: string): void {
  startCausalSession(state, id);
  resetPresentationQueue(id);
}

function install(state: GameState): void {
  useGameStateStore.setState({
    gameState: state,
    activeActionId: null,
    pendingEffectPick: null,
    pendingEffectChoice: null,
    pendingEffectOptional: null,
    pendingDeckReveal: null,
  });
}

function revealTraits(source: OptionalSource): string[] {
  const reveal = source.abilities[0]!.effect as {
    kind: 'sequence'; steps: Array<{ args?: { filter?: { trait?: string | string[] } } }>;
  };
  const traits = reveal.steps[0]!.args!.filter!.trait!;
  return Array.isArray(traits) ? traits : [traits];
}

function targetFor(source: OptionalSource, trait = revealTraits(source)[0]!): CardDef {
  if (source.id === B04012.id) {
    return readDef.byTrait(B04012.traits[1]!).find(card => card.kind === 'character' && card.id !== source.id)!;
  }
  return readDef.byTrait(trait).find(card => card.kind === 'character' && card.id !== source.id)!;
}

function entryState(source: OptionalSource, deck: string[], owner: Player = 'self', remove: string[] = [source.id]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = [...source.colors];
  state.players[owner].file = Array.from({ length: source.level ?? 0 }, () => ({ type: 'card-back', cardId: 'FILE' }));
  state.players[owner].hand = [source.id];
  state.players[owner].deck = deck;
  state.players[owner].remove = remove;
  startSession(state, `qa-wave8-${source.id}-${owner}`);
  return state;
}

function deploy(source: OptionalSource, deck: string[], owner: Player = 'self', remove: string[] = [source.id]): NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']> {
  install(entryState(source, deck, owner, remove));
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id })).toEqual({ ok: true });
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.atomVerb).toBe('deckRevealUntil');
  return pick!;
}

function causal(state: GameState): CausalLogEntryV1[] {
  return state.log.filter(isCausalLogEntry).map(entry => projectPublicCausalLogEntry(state, entry));
}

function expectRefreshCausalOrder(state: GameState, hiddenCardId: string): void {
  const entries = causal(state);
  const select = entries.findIndex(entry => entry.kind === 'select');
  const deckToHand = entries.findIndex(entry => entry.kind === 'zone-move'
    && entry.outcome.type === 'move' && entry.outcome.from === 'deck' && entry.outcome.to === 'hand');
  const refresh = entries.findIndex(entry => entry.tags?.includes('refresh'));
  const summary = entries.findIndex((entry, index) => index > refresh && entry.kind === 'summary');
  expect(select).toBeGreaterThanOrEqual(0);
  expect(deckToHand).toBeGreaterThan(select);
  expect(refresh).toBeGreaterThan(deckToHand);
  expect(summary, `public causal order: ${JSON.stringify(entries)}`).toBeGreaterThan(refresh);
  expect(JSON.stringify(entries)).not.toContain(hiddenCardId);
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.setState({ gameState: null, activeActionId: null, pendingEffectPick: null, pendingEffectChoice: null, pendingEffectOptional: null, pendingDeckReveal: null });
});

describe('official QA deck refresh: optional entry look', () => {
  it.each(OPTIONAL_SOURCES)('$id looks at two cards, surfaces only the eligible card, and can acquire it without refresh', source => {
    const target = targetFor(source);
    const pick = deploy(source, [target.id, DECOY.id], 'self', []);
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([target.id]);
    expect(pick.candidates.map(candidate => candidate.cardId)).not.toContain(DECOY.id);
    expect(pick.nMin).toBe(0);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid })).toEqual({ ok: true });
    const state = useGameStateStore.getState().gameState!;
    expect(state.players.self.hand).toContain(target.id);
    expect(state.players.self.deck).toEqual([DECOY.id]);
    expect(state.players.self.remove).toEqual([]);
    expect(state.refreshCount.self).toBe(0);
    expect(state.gameResult).toBeUndefined();
  });

  it.each(OPTIONAL_SOURCES)('$id pick: deck to hand, then refreshes the remove seed once', source => {
    const target = targetFor(source);
    const pick = deploy(source, [target.id]);
    const chosen = pick.candidates.find(candidate => candidate.cardId === target.id)!;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: chosen.uid })).toEqual({ ok: true });
    const state = useGameStateStore.getState().gameState!;
    expect(state.players.self.hand).toContain(target.id);
    expect(state.players.self.deck).toEqual([source.id]);
    expect(state.players.self.remove).toEqual([]);
    expect(state.refreshCount.self).toBe(1);
    expect(state.players.opp.evidence).toHaveLength(1);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expectRefreshCausalOrder(state, target.id);
  });

  it.each(OPTIONAL_SOURCES)('$id decline keeps deck and remove seed intact without refresh', source => {
    const target = targetFor(source);
    deploy(source, [target.id, DECOY.id]);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toEqual({ ok: true });
    const state = useGameStateStore.getState().gameState!;
    expect(state.players.self.hand).not.toContain(target.id);
    expect(state.players.self.deck).toHaveLength(2);
    expect(state.players.self.deck).toEqual(expect.arrayContaining([target.id, DECOY.id]));
    expect(state.players.self.remove).toEqual([source.id]);
    expect(state.refreshCount.self).toBe(0);
    expect(state.players.opp.evidence).toHaveLength(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('B04024 acquiring the last looked card with an empty remove area deck-outs immediately', () => {
    const target = targetFor(B04024);
    const pick = deploy(B04024, [target.id], 'self', []);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid })).toEqual({ ok: true });
    const state = useGameStateStore.getState().gameState!;
    expect(state.players.self.hand).toContain(target.id);
    expect(state.players.self.deck).toEqual([]);
    expect(state.players.self.remove).toEqual([]);
    expect(state.refreshCount.self).toBe(0);
    expect(state.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
  });

  it('B04012 accepts its card-name branch with an asymmetric eligible-and-decoy look', () => {
    const pick = deploy(B04012, [B01013.id, DECOY.id], 'self', []);
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([B01013.id]);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(B01013.id);
  });

  it('B05060 accepts the alternate magician branch, not only the first trait branch', () => {
    const alternate = targetFor(B05060, revealTraits(B05060)[1]!);
    const pick = deploy(B05060, [alternate.id, DECOY.id], 'self', []);
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([alternate.id]);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid })).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState!.players.self.hand).toContain(alternate.id);
  });

  it('CPU opponent refreshes only its own deck, keeps its private look off the human surface, and redacts it causally', () => {
    const target = targetFor(B04024);
    const state = entryState(B04024, [target.id], 'opp', [B05057.id]);
    state.players.self.deck = [B04012.id];
    install(state);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'opp', cardId: B04024.id })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.hand).toContain(target.id);
    expect(after.refreshCount.opp).toBe(1);
    expect(after.players.self.deck).toEqual([B04012.id]);
    expect(after.refreshCount.self).toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(JSON.stringify(causal(after))).not.toContain(target.id);
  });
});

describe('official QA deck refresh: PR194 declared ability', () => {
  it('two eligible cards require an exact-one public choice; null rejects unchanged and the selected non-first card is acquired', () => {
    const first = B04012;
    const second = B04024;
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [makeChar({ uid: 'pr194-scene', cardId: PR194.id, state: 'active' })];
    state.players.self.deck = [first.id, second.id];
    startSession(state, 'qa-wave8-pr194');
    install(state);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pr194-scene', abilId: 'a1' })).toEqual({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.atomVerb).toBe('handAddFromDeck');
    expect(pick?.nMin).toBe(1);
    expect(pick?.nMax).toBe(1);
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([first.id, second.id]);
    const beforeNull = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState!));
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toMatchObject({ ok: false });
    expect(useGameStateStore.getState().gameState).toEqual(beforeNull);

    const runtimeRoundTrip = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState!)) as GameState;
    expect(useGameStateStore.getState().setGameState(runtimeRoundTrip)).toBe(true);
    const restoredPick = useGameStateStore.getState().pendingEffectPick!;
    expect(restoredPick.atomVerb).toBe('handAddFromDeck');
    expect(restoredPick.candidates.map(candidate => candidate.cardId)).toEqual([first.id, second.id]);
    const chosen = restoredPick.candidates.find(candidate => candidate.cardId === second.id)!;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: chosen.uid })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toEqual([]);
    expect(after.players.self.hand).toContain(second.id);
    expect(after.players.self.hand).not.toContain(first.id);
    expect(after.players.self.deck).toEqual([first.id]);
    expect(after.players.self.remove).toEqual([PR194.id]);
    expect(after.refreshCount.self).toBe(0);
    expect(after.players.opp.evidence).toHaveLength(0);
    expect(JSON.stringify(causal(after))).not.toContain(second.id);
  });

  it('one-card look acquires the card, then refreshes the declared-cost card', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [makeChar({ uid: 'pr194-refresh', cardId: PR194.id, state: 'active' })];
    state.players.self.deck = [B04012.id];
    startSession(state, 'qa-wave8-pr194-refresh');
    install(state);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pr194-refresh', abilId: 'a1' })).toEqual({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand).toContain(B04012.id);
    expect(after.players.self.deck).toEqual([PR194.id]);
    expect(after.players.self.remove).toEqual([]);
    expect(after.refreshCount.self).toBe(1);
    expect(after.players.opp.evidence).toHaveLength(1);
    expectRefreshCausalOrder(after, B04012.id);
  });

  it('an empty deck yields no look choice, then refreshes the declared-cost card without deck-out', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [makeChar({ uid: 'pr194-deck-zero', cardId: PR194.id, state: 'active' })];
    startSession(state, 'qa-wave8-pr194-deck-zero');
    install(state);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pr194-deck-zero', abilId: 'a1' })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.deck).toEqual([PR194.id]);
    expect(after.players.self.remove).toEqual([]);
    expect(after.refreshCount.self).toBe(1);
    expect(after.players.opp.evidence).toHaveLength(1);
    expect(after.gameResult).toBeUndefined();
  });

  it('CPU opponent owns its exact-one choice and keeps the private look redacted', () => {
    const first = B04012;
    const second = B04024;
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [makeChar({ uid: 'pr194-cpu', cardId: PR194.id, state: 'active' })];
    state.players.opp.deck = [first.id, second.id];
    state.players.self.deck = [B05057.id];
    startSession(state, 'qa-wave8-pr194-cpu');
    install(state);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'pr194-cpu', abilId: 'a1' })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    const acquired = [first.id, second.id].filter(cardId => after.players.opp.hand.includes(cardId));
    expect(acquired).toHaveLength(1);
    expect([first.id, second.id].filter(cardId => after.players.opp.deck.includes(cardId))).toHaveLength(1);
    expect(after.players.opp.remove).toEqual([PR194.id]);
    expect(after.players.self.deck).toEqual([B05057.id]);
    expect(after.refreshCount.opp).toBe(0);
    expect(after.refreshCount.self).toBe(0);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
    expect(JSON.stringify(causal(after))).not.toContain(first.id);
    expect(JSON.stringify(causal(after))).not.toContain(second.id);
  });
});
