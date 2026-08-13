// qaId=card:B02008:3240a4626ffa31e953f10ca03af61b33b9d3367feeffa3bc87cd8b3c7be01d9b
// qaId=card:B02008:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B02008:fde26b8ea125c4e1554955fecf095ce90a82720da365795236b28d2330727deb
import { beforeEach, describe, expect, it } from 'vitest';
import { B02008 } from '@/cards/ct-p02/B02008';
import { event } from '@/engine/event';
import {
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';

const ZERO_PICK_QA_ID = 'card:B02008:3240a4626ffa31e953f10ca03af61b33b9d3367feeffa3bc87cd8b3c7be01d9b';
const ORDER_QA_ID = 'card:B02008:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9';
const NONPOSITIVE_AP_QA_ID = 'card:B02008:fde26b8ea125c4e1554955fecf095ce90a82720da365795236b28d2330727deb';

function character(id: string, traits: string[] = [], ap = 1000): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['blue'],
    level: 1,
    ap,
    lp: 1,
    traits,
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const BOY = character('B02008_QA_BOY', ['少年探偵団']);
const LOW_AP_TARGET = character('B02008_QA_LOW_AP', [], 500);

function stateWithBearers(count: number): { state: GameState; bearerUids: string[] } {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const bearerUids = Array.from({ length: count }, () => mutate.scene.enter(state, 'self', B02008.id, {}).uid);
  return { state, bearerUids };
}

function emitBoyEnter(state: GameState): string {
  const entered = mutate.scene.enter(state, 'self', BOY.id, {});
  event.emit(
    state,
    'enter',
    { uid: entered.uid, viaEffect: false, enterOrder: 1 },
    { uid: entered.uid, cardId: BOY.id, player: 'self' },
  );
  return entered.uid;
}

function pendingB02008A1Count(state: GameState): number {
  return state.pendingEffects.filter((entry) =>
    entry.source.cardId === B02008.id
    && entry.source.abilityId === 'a1'
  ).length;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  register(B02008);
  register(BOY);
  register(LOW_AP_TARGET);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null, pendingEffectOptional: null });
});

describe('B02008 official Q&A shared runtime certification', () => {
  it(`${ZERO_PICK_QA_ID}: zero selection still consumes the once-per-turn trigger`, () => {
    const { state, bearerUids: [bearerUid] } = stateWithBearers(1);
    emitBoyEnter(state);
    useGameStateStore.setState({ gameState: state });
    runAllUntilEmpty(state);
    surfacePendingSideChannels();

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.source.uid, `${ZERO_PICK_QA_ID}: real B02008 source`).toBe(bearerUid);
    expect(pick?.nMin, `${ZERO_PICK_QA_ID}: up-to-one permits zero`).toBe(0);
    expect(dispatchEngineAction(bindPendingDecision(pick!, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });

    const afterSecond = produce(useGameStateStore.getState().gameState!, (draft) => {
      expect(readChar.declaredUseCount(draft, bearerUid!, 'a1'), `${ZERO_PICK_QA_ID}: fired count`).toBe(1);
      emitBoyEnter(draft);
      runAllUntilEmpty(draft);
    });
    useGameStateStore.setState({ gameState: afterSecond, pendingEffectPick: null });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick, `${ZERO_PICK_QA_ID}: no second same-turn resolution`).toBeNull();
    expect(pendingB02008A1Count(afterSecond), `${ZERO_PICK_QA_ID}: no second stack entry`).toBe(1);
  });

  it(`${ORDER_QA_ID}: two copies trigger and the owner resolves them in the chosen order`, () => {
    const { state, bearerUids: [bearerA, bearerB] } = stateWithBearers(2);
    emitBoyEnter(state);

    const initial = pendingOwnerOrderGroup(state, 'self');
    expect(initial.map((entry) => entry.source.uid), `${ORDER_QA_ID}: both mandatory triggers`).toEqual([bearerA, bearerB]);
    expect(readChar.declaredUseCount(state, bearerA!, 'a1'), `${ORDER_QA_ID}: first copy fired`).toBe(1);
    expect(readChar.declaredUseCount(state, bearerB!, 'a1'), `${ORDER_QA_ID}: second copy fired`).toBe(1);
    expect(_drainPendingEffectOptionalSide(), `${ORDER_QA_ID}: activation is not optional`).toBeNull();

    useGameStateStore.setState({ gameState: state });
    const secondEntry = initial.find((entry) => entry.source.uid === bearerB)!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: secondEntry.id, order: 0, player: 'self' })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(ordered.map((entry) => entry.source.uid), `${ORDER_QA_ID}: owner-selected order`).toEqual([bearerB, bearerA]);
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder',
      entryIds: ordered.map((entry) => entry.id),
      player: 'self',
    })).toEqual({ ok: true });

    const firstPick = useGameStateStore.getState().pendingEffectPick;
    expect(firstPick?.source.uid, `${ORDER_QA_ID}: second copy resolves first`).toBe(bearerB);
    expect(dispatchEngineAction(bindPendingDecision(firstPick!, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
    const secondPick = useGameStateStore.getState().pendingEffectPick;
    expect(secondPick?.source.uid, `${ORDER_QA_ID}: first copy resolves second`).toBe(bearerA);
    expect(dispatchEngineAction(bindPendingDecision(secondPick!, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    const resolved = produce(useGameStateStore.getState().gameState!, (draft) => {
      emitBoyEnter(draft);
    });
    expect(pendingB02008A1Count(resolved), `${ORDER_QA_ID}: same-turn re-entry adds no trigger`).toBe(2);
  });

  it(`${NONPOSITIVE_AP_QA_ID}: reducing AP below zero does not remove the character`, () => {
    const { state } = stateWithBearers(1);
    const target = mutate.scene.enter(state, 'opp', LOW_AP_TARGET.id, {});
    emitBoyEnter(state);
    useGameStateStore.setState({ gameState: state });
    runAllUntilEmpty(state);
    surfacePendingSideChannels();

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.candidates.some((candidate) => candidate.uid === target.uid), `${NONPOSITIVE_AP_QA_ID}: target is legal`).toBe(true);
    expect(dispatchEngineAction(bindPendingDecision(pick!, { type: 'effectPickResolve', pickedUid: target.uid }))).toEqual({ ok: true });

    const resolved = useGameStateStore.getState().gameState!;
    expect(readChar.ap(resolved, target.uid), `${NONPOSITIVE_AP_QA_ID}: signed AP is retained`).toBe(-500);
    expect(resolved.players.opp.scene.some((card) => card.uid === target.uid), `${NONPOSITIVE_AP_QA_ID}: target remains in scene`).toBe(true);
    expect(resolved.players.opp.remove, `${NONPOSITIVE_AP_QA_ID}: no automatic removal`).not.toContain(LOW_AP_TARGET.id);
  });
});
