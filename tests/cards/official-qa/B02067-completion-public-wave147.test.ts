// qa: card:B02067:21d33c0a5eb6a0635654047e680572967ebce417be0fe911d4c8034e4df2390d
// qa: card:B02067:902ae020bffe46eda4b64ab1441669691d0923cda13d9d492cd512b7c8955439
// qa: card:B02067:b822c6a9835602983db3c2ca8e8adf2e9acbfce17ab31c293deddf61ca33487b
// qa: card:B02067:fdda495dd5c83ddcb58abe8348f40a601067c2389d2e526b243e204327809853

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02039 } from '@/cards/ct-p02/B02039';
import { B02067 } from '@/cards/ct-p02/B02067';
import { B02067P } from '@/cards/ct-p02/B02067P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SELECT_SOURCE = 'W147_SELECT_SOURCE';
const PROTECTED = 'W147_PROTECTED';
const OTHER_TARGET = 'W147_OTHER_TARGET';
const TOICHI = 'W147_TOICHI';
const DRAW_A = 'W147_DRAW_A';
const DRAW_B = 'W147_DRAW_B';
const DRAW_C = 'W147_DRAW_C';
const DRAW_D = 'W147_DRAW_D';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const SELECT_ABILITY: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      {
        kind: 'atom', verb: 'sceneSetState', args: {
          uid: '$pick', state: 'sleep',
          target: {
            kind: 'pick', query: { area: 'scene', side: 'opp' },
            n: { min: 2, max: 2 }, chooser: 'self',
          },
        },
      },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: 'Select two opposing characters, sleep them, then draw.',
  ruleRefs: ['rules/15-abilities-effects.md'],
};

const CHARACTER_BIND_ABILITY: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: '$target' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: 'Select one opposing character, then draw.',
  ruleRefs: ['rules/15-abilities-effects.md'],
};

const SELECTOR = fixture(SELECT_SOURCE, { abilities: [SELECT_ABILITY, CHARACTER_BIND_ABILITY] });
const ROWS = [
  { label: 'base-self', owner: 'self' as const, card: B02067 },
  { label: 'base-opp', owner: 'opp' as const, card: B02067 },
  { label: 'parallel-self', owner: 'self' as const, card: B02067P },
  { label: 'parallel-opp', owner: 'opp' as const, card: B02067P },
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave147 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(`qa-wave147-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function selectionBoard(owner: Player, card: CardDef): { state: GameState; source: Player } {
  const source = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 47, player: source, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[source].scene = [sceneChar(SELECTOR.id, 'selector')];
  state.players[source].deck = [DRAW_A, DRAW_B, DRAW_C, DRAW_D];
  state.players[owner].scene = [
    sceneChar(PROTECTED, 'protected', {
      setCards: [{ cardId: card.id, faceUp: true, instanceId: 'set-voice-changer' }],
    }),
    sceneChar(OTHER_TARGET, 'other-target'),
  ];
  return { state, source };
}

function resolveTwoTargets(): void {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: 'sceneSetState', nMin: 2, nMax: 2 });
  expect(pick?.candidates.map(candidate => candidate.uid)).toEqual(['protected', 'other-target']);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'protected', pickedUids: ['protected', 'other-target'],
  }))).toEqual({ ok: true });
}

function coldRestore(saved: GameState): void {
  useGameStateStore.getState().resetMatchSessionState();
  expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
  surfacePendingSideChannels();
}

function mutatePersistedBindPick(
  state: GameState,
  mutate: (args: Record<string, unknown>) => void,
): void {
  const visited = new WeakSet<object>();
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (record.atomVerb === 'bindPick' && record.atomArgs && typeof record.atomArgs === 'object') {
      mutate(record.atomArgs as Record<string, unknown>);
    }
    Object.values(record).forEach(visit);
  };
  visit(state.pendingRuntimeState?.snapshot);
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  [
    SELECTOR, fixture(PROTECTED), fixture(OTHER_TARGET), fixture(TOICHI, { names: ['黒羽盗一'] }),
    fixture(DRAW_A), fixture(DRAW_B), fixture(DRAW_C), fixture(DRAW_D),
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave147: B02067 cancels the selected remainder as one effect', () => {
  it.each(ROWS)('$label preserves the prefix but cancels every selected target and the suffix', ({ owner, card, label }) => {
    const { state, source } = selectionBoard(owner, card);
    install(state, source, `${label}-multi-target`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'selector', abilId: 'a1' }))
      .toEqual({ ok: true });
    expect(current().players[source].hand).toEqual([DRAW_A]);
    resolveTwoTargets();

    expect(current().players[owner].scene.map(character => character.state)).toEqual(['active', 'active']);
    expect(current().players[source].hand).toEqual([DRAW_A]);
    expect(current().players[source].deck).toEqual([DRAW_B, DRAW_C, DRAW_D]);
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
    expect(current().players[owner].scene[0]?.setCards[0]?.abilityUseCounts?.a1)
      .toEqual({ turn: 47, count: 1 });
  });

  it.each(ROWS)('$label consumes Turn1 even when the first selection is cancelled', ({ owner, card, label }) => {
    const { state, source } = selectionBoard(owner, card);
    install(state, source, `${label}-turn-one`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'selector', abilId: 'a1' }))
      .toEqual({ ok: true });
    resolveTwoTargets();
    expect(current().players[owner].scene.map(character => character.state)).toEqual(['active', 'active']);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'selector', abilId: 'a1' }))
      .toEqual({ ok: true });
    resolveTwoTargets();
    expect(current().players[owner].scene.map(character => character.state)).toEqual(['sleep', 'sleep']);
    expect(current().players[source].hand).toEqual([DRAW_A, DRAW_B, DRAW_C]);
    expect(current().players[source].deck).toEqual([DRAW_D]);
    expect(current().players[owner].scene[0]?.setCards[0]?.abilityUseCounts?.a1)
      .toEqual({ turn: 47, count: 1 });
  });
});

describe('official QA Wave147: selecting the B02067 set occurrence is not selecting its host', () => {
  it.each(ROWS)('$label still intercepts an ordinary bindPick that really selects its host', ({ owner, card, label }) => {
    const { state, source } = selectionBoard(owner, card);
    install(state, source, `${label}-character-bind`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'selector', abilId: 'a2' }))
      .toEqual({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({ atomVerb: 'bindPick' });
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: 'protected',
    }))).toEqual({ ok: true });

    expect(current().players[source].hand).toEqual([]);
    expect(current().players[source].deck).toEqual([DRAW_A, DRAW_B, DRAW_C, DRAW_D]);
    expect(current().players[owner].scene[0]?.setCards[0]?.abilityUseCounts?.a1)
      .toEqual({ turn: 47, count: 1 });
  });

  it('ignores a forged set-card subject added to an ordinary bindPick save', () => {
    const { state, source } = selectionBoard('self', B02067);
    install(state, source, 'forged-subject');
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'selector', abilId: 'a2' }))
      .toEqual({ ok: true });
    const forged = JSON.parse(JSON.stringify(current())) as GameState;
    mutatePersistedBindPick(forged, args => { args.selectionSubject = 'set-card'; });
    coldRestore(forged);

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: 'protected',
    }))).toEqual({ ok: true });
    expect(current().players[source].hand).toEqual([]);
    expect(current().players.self.scene[0]?.setCards[0]?.abilityUseCounts?.a1)
      .toEqual({ turn: 47, count: 1 });
  });

  it.each(ROWS)('$label lets B02039 transfer the selected set card without firing its host ability', ({ owner, card, label }) => {
    const source = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 47, player: source, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[source].scene = [sceneChar(B02039.id, 'yusaku'), sceneChar(TOICHI, 'toichi')];
    state.players[owner].scene = [sceneChar(PROTECTED, 'protected', {
      setCards: [{ cardId: card.id, faceUp: true, instanceId: 'set-voice-changer' }],
    })];
    install(state, source, `${label}-set-card-target`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'yusaku', abilId: 'a1' }))
      .toEqual({ ok: true });
    const hostPick = useGameStateStore.getState().pendingEffectPick;
    expect(hostPick).toMatchObject({ atomVerb: 'bindPick' });
    expect(hostPick?.candidates.map(candidate => candidate.uid)).toContain('protected');
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    coldRestore(saved);
    const restoredPick = useGameStateStore.getState().pendingEffectPick;
    expect(restoredPick).toMatchObject({ atomVerb: 'bindPick' });
    expect(dispatchEngineAction(bindPendingDecision(restoredPick!, {
      type: 'effectPickResolve', pickedUid: 'protected',
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
    expect(current().players[owner].scene[0]?.setCards[0]?.abilityUseCounts?.a1).toBeUndefined();
    const setChoice = useGameStateStore.getState().pendingSetCardChoice;
    expect(setChoice).toMatchObject({ player: source, hostUid: 'protected' });
    expect(setChoice?.entries).toHaveLength(1);
    expect(dispatchEngineAction(bindPendingDecision(setChoice!, {
      type: 'setCardChoiceResolve', instanceId: setChoice!.entries[0]!.instanceId,
    }))).toEqual({ ok: true });

    expect(current().players[owner].scene[0]?.setCards).toEqual([]);
    expect(current().players[owner].evidence.map(entry => entry.cardId)).toEqual([card.id]);
    const trailingPick = useGameStateStore.getState().pendingEffectPick;
    expect(trailingPick).toMatchObject({ atomVerb: 'sceneRemove' });
    expect(dispatchEngineAction(bindPendingDecision(trailingPick!, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
  });

  it.each(['missing', 'unknown'] as const)(
    'fails closed when a genuine B02039 save has a %s selection subject',
    (variant) => {
      const owner = 'self' as const;
      const source = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 47, player: source, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[source].scene = [sceneChar(B02039.id, 'yusaku'), sceneChar(TOICHI, 'toichi')];
      state.players[owner].scene = [sceneChar(PROTECTED, 'protected', {
        setCards: [{ cardId: B02067.id, faceUp: true, instanceId: 'set-voice-changer' }],
      })];
      install(state, source, `genuine-${variant}`);
      expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'yusaku', abilId: 'a1' }))
        .toEqual({ ok: true });
      const saved = JSON.parse(JSON.stringify(current())) as GameState;
      mutatePersistedBindPick(saved, args => {
        if (variant === 'missing') delete args.selectionSubject;
        else args.selectionSubject = 'unknown';
      });
      coldRestore(saved);

      const pick = useGameStateStore.getState().pendingEffectPick;
      expect(dispatchEngineAction(bindPendingDecision(pick!, {
        type: 'effectPickResolve', pickedUid: 'protected',
      }))).toEqual({ ok: true });
      expect(useGameStateStore.getState().pendingSetCardChoice).toBeNull();
      expect(current().players.self.scene[0]?.setCards[0]?.abilityUseCounts?.a1)
        .toEqual({ turn: 47, count: 1 });
    },
  );

  it.each(ROWS)('$label lets an autonomous B02039 controller select the set occurrence', ({ owner, card, label }) => {
    const source = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 47, player: source, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[source].scene = [sceneChar(B02039.id, 'yusaku'), sceneChar(TOICHI, 'toichi')];
    state.players[owner].scene = [sceneChar(PROTECTED, 'protected', {
      setCards: [{ cardId: card.id, faceUp: true, instanceId: 'set-voice-changer' }],
    })];
    install(state, owner, `${label}-autonomous`);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'yusaku', abilId: 'a1' }))
      .toEqual({ ok: true });
    expect(current().players[owner].evidence.map(entry => entry.cardId)).toContain(card.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingSetCardChoice).toBeNull();
    expect(useGameStateStore.getState().pendingChooseIntercept).toBeNull();
  });
});
