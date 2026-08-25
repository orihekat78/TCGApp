// qa: card:B09054:be26cfbb13dc4cbade567e0e2119410a53a7352cbf2402270145178503d5061c
// qa: card:B09054:80a2cfb16a87e5d0d4da8698cb86f47b173740616dd1af4e02537a5deb1ade52
// qa: card:B09054:c0c7a68122e93ddaf73fc8d2c1e30b62955cdfb17877f874490c7f302df30d8a

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09054 } from '@/cards/ct-p09/B09054';
import { B09054P } from '@/cards/ct-p09/B09054P';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const ROWS = [B09054, B09054P] as const;
const CASES = ROWS.flatMap(card => (['self', 'opp'] as const).map(owner => ({ card, owner })));
const AKAI = fixture('W127_AKAI', { traits: ['赤井家'] });
const VICTIM = fixture('W127_VICTIM', { ap: 9000 });
const OVER = fixture('W127_OVER', { ap: 10000 });

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave127 state');
  return state;
}

function base(owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 7, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  return state;
}

function install(state: GameState, owner: Player): void {
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function useAbility(
  uid: string,
  abilityId: 'a1' | 'a2',
  abilityIndex: 0 | 1,
): ReturnType<typeof dispatchEngineAction> {
  return dispatchEngineAction({
    type: 'declaredAbility', uid, abilId: abilityId,
    abilityOrigin: 'printed', abilityIndex,
  });
}

function resolvePick(pickedUid: string | null): void {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [AKAI, VICTIM, OVER]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave127: B09054/P counts itself toward three Akai-family characters', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    expect([B09054.id, B09054P.id]).toContain(card.id);
    const tooFew = base(owner);
    tooFew.players[owner].scene = [
      sceneChar(card.id, 'source'),
      sceneChar(AKAI.id, 'ally-1'),
    ];
    install(tooFew, owner);
    expect(useAbility('source', 'a1', 0)).toEqual({ ok: false, reason: 'not-allowed' });

    const exact = base(owner);
    exact.players[owner].scene = [
      sceneChar(card.id, 'source'),
      sceneChar(AKAI.id, 'ally-1'),
      sceneChar(AKAI.id, 'ally-2'),
    ];
    exact.players[other(owner)].scene = [
      sceneChar(VICTIM.id, 'victim'),
      sceneChar(OVER.id, 'over'),
    ];
    install(exact, owner);
    expect(useAbility('source', 'a1', 0)).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'sceneRemove',
      source: { uid: 'source', cardId: card.id, abilityId: 'a1' },
    });
    expect(pending?.candidates.map(candidate => candidate.uid)).toContain('victim');
    expect(pending?.candidates.map(candidate => candidate.uid)).not.toContain('over');
    resolvePick(null);
  });
});

describe('official QA Wave127: B09054/P may select itself only while active', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    expect([B09054.id, B09054P.id]).toContain(card.id);
    const active = base(owner);
    active.players[owner].scene = [sceneChar(card.id, 'source')];
    install(active, owner);
    expect(useAbility('source', 'a2', 1)).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.uid))
      .toContain('source');
    resolvePick('source');
    expect(current().players[owner].scene[0]?.turnEffects.sleepGuard_oppTurn).toBe(true);

    const sleep = base(owner);
    sleep.players[owner].scene = [sceneChar(card.id, 'source', { state: 'sleep' })];
    install(sleep, owner);
    expect(useAbility('source', 'a2', 1)).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players[owner].scene[0]?.turnEffects.sleepGuard_oppTurn).toBeUndefined();
  });
});

describe('official QA Wave127: PA and newly entered scene UIDs have independent turn-one use', () => {
  it.each(CASES)('$card.id owner $owner', ({ card, owner }) => {
    expect([B09054.id, B09054P.id]).toContain(card.id);
    const state = base(owner);
    const partnerUid = 'partnerMR:' + owner;
    state.players[owner].partnerAreaMR = sceneChar(card.id, partnerUid);
    state.players[owner].scene = [sceneChar(AKAI.id, 'target')];
    install(state, owner);

    expect(useAbility(partnerUid, 'a2', 1)).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.uid))
      .toContain('target');
    resolvePick('target');
    expect(useAbility(partnerUid, 'a2', 1)).toEqual({ ok: false, reason: 'not-allowed' });

    const entered = structuredClone(current());
    entered.players[owner].scene.push(sceneChar(card.id, 'scene-source'));
    expect(useGameStateStore.getState().setGameState(entered)).toBe(true);
    expect(useAbility('scene-source', 'a2', 1)).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick).toMatchObject({
      player: owner, ownerPlayer: owner,
      source: { uid: 'scene-source', cardId: card.id, abilityId: 'a2' },
    });
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(candidate => candidate.uid))
      .toContain('scene-source');
    resolvePick('scene-source');
    expect(current().players[owner].scene.find(character => character.uid === 'scene-source')
      ?.turnEffects.sleepGuard_oppTurn).toBe(true);
  });
});
