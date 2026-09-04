import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B08054 } from '@/cards/ct-p08/B08054';
import { B01039 } from '@/cards/ct-p01/B01039';
import { B02052 } from '@/cards/ct-p02/B02052';
import { applySetCardReplacement } from '@/engine/effect/apply-pick';
import { _peekPendingSetCardReplacementSide } from '@/engine/effect/pending-state';
import {
  hydratePendingRuntimeState,
  persistPendingRuntimeState,
  resetPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SetCardEntry } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';

type LeaveContext = { cause: 'effect' | 'cost'; byPlayer?: 'self' | 'opp'; byUid?: string };

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HIDDEN = fixture('B08054_ENGINE_HIDDEN', { kind: 'event', ap: undefined, lp: undefined });
const FACE_UP = fixture('B08054_ENGINE_FACE_UP', { kind: 'event', ap: undefined, lp: undefined });
const STACK_HOST = fixture('B08054_ENGINE_STACK_HOST');
const SWITCH_IN = fixture('B08054_ENGINE_SWITCH_IN');
const KAITO = fixture('B08054_ENGINE_KAITO', { traits: ['怪盗'] });

function hidden(instanceId: string): SetCardEntry {
  return { cardId: HIDDEN.id, faceUp: false, instanceId };
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 180, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    sceneChar(B08054.id, 'source', {
      setCards: [
        hidden('set:hidden:first'),
        { cardId: FACE_UP.id, faceUp: true, instanceId: 'set:face-up' },
        hidden('set:hidden:second'),
      ],
    }),
    sceneChar(STACK_HOST.id, 'stack-host'),
  ];
  return state;
}

function expectPartition(state: GameState): void {
  expect(state.players.self.hand.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
  expect(state.players.self.remove).toContain(FACE_UP.id);
  expect(state.players.self.remove).not.toContain(HIDDEN.id);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [HIDDEN, FACE_UP, STACK_HOST, SWITCH_IN, KAITO]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('B08054 host-leave replacement covers every effect destination', () => {
  it.each(['deck', 'hand', 'evidence', 'stack'] as const)('opponent effect route=%s partitions set cards first', route => {
    const state = base();
    const context: LeaveContext = { cause: 'effect', byPlayer: 'opp', byUid: 'opponent-source' };

    if (route === 'deck') {
      (mutate.scene.toDeck as unknown as (s: GameState, uid: string, pos: 'bottom', ctx: LeaveContext) => boolean)(state, 'source', 'bottom', context);
      expect(state.players.self.deck).toContain(B08054.id);
    } else if (route === 'hand') {
      (mutate.scene.toHand as unknown as (s: GameState, uid: string, ctx: LeaveContext) => void)(state, 'source', context);
      expect(state.players.self.hand).toContain(B08054.id);
    } else if (route === 'evidence') {
      (mutate.scene.toEvidence as unknown as (s: GameState, uid: string, faceUp: boolean, sourceId: string, ctx: LeaveContext) => void)(state, 'source', true, 'opponent-source', context);
      expect(state.players.self.evidence.map(card => card.cardId)).toContain(B08054.id);
    } else {
      (mutate.scene.toStack as unknown as (s: GameState, uid: string, hostUid: string, ctx: LeaveContext) => boolean)(state, 'source', 'stack-host', context);
      const host = state.players.self.scene.find(character => character.uid === 'stack-host')!;
      expect(Array.isArray(host.stackedCards) && host.stackedCards.some(card => card.cardId === B08054.id)).toBe(true);
    }

    expectPartition(state);
  });

  it.each([
    ['owner-effect', { cause: 'effect', byPlayer: 'self' }],
    ['missing-attribution', { cause: 'effect' }],
    ['cost', { cause: 'cost', byPlayer: 'opp' }],
  ] as const)('%s uses ordinary cleanup', (_label, context) => {
    const state = base();
    (mutate.scene.toDeck as unknown as (s: GameState, uid: string, pos: 'bottom', ctx: LeaveContext) => boolean)(
      state, 'source', 'bottom', context,
    );

    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
    expect(state.players.self.remove).toContain(FACE_UP.id);
  });

  it('switch keeps ordinary cleanup and never returns hidden cards', () => {
    const state = base();
    state.players.self.scene.push(
      sceneChar(STACK_HOST.id, 'filler-2'),
      sceneChar(STACK_HOST.id, 'filler-3'),
      sceneChar(STACK_HOST.id, 'filler-4'),
    );

    mutate.scene.switchEnter(state, 'self', SWITCH_IN.id, 'source', {});

    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
    expect(state.players.self.scene.some(character => character.cardId === SWITCH_IN.id)).toBe(true);
  });

  it('preserves opponent attribution through a persisted and hydrated B02052 replacement pause', () => {
    const state = base();
    state.players.self.scene[0]!.setCards = [
      hidden('set:hidden:first'),
      { cardId: B02052.id, faceUp: true, instanceId: 'set:b02052' },
      hidden('set:hidden:second'),
    ];
    state.players.self.scene.push(sceneChar(KAITO.id, 'kaito'));
    (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';

    mutate.scene.toDeck(state, 'source', 'bottom', {
      cause: 'effect', byPlayer: 'opp', byUid: 'opponent-source',
    });
    expect(_peekPendingSetCardReplacementSide()).toMatchObject({
      player: 'self', fromUid: 'source', setCardInstanceId: 'set:b02052',
      resume: { kind: 'scene-to-deck', cause: 'effect', byPlayer: 'opp', byUid: 'opponent-source' },
    });

    persistPendingRuntimeState(state);
    const restored = structuredClone(state);
    resetPendingRuntimeState();
    expect(hydratePendingRuntimeState(restored)).toBe(true);
    const pending = _peekPendingSetCardReplacementSide()!;
    expect(pending.resume).toMatchObject({
      kind: 'scene-to-deck', cause: 'effect', byPlayer: 'opp', byUid: 'opponent-source',
    });
    expect(applySetCardReplacement(restored, pending, 'kaito')).toBe(true);

    expect(restored.players.self.deck).toContain(B08054.id);
    expect(restored.players.self.scene.find(character => character.uid === 'kaito')?.setCards)
      .toContainEqual(expect.objectContaining({ cardId: B02052.id, instanceId: 'set:b02052' }));
    expect(restored.players.self.hand.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
    expect(restored.players.self.remove).not.toContain(HIDDEN.id);
  });

  it('hydrates a legacy B02052 resume without attribution and fails closed to ordinary cleanup', () => {
    const state = base();
    state.players.self.scene[0]!.setCards = [
      hidden('set:hidden:first'),
      { cardId: B02052.id, faceUp: true, instanceId: 'set:b02052' },
      hidden('set:hidden:second'),
    ];
    state.players.self.scene.push(sceneChar(KAITO.id, 'kaito'));
    (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';

    mutate.scene.toDeck(state, 'source', 'bottom', {
      cause: 'effect', byPlayer: 'opp', byUid: 'opponent-source',
    });
    persistPendingRuntimeState(state);
    const legacy = structuredClone(state);
    const trustedEntries = legacy.pendingRuntimeState?.snapshot.filter(entry => (
      (entry.key === '__pendingSetCardReplacementSide'
        || entry.key === '__pendingSetCardReplacementGuard')
      && entry.present
    )) ?? [];
    expect(trustedEntries).toHaveLength(2);
    for (const entry of trustedEntries) {
      const resume = (entry.value as { resume?: Record<string, unknown> }).resume;
      expect(resume).toBeDefined();
      delete resume!.cause;
      delete resume!.byPlayer;
      delete resume!.byUid;
    }

    resetPendingRuntimeState();
    expect(hydratePendingRuntimeState(legacy)).toBe(true);
    const pending = _peekPendingSetCardReplacementSide()!;
    expect(pending.resume).toEqual({ kind: 'scene-to-deck', pos: 'bottom' });
    expect(applySetCardReplacement(legacy, pending, 'kaito')).toBe(true);

    expect(legacy.players.self.deck).toContain(B08054.id);
    expect(legacy.players.self.hand).toEqual([]);
    expect(legacy.players.self.remove.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
  });

  it('does not return hidden cards when a mandatory set rider prevents the host leave', () => {
    const state = base();
    state.players.self.scene[0]!.setCards = [
      { cardId: B01039.id, faceUp: true, instanceId: 'set:b01039' },
      hidden('set:hidden:first'),
    ];

    const result = mutate.scene.removeToRemove(state, 'source', 'effect', 'opponent-source', {
      byPlayer: 'opp',
    });

    expect(result.prevented).toBe(true);
    expect(state.players.self.scene.find(character => character.uid === 'source')?.setCards)
      .toEqual([expect.objectContaining({ cardId: HIDDEN.id, instanceId: 'set:hidden:first' })]);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toContain(B01039.id);
    expect(state.players.self.remove).not.toContain(HIDDEN.id);
  });

  it('keeps owner orientation when the B08054 controller is opp', () => {
    const state = createEmptyGameState();
    state.turn = { number: 180, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [sceneChar(B08054.id, 'opp-source', {
      setCards: [hidden('set:opp:hidden:first'), hidden('set:opp:hidden:second')],
    })];

    mutate.scene.removeToRemove(state, 'opp-source', 'effect', 'self-source', { byPlayer: 'self' });

    expect(state.players.opp.hand.filter(cardId => cardId === HIDDEN.id)).toHaveLength(2);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.opp.remove).toContain(B08054.id);
    expect(state.players.opp.remove).not.toContain(HIDDEN.id);
  });

  it('batch removal applies each deterministic replacement once', () => {
    const state = base();
    state.players.self.scene.push(sceneChar(B08054.id, 'source-2', {
      setCards: [hidden('set:second-host')],
    }));

    mutate.scene.removeToRemoveBatch(
      state, ['source', 'source-2', 'source'], 'effect', 'opponent-source', { byPlayer: 'opp' },
    );

    expect(state.players.self.hand.filter(cardId => cardId === HIDDEN.id)).toHaveLength(3);
    expect(state.players.self.remove.filter(cardId => cardId === B08054.id)).toHaveLength(2);
    expect(state.players.self.remove).not.toContain(HIDDEN.id);
  });
});
