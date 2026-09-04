// qa: card:B01011:b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce
// qa: card:B01050:b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce
// qa: card:B01052:b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce
// qa: card:B03120:b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce
// qa: card:PR180:b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce
// qa: card:PR186:b294bc57d842a4b1a4aae0d72a5235a9ace1fc0a3c60e43df68c9e6c939153ce
// Rules: 03-field-areas, 15-abilities-effects, 17-icons.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, def as readDef, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [
  'B01011',
  'B01050',
  'B01052',
  'B03120',
  'PR180',
  'PR186',
  'D06016',
] as const;

const PUBLIC_FILLER = 'W85-PUBLIC-FILLER';

function sourceId(cardId: string): string {
  return `W85-SOURCE-${cardId}`;
}

function publicSource(cardId: string): CardDef {
  return {
    id: sourceId(cardId),
    no: `test/${sourceId(cardId)}`,
    kind: 'event',
    names: [sourceId(cardId)],
    colors: ['白'],
    level: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [{
      id: 'a1',
      type: 'triggered',
      scope: 'on-hand',
      trigger: {
        hook: 'effect:declared',
        selfOnly: true,
        matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use',
      },
      effect: {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'remove',
          viaEffect: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character' } },
            n: { min: 1, max: 1 },
            chooser: 'self',
          },
        },
      },
      description: 'Wave85 public effect-entry source.',
      ruleRefs: ['rules/15-abilities-effects.md'],
    }],
    ruleRefs: ['rules/15-abilities-effects.md'],
  } as CardDef;
}

const filler: CardDef = {
  id: PUBLIC_FILLER,
  no: `test/${PUBLIC_FILLER}`,
  kind: 'character',
  names: [PUBLIC_FILLER],
  colors: ['白'],
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

function effectEntry(cardId: string): Effect {
  return {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      cardId,
      from: 'remove',
      viaEffect: true,
    },
  } as Effect;
}

function sourceCtx(player: Player): EffectCtx {
  return {
    source: {
      player,
      cardId: 'W85-SOURCE',
      uid: `${player}-w85-source`,
      abilityId: 'a1',
      area: 'scene',
    },
    bindings: {},
  } as EffectCtx;
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  registerAll();
  register(filler);
  ROWS.map(publicSource).forEach(register);
  registerTriggeredListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave85 public state');
  return state;
}

function preparedPublic(cardId: string, owner: Player, fullScene = false): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 29, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  const player = state.players[owner];
  player.case.colors = ['青', '緑', '白', '黄', '赤', '黒'];
  player.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: PUBLIC_FILLER }));
  player.hand = [sourceId(cardId)];
  player.remove = [cardId];
  player.deck = [];
  if (fullScene) {
    player.scene = Array.from({ length: 5 }, (_value, index) => sceneChar(
      PUBLIC_FILLER,
      index === 0 ? `${owner}-w85-victim` : `${owner}-w85-fill-${index}`,
      { state: index === 0 ? 'stun' : 'active' },
    ));
  }
  return state;
}

function installPublic(state: GameState, label: string, human: Player): void {
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-w85-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function openPublicEntry(cardId: string, owner: Player, fullScene = false) {
  installPublic(preparedPublic(cardId, owner, fullScene), `${cardId}-${owner}`, owner);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: sourceId(cardId) }))
    .toEqual({ ok: true });
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    player: owner,
    ownerPlayer: owner,
    atomVerb: 'sceneEnter',
    nMin: 1,
    nMax: 1,
    source: { cardId: sourceId(cardId), abilityId: 'a1' },
  });
  expect(pending?.candidates.map(candidate => candidate.cardId)).toEqual([cardId]);
  return pending!;
}

function clearPresentation(): void {
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
    surfacePendingSideChannels();
  }
}

function expectPublicSleep(cardId: string, owner: Player): void {
  for (let step = 0; step < 2; step += 1) {
    surfacePendingSideChannels();
    const emptyPick = useGameStateStore.getState().pendingEffectPick;
    if (!emptyPick) break;
    expect(emptyPick.candidates).toEqual([]);
    expect(emptyPick.nMin).toBe(0);
    expect(dispatchEngineAction(bindPendingDecision(emptyPick, {
      type: 'effectPickResolve',
      pickedUid: null,
    }))).toEqual({ ok: true });
  }
  clearPresentation();
  const entered = current().players[owner].scene.find(character => character.cardId === cardId);
  expect(entered?.state).toBe('sleep');
  expect(current().players[owner].remove).not.toContain(cardId);
  expect(current().players[owner].remove).toContain(sourceId(cardId));
  expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
}

describe('official QA Wave85: printed sleep state exists before enter observers run', () => {
  it.each(ROWS)('%s uses inherent sleep entry without a synthetic state-change ability', cardId => {
    const card = readDef.card(cardId)!;
    expect(card.entersSleep).toBe(true);
    expect(card.abilities.some(ability => (
      ability.trigger?.hook === 'enter'
      && ability.effect?.kind === 'atom'
      && ability.effect.verb === 'sceneSetState'
      && ability.effect.args.state === 'sleep'
    ))).toBe(false);
  });

  it.each(ROWS)('%s is already sleep when effect entry emits enter', cardId => {
    const stateAtEnter: string[] = [];
    let stateChanges = 0;
    event.on('enter', (state, payload) => {
      const uid = (payload as { uid?: string }).uid;
      const entered = state.players.self.scene.find(character => character.uid === uid);
      if (entered?.cardId === cardId) stateAtEnter.push(entered.state);
    });
    event.on('state:change', (_state, _payload, source) => {
      if (source?.cardId === cardId) stateChanges += 1;
    });

    let state = createEmptyGameState();
    state.players.self.remove = [cardId];
    state = produce(state, draft => {
      runEffect(draft, effectEntry(cardId), sourceCtx('self'));
      runAllUntilEmpty(draft);
    });

    expect(stateAtEnter, `${cardId}: no transient active state`).toEqual(['sleep']);
    expect(stateChanges, `${cardId}: inherent state emits no false transition`).toBe(0);
    expect(state.players.self.scene.find(character => character.cardId === cardId)?.state)
      .toBe('sleep');
  });

  it.each(ROWS)('%s enters asleep through public event resolution and fires only genuine enter abilities', cardId => {
    const stateAtEnter: string[] = [];
    let stateChanges = 0;
    event.on('enter', (state, payload) => {
      const uid = (payload as { uid?: string }).uid;
      const entered = state.players.self.scene.find(character => character.uid === uid);
      if (entered?.cardId === cardId) stateAtEnter.push(entered.state);
    });
    event.on('state:change', (_state, _payload, source) => {
      if (source?.cardId === cardId) stateChanges += 1;
    });
    const pending = openPublicEntry(cardId, 'self');
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: pending.candidates[0]!.uid,
    }))).toEqual({ ok: true });

    // Card-bound rows: B01011, B01050, B01052, B03120, PR180, PR186, D06016.
    expect(stateAtEnter).toEqual(['sleep']);
    expect(stateChanges).toBe(0);
    expectPublicSleep(cardId, 'self');
    const hasGenuineEnter = ['B01050', 'B01052', 'PR180', 'PR186', 'D06016'].includes(cardId);
    expect(current().pendingEffects.filter(entry => (
      entry.source.cardId === cardId && entry.source.abilityId === 'a2'
    ))).toHaveLength(hasGenuineEnter ? 1 : 0);
  });

  it('B01011 remains asleep after a full-scene public switch', () => {
    const stateAtEnter: string[] = [];
    event.on('enter', (state, payload) => {
      const uid = (payload as { uid?: string }).uid;
      const entered = state.players.self.scene.find(character => character.uid === uid);
      if (entered?.cardId === 'B01011') stateAtEnter.push(entered.state);
    });
    const pending = openPublicEntry('B01011', 'self', true);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: pending.candidates[0]!.uid,
      switchRemoveUid: 'self-w85-victim',
    }))).toEqual({ ok: true });
    expect(stateAtEnter).toEqual(['sleep']);
    expect(current().players.self.scene).toHaveLength(5);
    expect(current().players.self.scene.some(character => character.uid === 'self-w85-victim')).toBe(false);
    expectPublicSleep('B01011', 'self');
  });

  it('B01050 owner=opp gets the same pre-enter sleep state', () => {
    const stateAtEnter: string[] = [];
    event.on('enter', (state, payload) => {
      const uid = (payload as { uid?: string }).uid;
      const entered = state.players.opp.scene.find(character => character.uid === uid);
      if (entered?.cardId === 'B01050') stateAtEnter.push(entered.state);
    });
    const pending = openPublicEntry('B01050', 'opp');
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: pending.candidates[0]!.uid,
    }))).toEqual({ ok: true });
    expect(stateAtEnter).toEqual(['sleep']);
    expectPublicSleep('B01050', 'opp');
    expect(current().players.self.scene).toEqual([]);
  });

  it('B01050 pending effect entry reauthenticates after save hydration', () => {
    const stale = openPublicEntry('B01050', 'self');
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectPick!;
    expect(restored.decisionId).not.toBe(stale.decisionId);
    expect(restored.source).toMatchObject(stale.source);
    const target = restored.candidates[0]!;
    const beforeStale = current();
    const beforeStaleJson = JSON.stringify(beforeStale);
    expect(dispatchEngineAction(bindPendingDecision(stale, {
      type: 'effectPickResolve',
      pickedUid: target.uid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(beforeStale);
    expect(JSON.stringify(current())).toBe(beforeStaleJson);
    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'effectPickResolve',
      pickedUid: target.uid,
    }))).toEqual({ ok: true });
    expectPublicSleep('B01050', 'self');
  });

  it('B01050 CPU effect entry is sleep before observers and emits no state change', () => {
    const stateAtEnter: string[] = [];
    let stateChanges = 0;
    event.on('enter', (state, payload) => {
      const uid = (payload as { uid?: string }).uid;
      const entered = state.players.opp.scene.find(character => character.uid === uid);
      if (entered?.cardId === 'B01050') stateAtEnter.push(entered.state);
    });
    event.on('state:change', (_state, _payload, source) => {
      if (source?.cardId === 'B01050') stateChanges += 1;
    });
    const ctx: EffectCtx = {
      source: { player: 'opp', area: 'hand', cardId: sourceId('B01050'), abilityId: 'a1' },
      bindings: {},
    };
    const resolved = produce(preparedPublic('B01050', 'opp'), draft => {
      runEffect(draft, publicSource('B01050').abilities[0]!.effect!, ctx);
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft, {
        chooseAtomTarget: (_state, _verb, _args, candidates) => (
          candidates.find(candidate => candidate.cardId === 'B01050') ?? null
        ),
      });
    });

    expect(stateAtEnter).toEqual(['sleep']);
    expect(stateChanges).toBe(0);
    expect(resolved.players.opp.scene.find(character => character.cardId === 'B01050')?.state)
      .toBe('sleep');
    expect(resolved.pendingRuntimeState).toBeUndefined();
  });
});
