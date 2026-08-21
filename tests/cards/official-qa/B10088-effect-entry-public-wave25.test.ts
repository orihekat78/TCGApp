// qa: card:B10088:00139d4a04a7b6b8457670c965d9b2c6ee827110a2321d40b2ba641c9a01b896
// qa: card:B10088:214c8fef10f4fc75d77ef453127d09f8c8d76ef13c75ba7fcb6719af6e497b46
// qa: card:B10088:340979e7fce7e5eb3f4810fe4d27e817992a19ea6dada9dded99181420f55674
// qa: card:B10088:f0e393b3a47afbeb95a14a91a8c573bd540fb08877f11528e5ae7dcd501b1a98
// Rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10088 } from '@/cards/ct-p10/B10088';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { runAllUntilEmpty } from '@/engine/resolve';
import { persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, EffectCtx, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const ENTRY = 'QA_B10088_FRESH_ENTRY';
const CUTIN_HIGH_A = 'QA_B10088_CUTIN_HIGH_A';
const CUTIN_HIGH_B = 'QA_B10088_CUTIN_HIGH_B';
const FILLER = 'QA_B10088_FILLER';
const ENTER_DRAW = 'QA_B10088_ENTER_DRAW';
const TAIL = 'QA_B10088_TAIL';
const SCOTCH = 'QA_B10088_SCOTCH';
const BLACK_PARTNER = 'QA_B10088_BLACK_PARTNER';

function character(id: string, level: number, keywords: string[] = []): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level,
    ap: 1000, lp: 1, traits: [], keywords, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const ENTRY_DEF: CardDef = {
  ...character(ENTRY, 3, ['カットイン']),
  abilities: [{
    id: 'entry-draw', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'Wave 25 entry-hook sentinel', ruleRefs: [],
  } satisfies AbilityDef],
};

const SCOTCH_DEF: CardDef = { ...character(SCOTCH, 1), names: ['スコッチ'] };
const BLACK_PARTNER_DEF: CardDef = { ...character(BLACK_PARTNER, 0), kind: 'partner' };

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function roundTrip(): void {
  const restored = JSON.parse(JSON.stringify(current())) as GameState;
  expect(restored.pendingRuntimeState).toBeDefined();
  expect(useGameStateStore.getState().setGameState(null)).toBe(true);
  expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
}

function setupFullSceneEffect(autoPick = false): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [
    makeChar({ uid: 'bourbon', cardId: B10088.id }),
    makeChar({ uid: 'victim-1', cardId: FILLER }),
    makeChar({ uid: 'victim-2', cardId: FILLER }),
    makeChar({ uid: 'victim-3', cardId: FILLER }),
    makeChar({ uid: 'victim-4', cardId: FILLER }),
  ];
  state.players.opp.deck = [ENTRY, CUTIN_HIGH_A, CUTIN_HIGH_B, ENTER_DRAW, TAIL];
  const ctx: EffectCtx = {
    source: { player: 'opp', area: 'scene', cardId: B10088.id, uid: 'bourbon', abilityId: 'a1' },
    bindings: {},
  };
  return produce(state, draft => {
    const optional = B10088.abilities[0]!.effect as Extract<NonNullable<typeof B10088.abilities[0]['effect']>, { kind: 'optional' }>;
    runEffect(draft, optional.effect, ctx);
    runAllUntilEmpty(draft);
    if (autoPick) {
      drainAiEffectPicks(draft, {
        chooseAtomTarget: (_state, _verb, _args, candidates) => (
          candidates.find(candidate => candidate.cardId === ENTRY)
          ?? candidates.find(candidate => 'uid' in candidate && candidate.uid === 'bourbon')
          ?? null
        ),
      });
    }
    if (!autoPick) persistPendingRuntimeState(draft);
  });
}

function setupShortDeckEffect(deckSize: 0 | 1 | 2): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [makeChar({ uid: 'bourbon', cardId: B10088.id })];
  state.players.opp.deck = [CUTIN_HIGH_A, CUTIN_HIGH_B].slice(0, deckSize);
  const ctx: EffectCtx = {
    source: { player: 'opp', area: 'scene', cardId: B10088.id, uid: 'bourbon', abilityId: 'a1' },
    bindings: {},
  };
  return produce(state, draft => {
    const surfaced = resolveEffectPicks(draft, B10088.abilities[0]!.effect!, ctx, {
      humanChooser: true,
      humanPlayer: 'opp',
      byPlayer: 'opp',
      source: { cardId: B10088.id, abilityId: 'a1' },
    });
    runEffect(draft, surfaced, ctx);
    runAllUntilEmpty(draft);
    persistPendingRuntimeState(draft);
  });
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  [
    B10088,
    ENTRY_DEF,
    character(CUTIN_HIGH_A, 4, ['カットイン']),
    character(CUTIN_HIGH_B, 5, ['カットイン']),
    character(ENTER_DRAW, 1),
    character(FILLER, 1),
    character(TAIL, 1),
    SCOTCH_DEF,
    BLACK_PARTNER_DEF,
  ].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('opp');
  expect(useGameStateStore.getState().setGameState(setupFullSceneEffect())).toBe(true);
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  resetPendingRuntimeState();
});

describe('B10088 official-QA full-scene effect entry public dispatch', () => {
  it('reaches a1 through a legal B10088 contact, then completes the public optional and switch flow', () => {
    endMatchSession();
    beginMatchSession('self');
    resetPendingRuntimeState();

    const state = createEmptyGameState();
    state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner = { cardId: BLACK_PARTNER, state: 'active' };
    state.players.self.scene = [
      makeChar({ uid: 'bourbon', cardId: B10088.id, state: 'active' }),
      makeChar({ uid: 'scotch', cardId: SCOTCH, state: 'active' }),
      makeChar({ uid: 'switch-1', cardId: FILLER, state: 'active' }),
      makeChar({ uid: 'switch-2', cardId: FILLER, state: 'active' }),
      makeChar({ uid: 'switch-3', cardId: FILLER, state: 'active' }),
    ];
    state.players.self.deck = [ENTRY, CUTIN_HIGH_A, CUTIN_HIGH_B, ENTER_DRAW, TAIL];
    state.players.opp.scene = [makeChar({ uid: 'contact-victim', cardId: FILLER, state: 'sleep' })];
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'bourbon', targetUid: 'contact-victim' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toEqual(expect.any(String));
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionContact', actionId: actionId!, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });

    expect(current().players.opp.scene).toEqual([]);
    expect(current().players.opp.remove).toEqual([FILLER]);
    expect(current().players.self.scene.find(card => card.uid === 'bourbon')?.declaredUseCount.a1).toBe(1);
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional).toMatchObject({ source: { cardId: B10088.id, uid: 'bourbon', abilityId: 'a1' } });
    expect(dispatchEngineAction(bindPendingDecision(optional!, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });

    const entryPick = useGameStateStore.getState().pendingEffectPick;
    const fresh = entryPick?.candidates.find(candidate => candidate.cardId === ENTRY);
    expect(fresh).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(entryPick!, {
      type: 'effectPickResolve', pickedUid: fresh!.uid, switchRemoveUid: 'switch-1',
    }))).toEqual({ ok: true });

    expect(current().players.self.scene).toHaveLength(5);
    expect(current().players.self.scene.some(card => card.cardId === ENTRY)).toBe(true);
    expect(current().players.self.scene.some(card => card.uid === 'switch-1')).toBe(false);
    expect(current().players.self.remove).toEqual([CUTIN_HIGH_A, CUTIN_HIGH_B, FILLER]);
    expect(current().players.self.hand).toEqual([ENTER_DRAW]);
    expect(current().players.self.deck).toEqual([TAIL]);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'self',
      revealed: [ENTRY, CUTIN_HIGH_A, CUTIN_HIGH_B],
      matched: ENTRY,
    });
    useGameStateStore.getState().setPendingDeckReveal(null);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });

  it('enters a freshly removed eligible card by a persisted switch choice, including switching B10088 itself', () => {
    const entryPick = useGameStateStore.getState().pendingEffectPick;
    expect(entryPick).toMatchObject({ player: 'opp', ownerPlayer: 'opp', atomVerb: 'sceneEnter' });
    const fresh = entryPick?.candidates.find(candidate => candidate.cardId === ENTRY);
    expect(fresh, 'newly removed top-three character is eligible').toBeTruthy();
    expect(current().players.opp.remove).toEqual([ENTRY, CUTIN_HIGH_A, CUTIN_HIGH_B]);
    roundTrip();

    const restoredEntryPick = useGameStateStore.getState().pendingEffectPick;
    const restoredFresh = restoredEntryPick?.candidates.find(candidate => candidate.cardId === ENTRY);
    expect(dispatchEngineAction(bindPendingDecision(restoredEntryPick!, {
      type: 'effectPickResolve', pickedUid: restoredFresh!.uid, switchRemoveUid: 'bourbon',
    }))).toEqual({ ok: true });

    expect(current().players.opp.scene).toHaveLength(5);
    expect(current().players.opp.scene.some(card => card.cardId === ENTRY)).toBe(true);
    expect(current().players.opp.scene.some(card => card.uid === 'bourbon')).toBe(false);
    expect(current().players.opp.remove).toEqual([CUTIN_HIGH_A, CUTIN_HIGH_B, B10088.id]);
    expect(current().players.opp.hand).toEqual([ENTER_DRAW]);
    expect(current().players.opp.deck).toEqual([TAIL]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().pendingRuntimeState).toBeUndefined();
  });

  it('honors an explicit CPU entry-and-switch policy on a full scene', () => {
    endMatchSession();
    beginMatchSession('self');
    resetPendingRuntimeState();

    const resolved = setupFullSceneEffect(true);

    expect(resolved.players.opp.scene).toHaveLength(5);
    expect(resolved.players.opp.scene.some(card => card.cardId === ENTRY)).toBe(true);
    expect(resolved.players.opp.scene.some(card => card.uid === 'bourbon')).toBe(false);
    expect(resolved.players.opp.remove).toEqual([CUTIN_HIGH_A, CUTIN_HIGH_B, B10088.id]);
    expect(resolved.players.opp.hand).toEqual([ENTER_DRAW]);
    expect(resolved.players.opp.deck).toEqual([TAIL]);
    expect(resolved.pendingRuntimeState).toBeUndefined();
  });

  it.each([0, 1, 2] as const)(
    'does not remove cards when the optional effect is accepted with %i cards in deck',
    (deckSize) => {
      resetPendingRuntimeState();
      const expectedDeck = [CUTIN_HIGH_A, CUTIN_HIGH_B].slice(0, deckSize);
      expect(useGameStateStore.getState().setGameState(setupShortDeckEffect(deckSize))).toBe(true);
      const optional = useGameStateStore.getState().pendingEffectOptional;
      expect(optional?.source).toMatchObject({ cardId: B10088.id, abilityId: 'a1' });
      expect(dispatchEngineAction(bindPendingDecision(optional!, {
        type: 'optionalResolve', run: true,
      }))).toEqual({ ok: true });

      expect(current().players.opp.deck).toEqual(expectedDeck);
      expect(current().players.opp.remove).toEqual([]);
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    },
  );
});
