// qa: card:B07066:939f5e30d9e32c8b233a160a6f70ebb932c71ce0971e6f66cfb3701d5fff76cd
// qa: card:B07066:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B07066:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B07066 } from '@/cards/ct-p07/B07066';
import { B07066P } from '@/cards/ct-p07/B07066P';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { makeChar } from '../../helpers/fixtures';

const COST_QA = 'card:B07066:939f5e30d9e32c8b233a160a6f70ebb932c71ce0971e6f66cfb3701d5fff76cd';
const OPTIONAL_QA = 'card:B07066:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf';
const AKAI = 'B07066_QA_AKAI';
const MATCH = 'B07066_QA_MATCH';
const WRONG = 'B07066_QA_WRONG';
const HAND_REMOVE = 'B07066_QA_HAND_REMOVE';
const REFRESH = 'B07066_QA_REFRESH';
const OPP_DECK = 'B07066_QA_OPP_DECK';

function card(id: string, options: {
  kind?: 'character' | 'event';
  traits?: string[];
  level?: number;
  ap?: number;
} = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: [...B07066.colors],
    level: kind === 'character' ? (options.level ?? 1) : 0,
    ap: kind === 'character' ? (options.ap ?? 1000) : 0,
    lp: kind === 'character' ? 1 : 0,
    traits: options.traits ?? [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function baseState(sourceState: 'active' | 'sleep' = 'active'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [makeChar({ uid: 'source', cardId: B07066.id, state: sourceState })];
  state.players.self.hand = [HAND_REMOVE];
  state.players.self.deck = [WRONG];
  return state;
}

function install(state: GameState): void {
  resetPresentationQueue('qa-b07066-declared');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function activate(costUid = 'source'): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'source',
    abilId: 'a2',
    costParams: { sleepChar: { uids: [costUid] } },
  });
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  register(B07066);
  register(B07066P);
  register(card(AKAI, { traits: ['赤井家'], level: 7 }));
  register(card(MATCH, { traits: ['赤井家'], level: 4 }));
  register(card(WRONG, { traits: ['探偵'], level: 4 }));
  register(card(HAND_REMOVE, { kind: 'event' }));
  register(card(REFRESH));
  register(card(OPP_DECK));
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B07066 declared ability official Q&A', () => {
  it(`${COST_QA}: pays the sleep cost with an active own Akai-family character, never the opponent copy`, () => {
    const state = baseState('sleep');
    state.players.self.scene.push(makeChar({ uid: 'own-cost', cardId: AKAI, state: 'active' }));
    state.players.opp.scene.push(makeChar({ uid: 'opp-cost', cardId: AKAI, state: 'active' }));
    install(state);

    expect(activate('own-cost')).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find(entry => entry.uid === 'own-cost')?.state).toBe('sleep');
    expect(after.players.opp.scene.find(entry => entry.uid === 'opp-cost')?.state).toBe('active');
  });

  it(`${COST_QA}: rejects an opponent-only cost payer without changing either scene`, () => {
    const state = baseState('sleep');
    state.players.opp.scene.push(makeChar({ uid: 'opp-only', cardId: AKAI, state: 'active' }));
    install(state);
    const before = structuredClone(state);

    expect(activate('opp-only')).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(before);
  });

  it(`${OPTIONAL_QA}: exposes an eligible match as an up-to-one public choice and permits declining it`, () => {
    const state = baseState();
    state.players.self.deck = [MATCH];
    install(state);

    expect(activate()).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({ atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1 });
    expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([MATCH]);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toEqual({ ok: true });

    const current = useGameStateStore.getState();
    expect(current.gameState?.players.self.hand).toEqual([HAND_REMOVE]);
    expect(current.gameState?.players.self.remove).toEqual([]);
    expect(current.gameState?.players.self.deck).toEqual([MATCH]);
    expect(current.pendingEffectPick).toBeNull();
  });

  it(`${OPTIONAL_QA}: rejects a forged pick, then takes the eligible card and performs the conditional discard`, () => {
    const state = baseState();
    state.players.self.deck = [MATCH, WRONG];
    install(state);

    expect(activate()).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const beforeForged = structuredClone(useGameStateStore.getState().gameState!);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'forged' })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(beforeForged);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pending.decisionId);

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pending.candidates[0]!.uid })).toEqual({ ok: true });
    const discard = useGameStateStore.getState().pendingEffectPick;
    expect(discard).toMatchObject({ atomVerb: 'discard', nMin: 1, nMax: 1 });
    const handSeed = discard!.candidates.find(candidate => candidate.cardId === HAND_REMOVE)!;
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: handSeed.uid })).toEqual({ ok: true });

    const current = useGameStateStore.getState();
    expect(current.gameState?.players.self.hand).toEqual([MATCH]);
    expect(current.gameState?.players.self.remove).toContain(HAND_REMOVE);
    expect(current.pendingEffectPick).toBeNull();
  });

  it('card:B07066:f8f6cc8737bb07a4334459a640a7b7600477d7bfa26bba8ca760517a6601ca7f: refreshes after selecting the sole card for both printings', () => {
    const proven: string[] = [];
    for (const sourceId of [B07066.id, B07066P.id]) {
      useGameStateStore.getState().resetMatchSessionState();
      const state = createEmptyGameState();
      state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      state.players.self.scene = [makeChar({ uid: 'source', cardId: sourceId, state: 'active' })];
      state.players.self.hand = [HAND_REMOVE];
      state.players.self.deck = [MATCH];
      state.players.self.remove = [REFRESH];
      state.players.opp.deck = [OPP_DECK];
      install(state);

      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'source', abilId: 'a2',
        costParams: { sleepChar: { uids: ['source'] } },
      })).toEqual({ ok: true });
      const pick = useGameStateStore.getState().pendingEffectPick;
      expect(pick).toMatchObject({
        atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1,
        source: { cardId: sourceId, abilityId: 'a2', uid: 'source', area: 'scene' },
      });
      expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([MATCH]);
      expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
        revealed: [MATCH], awaitingPick: true, visibility: 'private', viewer: 'self',
      });
      expect(useGameStateStore.getState().gameState?.refreshCount.self).toBe(0);

      expect(dispatchCurrentDecision({
        type: 'effectPickResolve', pickedUid: pick!.candidates[0]!.uid,
      })).toEqual({ ok: true });
      expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
        owner: 'self', audience: 'all', cardIds: [MATCH], origin: 'deck-selected-card',
        source: { cardId: sourceId, abilityId: 'a2', uid: 'source' },
      });
      const discard = useGameStateStore.getState().pendingEffectPick;
      const selected = discard?.candidates.find(candidate => candidate.cardId === MATCH);
      expect(dispatchCurrentDecision({
        type: 'effectPickResolve', pickedUid: selected!.uid,
      })).toEqual({ ok: true });

      const result = useGameStateStore.getState().gameState!;
      expect(result.players.self.scene.find(entry => entry.uid === 'source')?.state).toBe('sleep');
      expect(result.players.self.deck).toEqual([REFRESH]);
      expect(result.players.self.remove).toContain(MATCH);
      expect(result.refreshCount.self).toBe(1);
      expect(result.players.opp.evidence).toHaveLength(1);
      proven.push(sourceId);
    }
    expect(proven).toEqual([B07066.id, B07066P.id]);
  });
});
