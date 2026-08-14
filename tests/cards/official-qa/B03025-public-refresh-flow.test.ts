// qa: card:B03025:51de3c143838c348f32a12d2252063f7ac6b6d884ab75fc3ef24a003df5b1731
// qa: card:B03025:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03025:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305
// qa: card:B03025:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb
// rules: 14-refresh.md, 15-abilities-effects.md, 20-color-and-switch.md

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B03025 } from '@/cards/ct-p03/B03025';
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
import { useGameStateStore } from '@/ui/state/store';

const QA = {
  refresh: 'card:B03025:51de3c143838c348f32a12d2252063f7ac6b6d884ab75fc3ef24a003df5b1731',
  optionalLook: 'card:B03025:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d',
  enterCandidates: 'card:B03025:d82d0d2102f29b6e0ec961b92961305d036df8c10b3e1ca6a71a4cf9f3468305',
  enterDecline: 'card:B03025:ce592c4136be08596058c1648662c8f0cf7cb6e8cec32f9b4d83ce28f59a22fb',
} as const;

function sourceTrait(): string {
  const effect = B03025.abilities[0]!.effect as {
    steps: Array<{ args?: { filter?: { trait?: string } } }>;
  };
  const trait = effect.steps[0]?.args?.filter?.trait;
  if (!trait) throw new Error('B03025 deck-look trait missing');
  return trait;
}

const TARGET_TRAIT = sourceTrait();
const OTHER_TRAIT = 'QA-B03025-OTHER-TRAIT';

function character(id: string, options: { traits?: string[]; level?: number } = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: [...B03025.colors],
    level: options.level ?? 1,
    ap: 1000,
    lp: 1,
    traits: options.traits ?? [TARGET_TRAIT],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function eventDecoy(id: string): CardDef {
  return {
    id,
    no: id,
    kind: 'event',
    names: [id],
    colors: [...B03025.colors],
    level: 1,
    traits: [TARGET_TRAIT],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const MATCH_A = character('QA-B03025-MATCH-A');
const MATCH_B = character('QA-B03025-MATCH-B');
const PREEXISTING_A = character('QA-B03025-PREEXISTING-A');
const INVALID_TRAIT = character('QA-B03025-INVALID-TRAIT', { traits: [OTHER_TRAIT] });
const INVALID_LEVEL = character('QA-B03025-INVALID-LEVEL', { level: 7 });
const INVALID_KIND = eventDecoy('QA-B03025-INVALID-KIND');
const DECOY_1 = character('QA-B03025-DECOY-1', { traits: [OTHER_TRAIT] });
const DECOY_2 = character('QA-B03025-DECOY-2', { traits: [OTHER_TRAIT] });
const DECOY_3 = character('QA-B03025-DECOY-3', { traits: [OTHER_TRAIT] });
const DECOY_4 = character('QA-B03025-DECOY-4', { traits: [OTHER_TRAIT] });
const DECOY_5 = character('QA-B03025-DECOY-5', { traits: [OTHER_TRAIT] });
const DECOY_6 = character('QA-B03025-DECOY-6', { traits: [OTHER_TRAIT] });

function install(deck: string[], hand: string[] = [B03025.id]): void {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...B03025.colors];
  state.players.self.file = Array.from(
    { length: B03025.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: 'FILE' }),
  );
  state.players.self.hand = hand;
  state.players.self.deck = deck;
  startCausalSession(state, 'qa-b03025-public-refresh-flow');
  resetPresentationQueue('qa-b03025-public-refresh-flow');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function useB03025() {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03025.id })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1, source: { cardId: B03025.id } });
  return pending!;
}

function resolvePick(pending: NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>, pickedUid: string | null): void {
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid }))).toEqual({ ok: true });
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  [
    B03025, MATCH_A, MATCH_B, PREEXISTING_A, INVALID_TRAIT, INVALID_LEVEL, INVALID_KIND,
    DECOY_1, DECOY_2, DECOY_3, DECOY_4, DECOY_5, DECOY_6,
  ].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B03025 official-QA public refresh flow', () => {
  it(`${QA.refresh}: a five-card look waits for residual removal before one refresh, while a sixth card prevents it`, () => {
    install([MATCH_A.id, DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id]);
    const fiveCardPick = useB03025();
    expect(fiveCardPick.candidates.map(candidate => candidate.cardId)).toEqual([MATCH_A.id]);
    expect(current().refreshCount.self).toBe(0);

    resolvePick(fiveCardPick, fiveCardPick.candidates[0]!.uid);
    const sceneEnter = useGameStateStore.getState().pendingEffectPick;
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.self.deck.slice().sort()).toEqual([DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id].sort());
    expect(current().players.self.deck).not.toContain(B03025.id);
    expect(current().players.self.remove).toContain(B03025.id);
    expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    expect(sceneEnter?.candidates.map(candidate => candidate.cardId)).toEqual([MATCH_A.id]);

    install([MATCH_A.id, DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id, DECOY_5.id]);
    const sixCardPick = useB03025();
    resolvePick(sixCardPick, sixCardPick.candidates[0]!.uid);
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.self.deck).toEqual([DECOY_5.id]);
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('sceneEnter');
  });

  it(`${QA.optionalLook}: supports an up-to-one non-leading match, null, zero matches, and never surfaces decoys`, () => {
    install([DECOY_1.id, INVALID_KIND.id, MATCH_B.id, DECOY_3.id, DECOY_4.id, DECOY_5.id]);
    const nonLeading = useB03025();
    expect(nonLeading.candidates.map(candidate => candidate.cardId)).toEqual([MATCH_B.id]);
    resolvePick(nonLeading, nonLeading.candidates[0]!.uid);
    expect(current().players.self.hand).toContain(MATCH_B.id);
    expect(current().players.self.hand).not.toContain(DECOY_1.id);

    install([MATCH_A.id, DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id, DECOY_5.id]);
    const optional = useB03025();
    resolvePick(optional, null);
    expect(current().players.self.hand).not.toContain(MATCH_A.id);
    expect(current().players.self.deck).toEqual([DECOY_5.id]);

    install([DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id, DECOY_5.id, DECOY_6.id]);
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B03025.id })).toEqual({ ok: true });
    const zeroEligible = useGameStateStore.getState().pendingEffectPick!;
    expect(zeroEligible).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 0 });
    expect(zeroEligible.candidates).toEqual([]);
    resolvePick(zeroEligible, null);
    const emptySceneEnter = useGameStateStore.getState().pendingEffectPick!;
    expect(emptySceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 0 });
    expect(emptySceneEnter.candidates).toEqual([]);
    resolvePick(emptySceneEnter, null);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.hand).not.toContain(DECOY_1.id);
    expect(current().players.self.deck).toEqual([DECOY_6.id]);
  });

  it(`${QA.enterCandidates}: scene entry offers every eligible hand character, including the new acquisition, but excludes trait and level decoys`, () => {
    install(
      [MATCH_B.id, DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id, DECOY_5.id],
      [B03025.id, PREEXISTING_A.id, INVALID_TRAIT.id, INVALID_LEVEL.id, INVALID_KIND.id],
    );
    const reveal = useB03025();
    resolvePick(reveal, reveal.candidates.find(candidate => candidate.cardId === MATCH_B.id)!.uid);

    const sceneEnter = useGameStateStore.getState().pendingEffectPick!;
    expect(sceneEnter).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    expect(sceneEnter.candidates.map(candidate => candidate.cardId).sort()).toEqual([MATCH_B.id, PREEXISTING_A.id].sort());
    const existing = sceneEnter.candidates.find(candidate => candidate.cardId === PREEXISTING_A.id)!;
    resolvePick(sceneEnter, existing.uid);
    expect(current().players.self.scene.map(card => card.cardId)).toContain(PREEXISTING_A.id);
    expect(current().players.self.hand).toContain(MATCH_B.id);
    expect(current().players.self.hand).toContain(INVALID_TRAIT.id);
    expect(current().players.self.hand).toContain(INVALID_LEVEL.id);
    expect(current().players.self.hand).toContain(INVALID_KIND.id);
  });

  it(`${QA.enterDecline}: declining an optional scene entry keeps the acquired card in hand, clears the pending decision, and leaves the event removed`, () => {
    install([MATCH_A.id, DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id, DECOY_5.id]);
    const reveal = useB03025();
    resolvePick(reveal, reveal.candidates[0]!.uid);
    const decline = useGameStateStore.getState().pendingEffectPick!;
    expect(decline).toMatchObject({ atomVerb: 'sceneEnter', nMin: 0, nMax: 1 });
    resolvePick(decline, null);
    expect(current().players.self.hand).toContain(MATCH_A.id);
    expect(current().players.self.scene).toEqual([]);
    expect(current().players.self.remove).toContain(B03025.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    install([MATCH_A.id, DECOY_1.id, DECOY_2.id, DECOY_3.id, DECOY_4.id, DECOY_5.id]);
    const positiveReveal = useB03025();
    resolvePick(positiveReveal, positiveReveal.candidates[0]!.uid);
    const positiveEnter = useGameStateStore.getState().pendingEffectPick!;
    resolvePick(positiveEnter, positiveEnter.candidates[0]!.uid);
    expect(current().players.self.scene.map(card => card.cardId)).toEqual([MATCH_A.id]);
    expect(current().players.self.hand).not.toContain(MATCH_A.id);
  });
});
