// qa: card:B10099:640df767ce1693a6c289ab1d9869c461083d1e678224db8ace1d58f9f308af94
// qa: card:B10099:778f2ec6d361908c4a67f350b59be3fb6673daac7dd65787323343b2748e3208
// qa: card:B10099:da2cc774eb1eaf35c50e1d6d32c8db16c941048c94810f4e58600e004b3d2e2a
// qa: card:B10099:dc46dc53a352ab1baa14118fe8a0448482eebbb19acb8a26a4bc4ee56489c6e9
// qa: card:B10099:f3a731df3e173b2f0bb2f460c231873a8e65f756fd9949dd9035e1f152b52a4f

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B10099, B10099P } from '@/cards/ct-p10/B10099';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['赤'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const VANILLA = fixture('W142_VANILLA', { level: 5 });
const LEVEL_SIX = fixture('W142_LEVEL_SIX', { level: 6 });
const LEVEL_EIGHT = fixture('W142_LEVEL_EIGHT', { level: 8 });
const OWN_EIGHT = fixture('W142_OWN_EIGHT', { level: 8 });
const OPP_EIGHT_A = fixture('W142_OPP_EIGHT_A', { level: 8 });
const OPP_EIGHT_B = fixture('W142_OPP_EIGHT_B', { level: 8 });
const TAIL = fixture('W142_TAIL');
const EXTERNAL_ABILITY: AbilityDef = {
  id: 'external-grant', type: 'continuous', scope: 'on-scene',
  description: '外部から与えられた能力', ruleRefs: [],
};
const PRINTINGS = [B10099, B10099P] as const;
const PRINTING_OWNERS = PRINTINGS.flatMap(printing =>
  (['self', 'opp'] as const).map(owner => ({ printing, owner })));

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave142 state');
  return state;
}

function board(printing: CardDef, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 41, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].partnerAreaMR = sceneChar(printing.id, 'mr-source');
  state.players[owner].deck = [TAIL.id, TAIL.id];
  state.players[other(owner)].deck = [TAIL.id, TAIL.id];
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave142-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function emitEntrants(owner: Player, entrants: SceneCharacter[], beforeResolve?: (state: GameState) => void): void {
  expect(useGameStateStore.getState().dispatch(state => produce(state, draft => {
    draft.players[owner].scene.push(...entrants);
    for (const entrant of entrants) {
      event.emit(draft, 'enter', {
        uid: entrant.uid, viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1,
      }, { player: owner, uid: entrant.uid, cardId: entrant.cardId });
    }
    beforeResolve?.(draft as GameState);
    runAllUntilEmpty(draft as GameState);
  }))).toBe(true);
  surfacePendingSideChannels();
}

function resolveOptional(run: boolean): string {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending).toMatchObject({ source: { abilityId: 'a3' } });
  const decisionId = pending!.decisionId;
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'optionalResolve', run,
  }))).toEqual({ ok: true });
  return decisionId;
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  registerAll();
  for (const card of [VANILLA, LEVEL_SIX, LEVEL_EIGHT, OWN_EIGHT, OPP_EIGHT_A, OPP_EIGHT_B, TAIL]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave142: the partner-area aura continuously lowers every opposing character', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    const state = board(printing, owner);
    state.players[owner].scene = [sceneChar(OWN_EIGHT.id, 'own-eight')];
    state.players[other(owner)].scene = [
      sceneChar(OPP_EIGHT_A.id, 'opp-eight-a'),
      sceneChar(OPP_EIGHT_B.id, 'opp-eight-b'),
    ];
    install(state, owner, `${printing.id}-${owner}-aura`);

    expect(readChar.level(current(), 'opp-eight-a')).toBe(7);
    expect(readChar.level(current(), 'opp-eight-b')).toBe(7);
    expect(readChar.level(current(), 'own-eight')).toBe(8);

    const opponentTurn = structuredClone(current());
    opponentTurn.turn.player = other(owner);
    expect(readChar.level(opponentTurn, 'opp-eight-a')).toBe(8);
  });
});

describe('official QA Wave142: mandatory triggers consume Turn2 even when their optional body does nothing', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    install(board(printing, owner), owner, `${printing.id}-${owner}-turn2`);

    emitEntrants(owner, [sceneChar(VANILLA.id, 'already-sleep', { state: 'sleep' })]);
    resolveOptional(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();

    emitEntrants(owner, [sceneChar(VANILLA.id, 'declined')]);
    resolveOptional(false);

    const beforeThird = current().pendingEffects.filter(entry => entry.source.abilityId === 'a3').length;
    emitEntrants(owner, [sceneChar(VANILLA.id, 'third')]);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(current().pendingEffects.filter(entry => entry.source.abilityId === 'a3')).toHaveLength(beforeThird);
  });
});

describe('official QA Wave142: each member of a simultaneous entry batch triggers independently', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    install(board(printing, owner), owner, `${printing.id}-${owner}-simultaneous`);
    emitEntrants(owner, [sceneChar(VANILLA.id, 'first'), sceneChar(VANILLA.id, 'second')]);

    const group = pendingOwnerOrderGroup(current(), owner);
    expect(group).toHaveLength(2);
    expect(group.map(entry => entry.source.cardId)).toEqual([printing.id, printing.id]);
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: owner, entryIds: group.map(entry => entry.id),
    })).toEqual({ ok: true });
    const firstDecision = resolveOptional(false);
    surfacePendingSideChannels();
    const second = useGameStateStore.getState().pendingEffectOptional;
    expect(second).toMatchObject({ player: owner, source: { cardId: printing.id, abilityId: 'a3' } });
    expect(second?.decisionId).not.toBe(firstDecision);
    resolveOptional(false);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });
});

describe('official QA Wave142: granted abilities do not become original and effective level is read at resolution', () => {
  it.each(PRINTING_OWNERS)('$printing.id owner $owner', ({ printing, owner }) => {
    const state = board(printing, owner);
    state.players[owner].scene = [
      sceneChar(LEVEL_SIX.id, 'level-six', { state: 'sleep' }),
      sceneChar(LEVEL_EIGHT.id, 'level-eight', { state: 'sleep' }),
    ];
    install(state, owner, `${printing.id}-${owner}-effective-level`);

    const entrant = sceneChar(VANILLA.id, 'entrant');
    entrant.turnEffects.grantedAbilities = [EXTERNAL_ABILITY];
    emitEntrants(owner, [entrant], draft => {
      draft.players[owner].scene.find(character => character.uid === 'entrant')!.turnEffects.lvlMod_turn = 2;
    });

    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(optional).toMatchObject({ player: owner, source: { cardId: printing.id, abilityId: 'a3' } });
    expect(current().players[owner].scene.find(character => character.uid === 'entrant')?.turnEffects.grantedAbilities)
      .toEqual([EXTERNAL_ABILITY]);
    expect(readChar.level(current(), 'entrant')).toBe(7);
    resolveOptional(true);

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.candidates.map(candidate => candidate.uid)).toContain('level-six');
    expect(pick?.candidates.map(candidate => candidate.uid)).not.toContain('level-eight');
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: 'level-six',
    }))).toEqual({ ok: true });
    expect(current().players[owner].scene.some(character => character.uid === 'level-six')).toBe(false);
  });
});
