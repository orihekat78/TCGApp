// qa: card:B08058:2b4e49ff7d67dddeddd1fff86f17cd8814f42adc4f55ce818ce3626a24b4cdcf
// qa: card:B08058:685833a68d06da220456d118eeeaaa41518d2442d24ee467eb174be91fd6a023
// qa: card:B08058:8a293cda8d6b4c898d58ed3beb7a7bcbac944230a73525f8c210fbbe999f3190
// qa: card:B08058:9eb8457683623fd1c276da0ccb881608e23831760aac2a46be5ceda7e1066007
// qa: card:B08058:cbce41c9b0c72cca046ffb06c2b4ff9c3af679af4bcfb692fac12dc0b5998a23
// Rules: 03-field-areas.md, 05-turn-phases.md, 15-abilities-effects.md, 17-icons.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B08058 } from '@/cards/ct-p08/B08058';
import { event } from '@/engine/event';
import { persistPendingRuntimeState, resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const LEVEL7 = 'QA_B08058_LEVEL7';
const TARGET = 'QA_B08058_TARGET';
const DRAW = 'QA_B08058_DRAW';
const TAIL = 'QA_B08058_TAIL';
const RED_PARTNER = 'QA_B08058_RED_PARTNER';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 7,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['赤'];
  state.players.self.case.status = '解決編';
  state.players.self.deck = [DRAW, TAIL];
  state.players.self.scene = [
    makeChar({ cardId: B08058.id, uid: 'shiho' }),
    makeChar({ cardId: LEVEL7, uid: 'level7-a' }),
  ];
  state.players.opp.scene = [makeChar({ cardId: TARGET, uid: 'target', state: 'active' })];
  return state;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing B08058 Wave 25 game state');
  return state;
}

function install(state: GameState, preserveRuntime = false): void {
  expect(useGameStateStore.getState().setGameState(state, { preserveRuntime })).toBe(true);
  surfacePendingSideChannels();
}

function pendingStun() {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    player: 'self', atomVerb: 'sceneSetState', nMin: 0, nMax: 1,
    source: { cardId: B08058.id, abilityId: 'a1' },
  });
  return pending!;
}

function declineStun(): void {
  const pending = pendingStun();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
}

function queueEndTriggerThen(state: GameState, mutateBeforeResolution: (queued: GameState) => void): void {
  event.emit(state, 'phase:end:start', { player: 'self' });
  mutateBeforeResolution(state);
  runAllUntilEmpty(state);
  persistPendingRuntimeState(state);
  resetPendingRuntimeState();
  install(JSON.parse(JSON.stringify(state)) as GameState, true);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  resetPendingRuntimeState();
  [
    B08058,
    card(LEVEL7),
    card(TARGET, { level: 8 }),
    card(DRAW, { level: 1 }),
    card(TAIL, { level: 1 }),
    card(RED_PARTNER, { kind: 'partner', level: 0 }),
  ].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  resetPendingRuntimeState();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B08058 official QA through public decisions', () => {
  it('counts B08058 itself, draws mandatorily, and permits choosing zero opposing characters', () => {
    const state = base();
    state.players.self.scene.push(makeChar({ cardId: LEVEL7, uid: 'level7-b' }));
    install(state);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(current().players.self.hand).toContain(DRAW);
    expect(current().players.self.scene.filter(character => character.cardId === B08058.id || character.cardId === LEVEL7))
      .toHaveLength(3);
    declineStun();

    expect(current().players.opp.scene.find(character => character.uid === 'target')?.state).toBe('active');
    expect(current().turn.player).toBe('opp');
  });

  it('checks the level-7 threshold at resolution, including a condition that became true after triggering', () => {
    const state = base();
    queueEndTriggerThen(state, queued => {
      queued.players.self.scene.push(makeChar({ cardId: LEVEL7, uid: 'late-level7' }));
    });

    expect(current().players.self.hand).toContain(DRAW);
    declineStun();
    expect(current().players.opp.scene[0]?.state).toBe('active');
  });

  it('resolves after B08058 leaves the scene when three other level-7 characters remain at resolution', () => {
    const state = base();
    state.players.self.scene.push(
      makeChar({ cardId: LEVEL7, uid: 'level7-b' }),
      makeChar({ cardId: LEVEL7, uid: 'level7-c' }),
    );
    queueEndTriggerThen(state, queued => {
      queued.players.self.scene = queued.players.self.scene.filter(character => character.uid !== 'shiho');
      queued.players.self.remove.push(B08058.id);
    });

    expect(current().players.self.scene.some(character => character.uid === 'shiho')).toBe(false);
    expect(current().players.self.hand).toContain(DRAW);
    declineStun();
  });

  it('counts an assisting partner as the eighth FILE card on public hand entry', () => {
    const state = base();
    state.players.self.scene = [];
    state.players.self.hand = [B08058.id];
    state.players.self.partner = {
      cardId: RED_PARTNER, state: 'sleep', location: 'file-area',
    };
    state.players.self.file = [
      ...Array.from({ length: 7 }, (_, index) => ({ type: 'card-back' as const, cardId: `FILE-${index}` })),
      { type: 'assisted-partner', cardId: RED_PARTNER },
    ];
    install(state);

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B08058.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional?.source).toMatchObject({ cardId: B08058.id, abilityId: 'a2' });
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: false,
    }))).toEqual({ ok: true });
    expect(current().players.self.file).toHaveLength(8);
  });
});
