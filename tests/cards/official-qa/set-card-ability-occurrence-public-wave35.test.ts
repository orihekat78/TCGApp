// qa: card:B01057:366df996e065e39c71b329905df4d05cf65e19edc03f898264e9bf906822be58
// qa: card:B01039:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B01057:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// qa: card:B01057:f4654de7db7ed93de8965c301fff81fef5022412009e5bc2b4d985099ce0dd
// qa: card:B05117:833ea89ac43a5b2df4adb9013317028b9acd381fe2b4d994ef60039ca4c77b3a
// qa: card:B05117:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B05117:dab2cd3bb6936375cc153ec4b87b8facc0aebb87babae7f4912fc14b0792c2e6
// qa: card:B05117:e38ff3716335f68a3cde1aa7428cd09d51ca15bc9bb8c02870657de4fad3b67d
// qa: card:B07014:bd67dbe9cade0deddafb4cbadad23f58738d4185aa2f881da6e9284c89d2f555
// qa: card:B10017:5e2a14c083efb30077c2954eb8bea8ebb46fd5b17d94e318b208ecf80a2655c4
// qa: card:B10017:f9459c0f71b39b92ee72f7da065dd07e95384fc9c934c2c2fa4c4b6ebde69031
// qa: card:B02084:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B06012:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// Rules: 15, 16, 17, 21, 25. A face-up physical set card grants one physical
// ability occurrence. Duplicate printings must remain distinct through trigger,
// declaration, public authority, cost payment, AI move, and JSON boundaries.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves, type Move } from '@/ai/move-enumerator';
import { applyMove, stepTurn, type AIPolicy } from '@/ai/policy';
import { ScriptedPolicy } from '@/ai/replay';
import { registerAll } from '@/cards';
import { B01039 } from '@/cards/ct-p01/B01039';
import { B01057 } from '@/cards/ct-p01/B01057';
import { B01057P } from '@/cards/ct-p01/B01057P';
import { B02020 } from '@/cards/ct-p02/B02020';
import { B02052 } from '@/cards/ct-p02/B02052';
import { B02052P } from '@/cards/ct-p02/B02052P';
import { B02084 } from '@/cards/ct-p02/B02084';
import { B05117 } from '@/cards/ct-p05/B05117';
import { B05117P } from '@/cards/ct-p05/B05117P';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B07014 } from '@/cards/ct-p07/B07014';
import { B07014P } from '@/cards/ct-p07/B07014P';
import { B10017, B10017P } from '@/cards/ct-p10/B10017';
import { B10018, B10018P } from '@/cards/ct-p10/B10018';
import { event } from '@/engine/event';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { assertPendingRuntimeValue } from '@/engine/effect/pending-runtime-schema';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { consultLeaveIntercept } from '@/engine/effect/consult-leave-intercept';
import { persistPendingRuntimeState, snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import {
  _drainPendingDeckRevealSide,
  queuePendingDeckRevealSide,
} from '@/engine/effect/atom-handlers/_shared';
import {
  canActivateDeclaredAbility,
  canDeclaredAbility,
  findDeclaredAbilityOccurrences,
  useDeclaredAbility,
} from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { buildEntry } from '@/engine/event/registry';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { enumDeclaredAbilityChoicesFor } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { confirmSetCardCostChoice, toggleSetCardCostChoice } from '@/ui/hooks/useSetCardCostPicker';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function character(id: string): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 9000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}

const HOST = character('W35-HOST');
const KAITOU_HOST: CardDef = {
  ...character('W35-KAITOU-HOST'),
  traits: ['怪盗'],
};
const COLLISION_HOST: CardDef = {
  ...character('W35-COLLISION-HOST'),
  abilities: [{
    id: 'a3', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'printed a3', ruleRefs: [],
  }],
};
const TRIGGER_COLLISION_HOST: CardDef = {
  ...character('W35-TRIGGER-COLLISION-HOST'),
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'phase:end:start' },
    limit: { kind: 'turn', n: 1 },
    effect: { kind: 'atom', verb: 'noop', args: { origin: 'printed' } },
    description: 'printed triggered a1', ruleRefs: [],
  }],
};
const CUTIN_W35: CardDef = {
  ...character('W35-CUTIN'),
  level: 6,
  abilities: [{
    id: 'cutin', type: 'triggered', scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: {
      kind: 'atom', verb: 'charModifyAP',
      args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' },
    },
    description: '【カットイン】AP＋1000', ruleRefs: [],
  }],
};

const TRIGGER_CASES = [
  {
    label: 'B01057/B01057',
    cardIds: [B01057.id, B01057.id],
    abilityId: 'b01057_set_t1',
  },
  {
    label: 'B01057P/B01057P',
    cardIds: [B01057P.id, B01057P.id],
    abilityId: 'b01057_set_t1',
  },
  {
    label: 'B01057/B01057P',
    cardIds: [B01057.id, B01057P.id],
    abilityId: 'b01057_set_t1',
  },
  {
    label: 'B05117/B05117',
    cardIds: [B05117.id, B05117.id],
    abilityId: 'b05117_set_t1',
  },
  {
    label: 'B05117P/B05117P',
    cardIds: [B05117P.id, B05117P.id],
    abilityId: 'b05117_set_t1',
  },
  {
    label: 'B05117/B05117P',
    cardIds: [B05117.id, B05117P.id],
    abilityId: 'b05117_set_t1',
  },
] as const;

function baseWithSetCards(entries: Array<{ cardId: string; instanceId: string }>): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [sceneChar(HOST.id, 'host', {
    setCards: entries.map(entry => ({ ...entry, faceUp: true })),
  })];
  return state;
}

function install(state: GameState, label: string): void {
  resetPresentationQueue(`qa-wave35-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function chooseSource(uid: string): Promise<void> {
  const store = useTargetPickerStore.getState();
  const resolve = store._resolver!;
  store._setPhase({ phase: 'idle' });
  store._setResolver(null);
  resolve(uid);
  await tick();
}

async function chooseAbility(index: number): Promise<void> {
  const store = useChoicePickerStore.getState();
  const resolve = store._resolver!;
  store._setCurrent(null);
  store._setResolver(null);
  resolve({ kind: 'choose', index });
  await tick();
}

async function confirmAbility(): Promise<void> {
  const store = useConfirmationStore.getState();
  const resolve = store._resolver!;
  store._setCurrent(null);
  store._setResolver(null);
  resolve(true);
  await tick();
}

const RUNTIME_WRITER_CASES = ['pick', 'choice', 'optional', 'repeatOptional'] as const;
type RuntimeWriter = typeof RUNTIME_WRITER_CASES[number];

function writePendingRuntime(kind: RuntimeWriter, state: GameState, ctx: EffectCtx): void {
  const opts = {
    humanChooser: true as const,
    humanPlayer: 'self' as const,
    byPlayer: 'self' as const,
    source: { cardId: HOST.id, abilityId: 'a2' },
  };
  const noop = { kind: 'atom', verb: 'noop', args: {} } as const;
  if (kind === 'pick') {
    resolveEffectPicks(state, {
      kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 },
    }, ctx, { ...opts, _fromAtomHandler: true });
    return;
  }
  if (kind === 'choice') {
    resolveEffectPicks(state, {
      kind: 'choice', chooser: 'owner', options: [noop, noop],
    }, ctx, opts);
    return;
  }
  if (kind === 'optional') {
    resolveEffectPicks(state, {
      kind: 'optional', chooser: 'owner', effect: noop,
    }, ctx, opts);
    return;
  }
  runEffect(state, { kind: 'repeatOptional', max: 2, body: noop }, ctx);
}

function persistedWriterSource(state: GameState, kind: RuntimeWriter): Record<string, unknown> {
  const key = kind === 'pick'
    ? '__pendingEffectPickQueue'
    : kind === 'choice'
      ? '__pendingEffectChoiceSide'
      : kind === 'optional'
        ? '__pendingEffectOptionalSide'
        : '__pendingEffectRepeatOptionalSide';
  const entry = state.pendingRuntimeState?.snapshot.find(candidate => candidate.key === key);
  const pending = kind === 'pick'
    ? (entry?.value as Array<{ source?: Record<string, unknown> }> | undefined)?.[0]
    : entry?.value as { source?: Record<string, unknown> } | undefined;
  if (!entry?.present || !pending?.source) throw new Error(`missing persisted ${kind} source`);
  return pending.source;
}

function surfacedWriterSource(kind: RuntimeWriter): Record<string, unknown> | undefined {
  const store = useGameStateStore.getState();
  if (kind === 'pick') return store.pendingEffectPick?.source;
  if (kind === 'choice') return store.pendingEffectChoice?.source;
  if (kind === 'optional') return store.pendingEffectOptional?.source;
  return store.pendingEffectRepeatOptional?.source;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(HOST);
  register(KAITOU_HOST);
  register(COLLISION_HOST);
  register(TRIGGER_COLLISION_HOST);
  register(CUTIN_W35);
  registerTriggeredListener();
  _clearPendingEffectPickQueue();
  useTargetPickerStore.getState()._reset();
  useChoicePickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('Wave35 physical set-card ability occurrences', () => {
  it('keeps each mandatory leave-intercept rider as an exact physical occurrence', () => {
    const state = baseWithSetCards([
      { cardId: B01039.id, instanceId: 'set:guard:first' },
      { cardId: B01039.id, instanceId: 'set:guard:second' },
    ]);

    expect(consultLeaveIntercept(
      state,
      state.players.self.scene[0]!,
      'self',
      'effect',
      'opponent-source',
      'opp',
    )).toEqual({
      kind: 'kept-in-scene',
      consumedSetCards: [
        { cardId: B01039.id, setCardInstanceId: 'set:guard:first' },
        { cardId: B01039.id, setCardInstanceId: 'set:guard:second' },
      ],
    });
  });

  it('emits setcard:leave when B01039 is consumed and queues the real B02020 observer', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B02020.id, 'observer')];
    state.players.opp.scene = [sceneChar(HOST.id, 'guarded', {
      setCards: [{ cardId: B01039.id, faceUp: true, instanceId: 'set:guard:consumed' }],
    })];
    const stateAtLeave: Array<{ attached: boolean; inRemove: boolean }> = [];
    event.on('setcard:leave', (observed, payload) => {
      if (payload.setCardInstanceId !== 'set:guard:consumed') return;
      stateAtLeave.push({
        attached: observed.players.opp.scene[0]!.setCards.some(entry => (
          entry.instanceId === 'set:guard:consumed'
        )),
        inRemove: observed.players.opp.remove.includes(B01039.id),
      });
    });

    const result = mutate.scene.removeToRemove(
      state,
      'guarded',
      'effect',
      'observer',
      { byPlayer: 'self' },
    );

    expect(result.prevented).toBe(true);
    expect(state.players.opp.scene.map(char => char.uid)).toContain('guarded');
    expect(state.players.opp.scene[0]!.setCards).toEqual([]);
    expect(state.players.opp.remove).toContain(B01039.id);
    expect(stateAtLeave).toEqual([{ attached: false, inRemove: true }]);
    expect(state.pendingEffects.find(entry => (
      entry.triggeredBy.hook === 'setcard:leave'
      && entry.source.cardId === B02020.id
      && entry.source.abilityId === 'a1'
    ))).toMatchObject({
      source: {
        uid: 'observer',
        abilityOrigin: 'printed',
        abilityIndex: 0,
      },
      triggeredBy: {
        payload: {
          player: 'opp',
          hostUid: 'guarded',
          setCardId: B01039.id,
          setCardInstanceId: 'set:guard:consumed',
          cause: 'effect',
        },
      },
    });
  });

  it('keeps colliding printed and granted triggered abilities independent', () => {
    let state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(TRIGGER_COLLISION_HOST.id, 'trigger-host')];
    const grantedAbility = {
      id: 'a1', type: 'triggered', scope: 'on-scene',
      trigger: { hook: 'phase:end:start' },
      limit: { kind: 'turn', n: 1 },
      effect: { kind: 'atom', verb: 'noop', args: { origin: 'granted' } },
      description: 'granted triggered a1', ruleRefs: [],
    } as const;
    state = structuredClone(produce(state, draft => runEffect(draft, {
      kind: 'atom',
      verb: 'charGrantAbility',
      args: { uid: 'trigger-host', ability: grantedAbility },
    }, {
      source: {
        player: 'self', area: 'scene', cardId: TRIGGER_COLLISION_HOST.id,
        uid: 'trigger-host', abilityId: 'grant-a1',
      },
      bindings: {},
    })));

    event.emit(state, 'phase:end:start', { player: 'self' });
    const occurrences = state.pendingEffects.filter(entry => (
      entry.source.uid === 'trigger-host' && entry.source.abilityId === 'a1'
    ));
    expect(occurrences.map(entry => ({
      abilityOrigin: entry.source.abilityOrigin,
      abilityIndex: entry.source.abilityIndex,
    }))).toEqual([
      { abilityOrigin: 'printed', abilityIndex: 0 },
      { abilityOrigin: 'granted', abilityIndex: 0 },
    ]);
    expect(readChar.declaredUseCount(state, 'trigger-host', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
    expect(readChar.declaredUseCount(state, 'trigger-host', 'a1', {
      abilityOrigin: 'granted', abilityIndex: 0,
    })).toBe(1);
    event.emit(state, 'phase:end:start', { player: 'self' });
    expect(state.pendingEffects.filter(entry => (
      entry.source.uid === 'trigger-host' && entry.source.abilityId === 'a1'
    ))).toHaveLength(2);
  });

  it('keeps each physical set-card origin on every enter and leave event path', () => {
    type LifecyclePayload = {
      player: 'self' | 'opp';
      hostUid: string;
      hostCardId: string;
      setCardId: string;
      setCardInstanceId: string;
      cause: string;
    };
    type LifecycleObservation = {
      hook: 'setcard:enter' | 'setcard:leave';
      payload: LifecyclePayload;
      source: Record<string, unknown>;
    };
    const observed: LifecycleObservation[] = [];
    const observe = (hook: LifecycleObservation['hook']) => {
      event.on(hook, (_state, payload, source) => {
        const typedPayload = payload as LifecyclePayload;
        observed.push({
          hook,
          payload: typedPayload,
          source: source as Record<string, unknown>,
        });
        return {
          kind: 'atom',
          verb: 'noop',
          args: { wave35LifecycleInstance: typedPayload.setCardInstanceId },
        };
      });
    };
    observe('setcard:enter');
    observe('setcard:leave');

    const expectOrigin = (
      state: GameState,
      hook: LifecycleObservation['hook'],
      setCardInstanceId: string,
      cause: string,
    ) => {
      const observation = observed.filter(item => (
        item.hook === hook
        && item.payload.setCardInstanceId === setCardInstanceId
        && item.payload.cause === cause
      )).at(-1);
      expect(observation).toBeDefined();
      const expected = {
        player: observation!.payload.player,
        uid: observation!.payload.hostUid,
        cardId: observation!.payload.hostCardId,
        setCardId: observation!.payload.setCardId,
        setCardInstanceId: observation!.payload.setCardInstanceId,
      };
      expect(observation!.source).toMatchObject(expected);
      const queued = state.pendingEffects.find(entry => (
        entry.triggeredBy.hook === hook
        && entry.effect.kind === 'atom'
        && entry.effect.verb === 'noop'
        && (entry.effect.args as { wave35LifecycleInstance?: string }).wave35LifecycleInstance === setCardInstanceId
      ));
      expect(queued?.source).toMatchObject(expected);
    };

    const regularEnter = baseWithSetCards([]);
    mutate.char.setCard(regularEnter, 'host', B07014.id, true);
    const regularInstanceId = regularEnter.players.self.scene[0]!.setCards[0]!.instanceId!;
    expectOrigin(regularEnter, 'setcard:enter', regularInstanceId, 'effect');

    const replacement = createEmptyGameState();
    replacement.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    replacement.players.self.scene = [
      sceneChar(KAITOU_HOST.id, 'replacement-from', {
        setCards: [{ cardId: B02052.id, faceUp: true, instanceId: 'set:lifecycle:replacement' }],
      }),
      sceneChar(KAITOU_HOST.id, 'replacement-to'),
    ];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    try {
      expect(mutate.char.removeOneSetCard(replacement, 'replacement-from')).toBeNull();
    } finally {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    }
    expectOrigin(replacement, 'setcard:enter', 'set:lifecycle:replacement', 'replacement');

    const directLeave = baseWithSetCards([{ cardId: B07014.id, instanceId: 'set:lifecycle:direct' }]);
    expect(mutate.char.removeOneSetCard(directLeave, 'host', {
      setCardInstanceId: 'set:lifecycle:direct',
      skipReplacement: true,
    })).toBe(B07014.id);
    expectOrigin(directLeave, 'setcard:leave', 'set:lifecycle:direct', 'effect');

    const moveLeave = baseWithSetCards([{ cardId: B07014.id, instanceId: 'set:lifecycle:move' }]);
    expect(mutate.char.moveOneSetCard(
      moveLeave,
      'host',
      'set:lifecycle:move',
      'up',
      { area: 'hand' },
    )).toEqual({ cardId: B07014.id, player: 'self' });
    expectOrigin(moveLeave, 'setcard:leave', 'set:lifecycle:move', 'move');

    const hostLeave = baseWithSetCards([{ cardId: B07014.id, instanceId: 'set:lifecycle:host' }]);
    mutate.scene.removeToRemove(hostLeave, 'host', 'effect');
    expectOrigin(hostLeave, 'setcard:leave', 'set:lifecycle:host', 'effect');
  });

  it('keeps the selected B02052 replacement origin through JSON hydration', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(KAITOU_HOST.id, 'replacement-from', {
        setCards: [
          { cardId: B02052.id, faceUp: true, instanceId: 'set:replacement:base' },
          { cardId: B02052P.id, faceUp: true, instanceId: 'set:replacement:parallel' },
        ],
      }),
      sceneChar(KAITOU_HOST.id, 'replacement-to'),
    ];

    expect(mutate.char.removeOneSetCard(state, 'replacement-from', {
      setCardInstanceId: 'set:replacement:parallel',
    })).toBeNull();
    persistPendingRuntimeState(state);
    const sideEntry = state.pendingRuntimeState?.snapshot.find(
      (entry) => entry.key === '__pendingSetCardReplacementSide',
    );
    expect((sideEntry?.value as { source?: Record<string, unknown> } | undefined)?.source)
      .toMatchObject({
        cardId: B02052P.id,
        uid: 'replacement-from',
        abilityId: 'a3',
        setCardId: B02052P.id,
        setCardInstanceId: 'set:replacement:parallel',
      });

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    expect(useGameStateStore.getState().pendingSetCardReplacement?.source).toMatchObject({
      cardId: B02052P.id,
      uid: 'replacement-from',
      abilityId: 'a3',
      setCardId: B02052P.id,
      setCardInstanceId: 'set:replacement:parallel',
    });
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    'fails closed for malformed physical set-card use counts %s',
    (invalidCount) => {
      const riderState = baseWithSetCards([{ cardId: B07014.id, instanceId: 'set:invalid:rider' }]);
      riderState.players.self.scene[0]!.setCards[0]!.abilityUseCounts = {
        a3: { turn: riderState.turn.number, count: invalidCount },
      };
      expect(canActivateDeclaredAbility(riderState, 'host', 'a3', undefined, {
        sourceRef: { setCardId: B07014.id, setCardInstanceId: 'set:invalid:rider' },
      })).toBe(false);

      const replacementState = createEmptyGameState();
      replacementState.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
      replacementState.players.self.scene = [
        sceneChar(KAITOU_HOST.id, 'replacement-from', { setCards: [{
          cardId: B02052.id,
          faceUp: true,
          instanceId: 'set:invalid:replacement',
          replacementUseCounts: { a3: { turn: 4, count: invalidCount } },
        }] }),
        sceneChar(KAITOU_HOST.id, 'replacement-to'),
      ];
      expect(mutate.char.removeOneSetCard(replacementState, 'replacement-from', {
        setCardInstanceId: 'set:invalid:replacement',
      })).toBe(B02052.id);
    },
  );

  it.each(TRIGGER_CASES)('$label keeps two triggered origins through host leave and JSON', ({ cardIds, abilityId }) => {
    const before = baseWithSetCards(cardIds.map((cardId, index) => ({
      cardId,
      instanceId: `set:trigger:${index + 1}`,
    })));
    before.turn.player = 'opp';

    const after = produce(before, (draft) => {
      mutate.scene.removeToRemove(draft, 'host', 'effect');
    });
    const queued = after.pendingEffects.filter(entry => (
      entry.source.uid === 'host' && entry.triggeredBy.hook === 'leave:to-remove'
    ));
    expect(queued).toHaveLength(2);
    expect(queued.map(entry => ({
      abilityId: entry.source.abilityId,
      setCardId: entry.source.setCardId,
      setCardInstanceId: entry.source.setCardInstanceId,
    }))).toEqual([
      { abilityId, setCardId: cardIds[0], setCardInstanceId: 'set:trigger:1' },
      { abilityId, setCardId: cardIds[1], setCardInstanceId: 'set:trigger:2' },
    ]);
    expect(JSON.parse(JSON.stringify(queued)).map((entry: typeof queued[number]) => entry.source))
      .toEqual(queued.map(entry => entry.source));
  });

  it('keeps B01057/P leave triggers bound to their exact physical origins', () => {
    const state = baseWithSetCards([
      { cardId: B01057.id, instanceId: 'set:reasoning:base' },
      { cardId: B01057P.id, instanceId: 'set:reasoning:parallel' },
    ]);
    state.turn.player = 'opp';
    mutate.scene.removeToRemove(state, 'host', 'effect');

    const queued = state.pendingEffects.filter(entry => entry.source.abilityId === 'b01057_set_t1');
    expect(queued.map(entry => ({
      setCardId: entry.source.setCardId,
      setCardInstanceId: entry.source.setCardInstanceId,
    }))).toEqual([
      { setCardId: B01057.id, setCardInstanceId: 'set:reasoning:base' },
      { setCardId: B01057P.id, setCardInstanceId: 'set:reasoning:parallel' },
    ]);
    expect(JSON.parse(JSON.stringify(queued)).map((entry: typeof queued[number]) => entry.source))
      .toEqual(queued.map(entry => entry.source));
  });

  it('re-evaluates the second B05117 occurrence after the first one changes the scene', () => {
    const state = baseWithSetCards([
      { cardId: B05117.id, instanceId: 'set:fox:base' },
      { cardId: B05117P.id, instanceId: 'set:fox:parallel' },
    ]);
    state.turn.player = 'opp';
    state.players.self.remove = [CUTIN_W35.id];

    mutate.scene.removeToRemove(state, 'host', 'effect');
    const ordered = pendingOwnerOrderGroup(state, 'self').filter(entry => (
      entry.source.abilityId === 'b05117_set_t1'
    ));
    expect(ordered.map(entry => ({
      setCardId: entry.source.setCardId,
      setCardInstanceId: entry.source.setCardInstanceId,
    }))).toEqual([
      { setCardId: B05117.id, setCardInstanceId: 'set:fox:base' },
      { setCardId: B05117P.id, setCardInstanceId: 'set:fox:parallel' },
    ]);

    install(state, 'b05117-resolution-recheck');
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });
    const firstPick = useGameStateStore.getState().pendingEffectPick;
    expect(firstPick).toMatchObject({ atomVerb: 'sceneEnter' });
    expect(firstPick!.source).toMatchObject({
      uid: 'host',
      setCardId: B05117.id,
      setCardInstanceId: 'set:fox:base',
    });
    const pickedUid = firstPick!.candidates[0]!.uid;
    expect(dispatchEngineAction(bindPendingDecision(firstPick!, {
      type: 'effectPickResolve', pickedUid,
    }))).toEqual({ ok: true });

    const after = current();
    expect(after.players.self.scene.map(card => card.cardId)).toEqual([CUTIN_W35.id]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(after.pendingEffects.filter(entry => ordered.some(item => item.id === entry.id)).map(entry => entry.state))
      .toEqual(['resolved', 'resolved']);
    expect(after.pendingEffects.some(entry => entry.state === 'pending')).toBe(false);
  });

  it('keeps each B02052 origin through optional JSON restore and the resumed pick', () => {
    const state = baseWithSetCards([
      { cardId: B02052.id, instanceId: 'set:gun:base' },
      { cardId: B02052P.id, instanceId: 'set:gun:parallel' },
    ]);
    state.players.self.deck = [HOST.id, HOST.id, HOST.id, HOST.id, HOST.id, HOST.id];
    event.emit(state, 'phase:end:start', { player: 'self' });
    const ordered = pendingOwnerOrderGroup(state, 'self').filter(entry => (
      entry.source.abilityId === 'a2'
    ));
    expect(ordered.map(entry => ({
      setCardId: entry.source.setCardId,
      setCardInstanceId: entry.source.setCardInstanceId,
    }))).toEqual([
      { setCardId: B02052.id, setCardInstanceId: 'set:gun:base' },
      { setCardId: B02052P.id, setCardInstanceId: 'set:gun:parallel' },
    ]);

    install(state, 'b02052-optional-origin');
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });
    const first = useGameStateStore.getState().pendingEffectOptional;
    expect(first?.source).toMatchObject({
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      setCardId: B02052.id,
      setCardInstanceId: 'set:gun:base',
    });

    const restoredState = JSON.parse(JSON.stringify(current())) as GameState;
    const forgedState = JSON.parse(JSON.stringify(restoredState)) as GameState;
    const forgedOptional = forgedState.pendingRuntimeState?.snapshot.find(
      (entry) => entry.key === '__pendingEffectOptionalSide',
    )?.value as { source?: { setCardId?: string; setCardInstanceId?: string } } | undefined;
    expect(forgedOptional?.source).toBeDefined();
    forgedOptional!.source!.setCardId = B02052P.id;
    forgedOptional!.source!.setCardInstanceId = 'set:gun:parallel';
    const beforeForgedInstall = current();
    expect(() => useGameStateStore.getState().setGameState(forgedState))
      .toThrow(/set-card source.*authority/i);
    expect(current()).toBe(beforeForgedInstall);

    resetPresentationQueue('qa-wave35-b02052-json-restore');
    expect(useGameStateStore.getState().setGameState(restoredState)).toBe(true);
    const restored = useGameStateStore.getState().pendingEffectOptional;
    expect(restored?.source).toEqual(JSON.parse(JSON.stringify(first?.source)));
    expect(dispatchEngineAction(bindPendingDecision(restored!, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.source).toMatchObject({
      setCardId: B02052.id,
      setCardInstanceId: 'set:gun:base',
    });
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectOptional?.source).toMatchObject({
      setCardId: B02052P.id,
      setCardInstanceId: 'set:gun:parallel',
    });
  });

  it('keeps a rider origin through a resolver-owned set-card choice', () => {
    const state = baseWithSetCards([
      { cardId: B02052.id, instanceId: 'set:choice:source' },
      { cardId: B10018.id, instanceId: 'set:choice:target' },
    ]);
    const ctx: EffectCtx = {
      source: {
        player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
        setCardId: B02052.id, setCardInstanceId: 'set:choice:source',
      },
      bindings: {},
    };
    const paused = produce(state, draft => {
      runEffect(draft, {
        kind: 'setCardToEvidence', hostUid: 'host',
      }, ctx);
      persistPendingRuntimeState(draft);
    });
    install(paused, 'resolver-set-card-choice-origin');
    const choice = useGameStateStore.getState().pendingSetCardChoice;
    expect(choice?.source).toMatchObject({
      setCardId: B02052.id,
      setCardInstanceId: 'set:choice:source',
    });
    expect(JSON.parse(JSON.stringify(choice)).source).toEqual(choice?.source);
    expect(dispatchEngineAction(bindPendingDecision(choice!, {
      type: 'setCardChoiceResolve', instanceId: 'set:choice:target',
    }))).toEqual({ ok: true });
    expect(current().players.self.evidence.at(-1)?.cardId).toBe(B10018.id);
  });

  it('rejects a persisted set-card source unless both physical IDs are present', () => {
    const pending = {
      player: 'self',
      source: {
        cardId: HOST.id,
        uid: 'host',
        abilityId: 'a2',
        setCardId: B02052.id,
      },
    };
    expect(() => assertPendingRuntimeValue('__pendingEffectOptionalSide', pending, { mode: 'persisted' }))
      .toThrow(/set-card source requires both/i);
    expect(() => assertPendingRuntimeValue('__pendingEffectOptionalSide', {
      ...pending,
      source: {
        ...pending.source,
        setCardId: undefined,
        setCardInstanceId: 'set:choice:source',
      },
    }, { mode: 'persisted' })).toThrow(/set-card source requires both/i);
  });

  it.each(RUNTIME_WRITER_CASES.flatMap(kind => ([
    [kind, { setCardId: B02052.id }],
    [kind, { setCardInstanceId: 'set:writer:partial' }],
  ] as const)))('%s rejects a half-identified source before publishing a pending decision', (kind, partial) => {
    const state = baseWithSetCards([{ cardId: B02052.id, instanceId: 'set:writer:source' }]);
    state.players.self.hand = [HOST.id];
    const ctx: EffectCtx = {
      source: {
        player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
        ...partial,
      },
      bindings: {},
    };
    const beforeState = structuredClone(state);
    const beforeRuntime = snapshotPendingRuntimeState();

    expect(() => writePendingRuntime(kind, state, ctx)).toThrow(/set-card source requires both/i);
    expect(state).toEqual(beforeState);
    expect(snapshotPendingRuntimeState()).toEqual(beforeRuntime);
  });

  it.each(RUNTIME_WRITER_CASES)('%s preserves an exact source through persist, JSON, and store hydration', (kind) => {
    const state = baseWithSetCards([{ cardId: B02052.id, instanceId: 'set:writer:source' }]);
    state.players.self.hand = [HOST.id];
    const ctx: EffectCtx = {
      source: {
        player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
        setCardId: B02052.id, setCardInstanceId: 'set:writer:source',
      },
      bindings: {},
    };
    writePendingRuntime(kind, state, ctx);
    persistPendingRuntimeState(state);
    expect(persistedWriterSource(state, kind)).toMatchObject({
      setCardId: B02052.id,
      setCardInstanceId: 'set:writer:source',
    });

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    useGameStateStore.getState().setGameState(null);
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    expect(surfacedWriterSource(kind)).toMatchObject({
      setCardId: B02052.id,
      setCardInstanceId: 'set:writer:source',
    });

    for (const missing of ['setCardId', 'setCardInstanceId'] as const) {
      const forged = JSON.parse(JSON.stringify(restored)) as GameState;
      delete persistedWriterSource(forged, kind)[missing];
      const beforeStore = current();
      expect(() => useGameStateStore.getState().setGameState(forged))
        .toThrow(/set-card source requires both/i);
      expect(current()).toBe(beforeStore);
    }

    const blank = JSON.parse(JSON.stringify(restored)) as GameState;
    persistedWriterSource(blank, kind).setCardId = '';
    persistedWriterSource(blank, kind).setCardInstanceId = '';
    const beforeStore = current();
    expect(() => useGameStateStore.getState().setGameState(blank))
      .toThrow(/non-empty string/i);
    expect(current()).toBe(beforeStore);
  });

  it.each(RUNTIME_WRITER_CASES)(
    '%s preserves and validates an exact host occurrence through persistence',
    (kind) => {
      const state = createEmptyGameState();
      state.players.self.hand = [HOST.id];
      const ctx: EffectCtx = {
        source: {
          player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
          abilityOrigin: 'granted', abilityIndex: 0,
        },
        bindings: {},
      };
      writePendingRuntime(kind, state, ctx);
      persistPendingRuntimeState(state);
      expect(persistedWriterSource(state, kind)).toMatchObject({
        abilityOrigin: 'granted', abilityIndex: 0,
      });

      const restored = JSON.parse(JSON.stringify(state)) as GameState;
      useGameStateStore.getState().setGameState(null);
      expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
      expect(surfacedWriterSource(kind)).toMatchObject({
        abilityOrigin: 'granted', abilityIndex: 0,
      });

      for (const missing of ['abilityOrigin', 'abilityIndex'] as const) {
        const forged = JSON.parse(JSON.stringify(restored)) as GameState;
        delete persistedWriterSource(forged, kind)[missing];
        const beforeStore = current();
        expect(() => useGameStateStore.getState().setGameState(forged))
          .toThrow(/declared-ability source requires both/i);
        expect(current()).toBe(beforeStore);
      }
    },
  );

  it('rejects a persisted host occurrence swapped away from its stack authority', () => {
    const state = createEmptyGameState();
    state.players.self.hand = [HOST.id];
    const source = {
      player: 'self' as const,
      area: 'scene' as const,
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      abilityOrigin: 'granted' as const,
      abilityIndex: 0,
    };
    event.queue(state, { kind: 'atom', verb: 'noop', args: {} }, source);
    writePendingRuntime('optional', state, { source, bindings: {} });
    persistPendingRuntimeState(state);

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    const forged = JSON.parse(JSON.stringify(restored)) as GameState;
    persistedWriterSource(forged, 'optional').abilityOrigin = 'printed';
    const beforeStore = current();
    expect(() => useGameStateStore.getState().setGameState(forged))
      .toThrow(/declared-ability host source.*authority/i);
    expect(current()).toBe(beforeStore);

    for (const [field, value] of [
      ['cardId', 'FORGED-CARD'],
      ['abilityId', 'forged-ability'],
      ['uid', 'forged-uid'],
      ['area', 'hand'],
    ] as const) {
      const forgedLineage = JSON.parse(JSON.stringify(restored)) as GameState;
      persistedWriterSource(forgedLineage, 'optional')[field] = value;
      expect(() => useGameStateStore.getState().setGameState(forgedLineage))
        .toThrow(/declared-ability host source.*authority/i);
      expect(current()).toBe(beforeStore);
    }

    const forgedIndex = JSON.parse(JSON.stringify(restored)) as GameState;
    persistedWriterSource(forgedIndex, 'optional').abilityIndex = 1;
    expect(() => useGameStateStore.getState().setGameState(forgedIndex))
      .toThrow(/declared-ability host source.*authority/i);
    expect(current()).toBe(beforeStore);
  });

  it('hydrates and completes a coherent legacy index-1 host but rejects index-0 mixing', () => {
    const state = createEmptyGameState();
    const source = {
      player: 'self' as const,
      area: 'scene' as const,
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      abilityOrigin: 'printed' as const,
      abilityIndex: 1,
    };
    event.queue(state, { kind: 'atom', verb: 'noop', args: {} }, source);
    writePendingRuntime('optional', state, { source, bindings: {} });
    persistPendingRuntimeState(state);

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    const mixed = JSON.parse(JSON.stringify(restored)) as GameState;
    persistedWriterSource(mixed, 'optional').abilityIndex = 0;
    expect(() => useGameStateStore.getState().setGameState(mixed))
      .toThrow(/declared-ability host source.*authority/i);

    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({
      cardId: HOST.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
    });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
  });

  it('matches an active descendant tail and rejects same-root sibling or completed traces', () => {
    const state = createEmptyGameState();
    const source = {
      player: 'self' as const,
      area: 'scene' as const,
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      abilityOrigin: 'granted' as const,
      abilityIndex: 0,
    };
    startCausalSession(state, 'wave64-causal');
    resetPresentationQueue('wave64-causal');
    const root = appendCausal(state, {
      actor: 'self', kind: 'declare', targets: [], outcome: { type: 'state', state: 'active' },
    });
    const stackTail = appendCausal(state, {
      actor: 'self', kind: 'select', parentEventId: root.eventId,
      targets: [], outcome: { type: 'state', state: 'success' },
    });
    const decisionTail = appendCausal(state, {
      actor: 'self', kind: 'select', parentEventId: stackTail.eventId,
      targets: [], outcome: { type: 'state', state: 'success' },
    });
    const siblingTail = appendCausal(state, {
      actor: 'self', kind: 'select', parentEventId: root.eventId,
      targets: [], outcome: { type: 'state', state: 'success' },
    });
    const correlatedRoot = appendCausal(state, {
      actor: 'self', kind: 'declare', correlationEventId: stackTail.eventId,
      targets: [], outcome: { type: 'state', state: 'active' },
    });
    const correlatedTail = appendCausal(state, {
      actor: 'self', kind: 'select', parentEventId: correlatedRoot.eventId,
      targets: [], outcome: { type: 'state', state: 'success' },
    });
    event.queue(
      state,
      { kind: 'atom', verb: 'noop', args: {} },
      source,
      'manual',
      undefined,
      undefined,
      { causalTrace: { rootEventId: root.eventId, tailEventId: stackTail.eventId } },
    );
    writePendingRuntime('optional', state, {
      source,
      bindings: {},
      causal: {
        trace: {
          rootEventId: root.eventId,
          tailEventId: decisionTail.eventId,
          awaitingResume: true,
        },
      },
    });
    const pendingOptional = (globalThis as {
      __pendingEffectOptionalSide?: { source?: Record<string, unknown> } | null;
    }).__pendingEffectOptionalSide;
    if (!pendingOptional?.source) throw new Error('missing causal optional source');
    pendingOptional.source.causalTrace = {
      rootEventId: root.eventId,
      tailEventId: decisionTail.eventId,
      awaitingResume: true,
    };
    persistPendingRuntimeState(state);

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
    expect(persistedWriterSource(restored, 'optional').causalTrace).toMatchObject({
      rootEventId: root.eventId,
      tailEventId: decisionTail.eventId,
    });

    const sibling = JSON.parse(JSON.stringify(restored)) as GameState;
    const siblingTrace = persistedWriterSource(sibling, 'optional').causalTrace as Record<string, unknown>;
    siblingTrace.tailEventId = siblingTail.eventId;
    const beforeStore = current();
    expect(() => useGameStateStore.getState().setGameState(sibling))
      .toThrow(/declared-ability host source.*authority/i);
    expect(current()).toBe(beforeStore);

    const correlated = JSON.parse(JSON.stringify(restored)) as GameState;
    const correlatedTrace = persistedWriterSource(correlated, 'optional').causalTrace as Record<string, unknown>;
    correlatedTrace.tailEventId = correlatedTail.eventId;
    expect(() => useGameStateStore.getState().setGameState(correlated))
      .toThrow(/declared-ability host source.*authority/i);
    expect(current()).toBe(beforeStore);

    const completed = JSON.parse(JSON.stringify(restored)) as GameState;
    const completedTrace = persistedWriterSource(completed, 'optional').causalTrace as Record<string, unknown>;
    delete completedTrace.awaitingResume;
    completedTrace.completed = true;
    expect(() => useGameStateStore.getState().setGameState(completed))
      .toThrow(/declared-ability host source.*authority/i);
    expect(current()).toBe(beforeStore);
  });

  it.each([
    ['event.queue', { setCardId: B02052.id }],
    ['event.queue', { setCardInstanceId: 'set:queue:partial' }],
    ['buildEntry', { setCardId: B02052.id }],
    ['buildEntry', { setCardInstanceId: 'set:build:partial' }],
  ] as const)('%s rejects a half-identified set-card source before mutating stack state', (api, partial) => {
    const state = createEmptyGameState();
    const effect = { kind: 'atom', verb: 'noop', args: {} } as const;
    const source = {
      player: 'self' as const,
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      ...partial,
    };
    const before = structuredClone(state);

    expect(() => {
      if (api === 'event.queue') event.queue(state, effect, source);
      else buildEntry(state, effect, { source });
    }).toThrow(/set-card source requires both/i);
    expect(state).toEqual(before);
  });

  it.each(['event.queue', 'buildEntry'] as const)(
    '%s rejects a blank set-card source before mutating stack state',
    (api) => {
      const state = createEmptyGameState();
      const effect = { kind: 'atom', verb: 'noop', args: {} } as const;
      const source = {
        player: 'self' as const,
        cardId: HOST.id,
        uid: 'host',
        abilityId: 'a2',
        setCardId: '',
        setCardInstanceId: '',
      };
      const before = structuredClone(state);

      expect(() => {
        if (api === 'event.queue') event.queue(state, effect, source);
        else buildEntry(state, effect, { source });
      }).toThrow(/non-empty string/i);
      expect(state).toEqual(before);
    },
  );

  it.each(['no-listener', 'effect-listener'] as const)(
    'event.emit rejects a half-identified set-card source atomically with %s',
    (listenerKind) => {
      event._resetRegistry();
      const state = createEmptyGameState();
      if (listenerKind === 'effect-listener') {
        event.on('turn:start', () => ({ kind: 'atom', verb: 'noop', args: {} }));
      }
      const before = structuredClone(state);

      expect(() => event.emit(state, 'turn:start', { player: 'self' }, {
        player: 'self', cardId: HOST.id, uid: 'host', abilityId: 'a2', setCardId: B02052.id,
      })).toThrow(/set-card source requires both/i);
      expect(state).toEqual(before);
    },
  );

  it.each(['hand', 'deck'] as const)(
    'keeps the exact set-card source on a public %s reveal through JSON hydration',
    (kind) => {
      const state = baseWithSetCards([{ cardId: B02052.id, instanceId: 'set:reveal:source' }]);
      state.players.self.hand = [HOST.id];
      state.players.self.deck = [HOST.id];
      const ctx: EffectCtx = {
        source: {
          player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
          setCardId: B02052.id, setCardInstanceId: 'set:reveal:source',
        },
        bindings: {},
      };
      if (kind === 'hand') {
        runEffect(state, {
          kind: 'atom', verb: 'handReveal',
          args: { player: 'self', all: true, audience: 'all', lifetime: 'presentation' },
        }, ctx);
      } else {
        runEffect(state, {
          kind: 'atom', verb: 'deckRevealUntil',
          args: { player: 'self', maxN: 1, bind: 'revealed', presentation: 'reveal-return' },
        }, ctx);
      }
      persistPendingRuntimeState(state);
      const restored = JSON.parse(JSON.stringify(state)) as GameState;
      useGameStateStore.getState().setGameState(null);

      expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
      const source = kind === 'hand'
        ? useGameStateStore.getState().pendingPublicHandReveal?.source
        : useGameStateStore.getState().pendingDeckReveal?.source;
      expect(source).toMatchObject({
        cardId: HOST.id,
        uid: 'host',
        abilityId: 'a2',
        setCardId: B02052.id,
        setCardInstanceId: 'set:reveal:source',
      });
    },
  );

  it.each(['hand', 'deck'] as const)(
    'keeps the exact host occurrence on a public %s reveal through JSON hydration',
    (kind) => {
      const state = createEmptyGameState();
      state.players.self.hand = [HOST.id];
      state.players.self.deck = [HOST.id];
      const ctx: EffectCtx = {
        source: {
          player: 'self', area: 'scene', cardId: HOST.id, uid: 'host', abilityId: 'a2',
          abilityOrigin: 'granted', abilityIndex: 0,
        },
        bindings: {},
      };
      if (kind === 'hand') {
        runEffect(state, {
          kind: 'atom', verb: 'handReveal',
          args: { player: 'self', all: true, audience: 'all', lifetime: 'presentation' },
        }, ctx);
      } else {
        runEffect(state, {
          kind: 'atom', verb: 'deckRevealUntil',
          args: { player: 'self', maxN: 1, bind: 'revealed', presentation: 'reveal-return' },
        }, ctx);
      }
      persistPendingRuntimeState(state);
      const restored = JSON.parse(JSON.stringify(state)) as GameState;
      useGameStateStore.getState().setGameState(null);

      expect(useGameStateStore.getState().setGameState(restored)).toBe(true);
      const source = kind === 'hand'
        ? useGameStateStore.getState().pendingPublicHandReveal?.source
        : useGameStateStore.getState().pendingDeckReveal?.source;
      expect(source).toMatchObject({
        cardId: HOST.id,
        uid: 'host',
        abilityId: 'a2',
        abilityOrigin: 'granted',
        abilityIndex: 0,
      });
    },
  );

  it('replaces only the matching physical occurrence in the deck-reveal FIFO', () => {
    while (_drainPendingDeckRevealSide()) { /* clear ambient test channel */ }
    const source = (instanceId: string) => ({
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      setCardId: B02052.id,
      setCardInstanceId: instanceId,
    });
    const side = (instanceId: string, awaitingPick: boolean) => ({
      player: 'self' as const,
      visibility: 'public' as const,
      viewer: 'all' as const,
      revealed: [HOST.id],
      matched: awaitingPick ? null : HOST.id,
      ...(awaitingPick ? { awaitingPick: true } : {}),
      source: source(instanceId),
    });
    queuePendingDeckRevealSide(side('set:reveal:first', true));
    queuePendingDeckRevealSide(side('set:reveal:second', true));
    queuePendingDeckRevealSide(side('set:reveal:second', false));

    expect(_drainPendingDeckRevealSide()).toMatchObject({
      awaitingPick: true,
      source: { setCardInstanceId: 'set:reveal:first' },
    });
    expect(_drainPendingDeckRevealSide()).toMatchObject({
      matched: HOST.id,
      source: { setCardInstanceId: 'set:reveal:second' },
    });
    expect(_drainPendingDeckRevealSide()).toBeNull();
  });

  it('lists and publicly consumes each B07014 turn limit independently', () => {
    const state = baseWithSetCards([
      { cardId: B07014.id, instanceId: 'set:fax:base' },
      { cardId: B07014P.id, instanceId: 'set:fax:parallel' },
    ]);
    install(state, 'B07014');

    expect(enumDeclaredAbilityChoicesFor(state, 'host').map(choice => ({
      abilId: choice.abilId,
      setCardId: choice.setCardId,
      setCardInstanceId: choice.setCardInstanceId,
    }))).toEqual([
      { abilId: 'a3', setCardId: B07014.id, setCardInstanceId: 'set:fax:base' },
      { abilId: 'a3', setCardId: B07014P.id, setCardInstanceId: 'set:fax:parallel' },
    ]);
    expect(enumerateMoves(state, 'self').filter(move => move.kind === 'declaredAbility')).toEqual([
      { kind: 'declaredAbility', uid: 'host', abilityId: 'a3', setCardId: B07014.id, setCardInstanceId: 'set:fax:base' },
      { kind: 'declaredAbility', uid: 'host', abilityId: 'a3', setCardId: B07014P.id, setCardInstanceId: 'set:fax:parallel' },
    ]);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'host', abilId: 'a3' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'host', abilId: 'a3',
      setCardId: B07014.id, setCardInstanceId: 'set:fax:base',
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'host', abilId: 'a3',
      setCardId: B07014.id, setCardInstanceId: 'set:fax:base',
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'host', abilId: 'a3',
      setCardId: B07014P.id, setCardInstanceId: 'set:fax:parallel',
    })).toEqual({ ok: true });

    expect(current().players.self.scene[0]!.setCards.map(entry => entry.abilityUseCounts?.a3))
      .toEqual([{ turn: 4, count: 1 }, { turn: 4, count: 1 }]);
    expect(current().players.self.scene[0]!.declaredUseCount.a3).toBeUndefined();
  });

  it.each([
    ['B07014/B07014', [B07014.id, B07014.id]],
    ['B07014P/B07014P', [B07014P.id, B07014P.id]],
  ] as const)('%s keeps same-printing turn limits independent', (_label, cardIds) => {
    const state = baseWithSetCards(cardIds.map((cardId, index) => ({
      cardId,
      instanceId: `set:fax:same:${index + 1}`,
    })));
    install(state, `same-fax-${cardIds[0]}`);
    for (let index = 0; index < cardIds.length; index += 1) {
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'host', abilId: 'a3',
        setCardId: cardIds[index], setCardInstanceId: `set:fax:same:${index + 1}`,
      })).toEqual({ ok: true });
    }
    expect(current().players.self.scene[0]!.setCards.map(entry => entry.abilityUseCounts?.a3))
      .toEqual([{ turn: 4, count: 1 }, { turn: 4, count: 1 }]);
  });

  it('keeps printed, granted, and rider abilities with the same ID on their correct authority', async () => {
    let state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.deck = [HOST.id, HOST.id, HOST.id];
    state.players.self.scene = [sceneChar(COLLISION_HOST.id, 'collision-host', {
      setCards: [{ cardId: B07014.id, faceUp: true, instanceId: 'set:fax:collision' }],
    })];
    const grantedAbility = {
      id: 'a3', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      description: 'granted a3', ruleRefs: [],
    } as const;
    state = produce(state, draft => runEffect(draft, {
      kind: 'atom', verb: 'charGrantAbility',
      args: { uid: 'collision-host', ability: grantedAbility },
    }, {
      source: {
        player: 'self', area: 'scene', cardId: COLLISION_HOST.id,
        uid: 'collision-host', abilityId: 'grant-a3',
      },
      bindings: {},
    }));

    expect(findDeclaredAbilityOccurrences(
      state, 'collision-host', COLLISION_HOST.id, 'scene', 'a3',
    ).map(({ origin, abilityIndex }) => ({ origin, abilityIndex }))).toEqual([
      { origin: 'printed', abilityIndex: 0 },
      { origin: 'granted', abilityIndex: 0 },
      { origin: 'set-card', abilityIndex: undefined },
    ]);
    const moves = enumerateMoves(state, 'self').filter(
      (move): move is Extract<Move, { kind: 'declaredAbility' }> => (
        move.kind === 'declaredAbility'
        && move.uid === 'collision-host'
        && move.abilityId === 'a3'
      ),
    );
    const hostMoves = moves.filter(move => move.setCardInstanceId === undefined);
    const riderMove = moves.find(move => move.setCardInstanceId === 'set:fax:collision');
    expect(hostMoves).toEqual([
      {
        kind: 'declaredAbility', uid: 'collision-host', abilityId: 'a3',
        abilityOrigin: 'printed', abilityIndex: 0,
      },
      {
        kind: 'declaredAbility', uid: 'collision-host', abilityId: 'a3',
        abilityOrigin: 'granted', abilityIndex: 0,
      },
    ]);
    expect(riderMove).toEqual({
      kind: 'declaredAbility', uid: 'collision-host', abilityId: 'a3',
      setCardId: B07014.id, setCardInstanceId: 'set:fax:collision',
    });

    const aiHost = produce(state, draft => {
      applyMove(draft, hostMoves[1]!, 'self');
      runAllUntilEmpty(draft);
    });
    expect(aiHost.players.self.hand).toHaveLength(2);
    expect(aiHost.players.self.scene[0]!.declaredUseCount.a3).toBeUndefined();
    expect(aiHost.players.self.scene[0]!.setCards[0]!.abilityUseCounts?.a3).toBeUndefined();
    expect(canDeclaredAbility(aiHost, 'collision-host', 'a3', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(true);
    expect(canDeclaredAbility(aiHost, 'collision-host', 'a3', {
      abilityOrigin: 'granted', abilityIndex: 0,
    })).toBe(false);
    const aiBothHostOccurrences = produce(aiHost, draft => {
      applyMove(draft, hostMoves[0]!, 'self');
      runAllUntilEmpty(draft);
    });
    expect(aiBothHostOccurrences.players.self.hand).toHaveLength(3);
    expect(canDeclaredAbility(aiBothHostOccurrences, 'collision-host', 'a3', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(false);
    const aiRider = produce(state, draft => applyMove(draft, riderMove!, 'self'));
    expect(aiRider.players.self.scene[0]!.declaredUseCount.a3).toBeUndefined();
    expect(aiRider.players.self.scene[0]!.setCards[0]!.abilityUseCounts?.a3)
      .toEqual({ turn: 4, count: 1 });

    install(structuredClone(state), 'ability-id-collision-host-legacy');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'collision-host', abilId: 'a3',
    })).toEqual({ ok: true });
    expect(current().players.self.hand).toHaveLength(1);
    expect(readChar.declaredUseCount(current(), 'collision-host', 'a3', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
    expect(current().players.self.scene[0]!.setCards[0]!.abilityUseCounts?.a3).toBeUndefined();

    install(structuredClone(state), 'ability-id-collision-ui-flow');
    const flowResult = runDeclaredAbilityFlow({ player: 'self' });
    await chooseSource('collision-host');
    expect(useChoicePickerStore.getState().current?.options).toHaveLength(3);
    await chooseAbility(1);
    await confirmAbility();
    await expect(flowResult).resolves.toEqual({ ok: true });
    expect(current().players.self.hand).toHaveLength(2);

    install(structuredClone(state), 'ability-id-collision-rider');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'collision-host', abilId: 'a3',
      setCardId: B07014.id, setCardInstanceId: 'set:fax:collision',
    })).toEqual({ ok: true });
    const host = current().players.self.scene[0]!;
    expect(host.declaredUseCount.a3).toBeUndefined();
    expect(host.setCards[0]!.abilityUseCounts?.a3).toEqual({ turn: 4, count: 1 });
  });

  it('preserves exact rider IDs through AI applyMove, JSON, and legacy replay rejection', () => {
    const state = baseWithSetCards([
      { cardId: B07014.id, instanceId: 'set:fax:ai:1' },
      { cardId: B07014P.id, instanceId: 'set:fax:ai:2' },
    ]);
    const moves = enumerateMoves(state, 'self').filter(
      (move): move is Extract<Move, { kind: 'declaredAbility' }> => move.kind === 'declaredAbility',
    );
    const exact = JSON.parse(JSON.stringify(moves[1])) as Extract<Move, { kind: 'declaredAbility' }>;
    const policy = new ScriptedPolicy('wave35-exact', [exact]);
    expect(policy.choose(state, moves, 'self')).toEqual(moves[1]);

    const after = produce(state, draft => applyMove(draft, exact, 'self'));
    expect(after.players.self.scene[0]!.setCards.map(entry => entry.abilityUseCounts?.a3))
      .toEqual([undefined, { turn: 4, count: 1 }]);

    const legacy = { kind: 'declaredAbility', uid: 'host', abilityId: 'a3' } as const;
    const legacyPolicy = new ScriptedPolicy('wave35-legacy', [legacy]);
    expect(() => legacyPolicy.choose(state, moves, 'self'))
      .toThrow('recorded replay move is not legal');
  });

  it('backfills legacy set-card instance IDs before AI move enumeration', () => {
    const state = baseWithSetCards([{ cardId: B07014.id, instanceId: 'legacy-placeholder' }]);
    delete (state.players.self.scene[0]!.setCards[0] as { instanceId?: string }).instanceId;
    delete state.setCardInstanceSeq;
    let candidates: Move[] = [];
    const policy: AIPolicy = {
      name: 'wave35-legacy-capture',
      choose: (_state, legalMoves) => {
        candidates = legalMoves;
        return legalMoves.find(move => move.kind === 'endTurn') ?? null;
      },
    };

    const result = stepTurn(state, policy, 'self');
    const rider = candidates.find((move): move is Extract<Move, { kind: 'declaredAbility' }> => (
      move.kind === 'declaredAbility' && move.setCardId === B07014.id
    ));
    expect(rider?.setCardInstanceId).toEqual(expect.any(String));
    expect(result.nextState.players.self.scene[0]!.setCards[0]!.instanceId)
      .toBe(rider?.setCardInstanceId);
  });

  it('fails closed for a legacy setcard:leave payload without physical instance identity', () => {
    const state = createEmptyGameState();
    state.turn.player = 'opp';
    expect(() => event.emit(state, 'setcard:leave', {
      player: 'self', hostUid: 'host', hostCardId: HOST.id,
      setCardId: B02084.id, faceUp: true, cause: 'legacy-save',
    })).not.toThrow();
    expect(state.pendingEffects).toEqual([]);
  });

  it('rejects missing, partial, stale, and cross-host rider sources atomically', () => {
    const state = baseWithSetCards([{
      cardId: B07014.id,
      instanceId: 'set:fax:base',
    }]);
    state.players.self.scene.push(sceneChar(HOST.id, 'other-host', {
      setCards: [{ cardId: B07014.id, faceUp: true, instanceId: 'set:fax:other' }],
    }));
    const exact = {
      setCardId: B07014.id,
      setCardInstanceId: 'set:fax:base',
    };
    expect(canDeclaredAbility(state, 'host', 'a3')).toBe(false);
    expect(canActivateDeclaredAbility(state, 'host', 'a3', undefined, { sourceRef: exact })).toBe(true);

    const rejected = [
      undefined,
      { setCardId: B07014.id },
      { setCardInstanceId: 'set:fax:base' },
      { setCardId: B07014P.id, setCardInstanceId: 'set:fax:base' },
      { setCardId: B07014.id, setCardInstanceId: 'set:fax:other' },
      { setCardId: B07014.id, setCardInstanceId: 'set:fax:removed' },
    ];
    const before = structuredClone(state);
    for (const sourceRef of rejected) {
      expect(canActivateDeclaredAbility(state, 'host', 'a3', undefined, { sourceRef })).toBe(false);
      activateDeclaredAbility(state, 'host', 'a3', undefined, sourceRef);
    }
    useDeclaredAbility(state, 'host', 'a3');
    useDeclaredAbility(state, 'host', 'a3', {
      source: {
        cardId: HOST.id,
        uid: 'host',
        abilityId: 'a3',
        player: 'self',
        area: 'scene',
        setCardId: B07014.id,
        setCardInstanceId: 'set:fax:removed',
      },
    });
    expect(state).toEqual(before);

    const faceDown = structuredClone(state);
    faceDown.players.self.scene[0]!.setCards[0]!.faceUp = false;
    expect(canActivateDeclaredAbility(faceDown, 'host', 'a3', undefined, { sourceRef: exact })).toBe(false);
    faceDown.players.self.scene[0]!.setCards = [];
    expect(canActivateDeclaredAbility(faceDown, 'host', 'a3', undefined, { sourceRef: exact })).toBe(false);
  });

  it('keeps B10017 shoe origin separate from each exact belt payment', () => {
    const state = baseWithSetCards([
      { cardId: B10017.id, instanceId: 'set:shoe:base' },
      { cardId: B10017P.id, instanceId: 'set:shoe:parallel' },
      { cardId: B10018.id, instanceId: 'set:belt:base' },
      { cardId: B10018P.id, instanceId: 'set:belt:parallel' },
    ]);
    install(state, 'B10017');

    const first = {
      type: 'declaredAbility' as const,
      uid: 'host',
      abilId: 'a2',
      setCardId: B10017.id,
      setCardInstanceId: 'set:shoe:base',
      costParams: {
        paymentMode: 'printed' as const,
        removeSetCard: { hostUids: ['host'], instanceIds: ['set:belt:parallel'] },
      },
    };
    expect(dispatchEngineAction({ ...first, setCardInstanceId: 'set:shoe:forged' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    const beforeForgedBelt = structuredClone(current());
    expect(dispatchEngineAction({
      ...first,
      costParams: {
        paymentMode: 'printed',
        removeSetCard: { hostUids: ['host'], instanceIds: ['set:belt:forged'] },
      },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toEqual(beforeForgedBelt);
    expect(dispatchEngineAction(first)).toEqual({ ok: true });

    const afterFirst = current().players.self.scene[0]!;
    expect(afterFirst.setCards.map(entry => entry.instanceId)).toEqual([
      'set:shoe:base', 'set:shoe:parallel', 'set:belt:base',
    ]);
    expect(afterFirst.setCards[0]!.abilityUseCounts?.a2).toEqual({ turn: 4, count: 1 });
    expect(afterFirst.setCards[1]!.abilityUseCounts?.a2).toBeUndefined();
    expect(current().pendingEffects.every(entry => (
      entry.source.setCardInstanceId !== 'set:shoe:base'
      || entry.source.setCardId === B10017.id
    ))).toBe(true);

    // B10017's optional target decision serializes the next main action. Skip
    // it before declaring the independent parallel shoe occurrence.
    const firstPick = useGameStateStore.getState().pendingEffectPick;
    expect(firstPick).not.toBeNull();
    expect(firstPick!.source).toMatchObject({
      cardId: HOST.id,
      uid: 'host',
      abilityId: 'a2',
      setCardId: B10017.id,
      setCardInstanceId: 'set:shoe:base',
    });
    expect(JSON.parse(JSON.stringify(firstPick)).source).toEqual(firstPick!.source);
    expect(dispatchEngineAction(bindPendingDecision(firstPick!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'host', abilId: 'a2',
      setCardId: B10017P.id, setCardInstanceId: 'set:shoe:parallel',
      costParams: {
        paymentMode: 'printed',
        removeSetCard: { hostUids: ['host'], instanceIds: ['set:belt:base'] },
      },
    })).toEqual({ ok: true });
    expect(current().players.self.remove).toEqual([B10018P.id, B10018.id]);
    expect(current().players.self.scene[0]!.setCards.map(entry => entry.abilityUseCounts?.a2))
      .toEqual([{ turn: 4, count: 1 }, { turn: 4, count: 1 }]);
    expect(current().players.self.scene[0]!.declaredUseCount.a2).toBeUndefined();
  });

  it.each([
    ['B10017/B10017', [B10017.id, B10017.id]],
    ['B10017P/B10017P', [B10017P.id, B10017P.id]],
  ] as const)('%s keeps same-printing shoe uses independent', (_label, shoeIds) => {
    const state = baseWithSetCards([
      ...shoeIds.map((cardId, index) => ({ cardId, instanceId: `set:shoe:same:${index + 1}` })),
      { cardId: B10018.id, instanceId: 'set:belt:same:1' },
      { cardId: B10018P.id, instanceId: 'set:belt:same:2' },
    ]);
    install(state, `same-shoe-${shoeIds[0]}`);
    for (let index = 0; index < shoeIds.length; index += 1) {
      expect(dispatchEngineAction({
        type: 'declaredAbility', uid: 'host', abilId: 'a2',
        setCardId: shoeIds[index], setCardInstanceId: `set:shoe:same:${index + 1}`,
        costParams: {
          paymentMode: 'printed',
          removeSetCard: { hostUids: ['host'], instanceIds: [`set:belt:same:${index + 1}`] },
        },
      })).toEqual({ ok: true });
      const pick = useGameStateStore.getState().pendingEffectPick;
      expect(pick).not.toBeNull();
      expect(dispatchEngineAction(bindPendingDecision(pick!, {
        type: 'effectPickResolve', pickedUid: null,
      }))).toEqual({ ok: true });
    }
    expect(current().players.self.scene[0]!.setCards.map(entry => entry.abilityUseCounts?.a2))
      .toEqual([{ turn: 4, count: 1 }, { turn: 4, count: 1 }]);
  });

  it('carries the chosen shoe occurrence through the full modal and cost flow', async () => {
    const state = baseWithSetCards([
      { cardId: B10017.id, instanceId: 'set:shoe:flow:1' },
      { cardId: B10017P.id, instanceId: 'set:shoe:flow:2' },
      { cardId: B10018.id, instanceId: 'set:belt:flow:1' },
      { cardId: B10018P.id, instanceId: 'set:belt:flow:2' },
    ]);
    install(state, 'B10017-full-flow');

    const flow = runDeclaredAbilityFlow({ player: 'self' });
    await chooseSource('host');
    expect(useChoicePickerStore.getState().current?.options).toHaveLength(2);
    await chooseAbility(1);
    await confirmAbility();
    expect(useGameStateStore.getState().pendingSetCardChoice?.entries.map(entry => entry.instanceId))
      .toEqual(['set:belt:flow:1', 'set:belt:flow:2']);
    toggleSetCardCostChoice('set:belt:flow:1');
    confirmSetCardCostChoice();
    await tick();

    expect(await flow).toEqual({ ok: true });
    const host = current().players.self.scene[0]!;
    expect(host.setCards.find(entry => entry.instanceId === 'set:shoe:flow:1')?.abilityUseCounts?.a2)
      .toBeUndefined();
    expect(host.setCards.find(entry => entry.instanceId === 'set:shoe:flow:2')?.abilityUseCounts?.a2)
      .toEqual({ turn: 4, count: 1 });
    expect(current().players.self.remove).toContain(B10018.id);
  });

  it('keeps exact on-set-self origins for leave and phase-end triggers', () => {
    const leaveState = baseWithSetCards([{
      cardId: B02084.id,
      instanceId: 'set:self:leave',
    }]);
    leaveState.turn.player = 'opp';
    mutate.scene.removeToRemove(leaveState, 'host', 'effect');
    const leaveEntry = leaveState.pendingEffects.find(entry => (
      entry.triggeredBy.hook === 'setcard:leave' && entry.source.cardId === B02084.id
    ));
    expect(leaveEntry?.source).toMatchObject({
      uid: 'host',
      setCardId: B02084.id,
      setCardInstanceId: 'set:self:leave',
    });

    const phaseState = baseWithSetCards([{
      cardId: B06012.id,
      instanceId: 'set:self:phase',
    }]);
    event.emit(phaseState, 'phase:end:start', { player: 'self' });
    const phaseEntry = phaseState.pendingEffects.find(entry => (
      entry.triggeredBy.hook === 'phase:end:start' && entry.source.cardId === B06012.id
    ));
    expect(phaseEntry?.source).toMatchObject({
      uid: 'host',
      setCardId: B06012.id,
      setCardInstanceId: 'set:self:phase',
    });
  });
});
