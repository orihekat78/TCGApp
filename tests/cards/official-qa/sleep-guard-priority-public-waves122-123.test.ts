// qa: card:B09028:323becb3ad65022766eb60c151e76088089be9650ea67e0f5c4c52d67147bc99
// qa: card:B09054:323becb3ad65022766eb60c151e76088089be9650ea67e0f5c4c52d67147bc99
// qa: card:B10016:323becb3ad65022766eb60c151e76088089be9650ea67e0f5c4c52d67147bc99
// qa: card:B09028:5cffe9de58a0cbfffe692e8c6c421d82ca89e35b1bff91c29c90eb6cff59e3a3
// qa: card:B09054:5cffe9de58a0cbfffe692e8c6c421d82ca89e35b1bff91c29c90eb6cff59e3a3
// qa: card:B10016:5cffe9de58a0cbfffe692e8c6c421d82ca89e35b1bff91c29c90eb6cff59e3a3
// qa: card:B09028:834e9f1549978b53db5e67241dc3c0164382951e0268b784196863fb038f6fe5
// qa: card:B09054:834e9f1549978b53db5e67241dc3c0164382951e0268b784196863fb038f6fe5
// qa: card:B10016:834e9f1549978b53db5e67241dc3c0164382951e0268b784196863fb038f6fe5
// qa: card:B09028:9d800ddb1453a443607383e0c16204a571f4ded5ecb0b359a8e844675a7eb884
// qa: card:B09054:9d800ddb1453a443607383e0c16204a571f4ded5ecb0b359a8e844675a7eb884
// qa: card:B10016:9d800ddb1453a443607383e0c16204a571f4ded5ecb0b359a8e844675a7eb884

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09028 } from '@/cards/ct-p09/B09028';
import { B09054 } from '@/cards/ct-p09/B09054';
import { B09054P } from '@/cards/ct-p09/B09054P';
import { B10016 } from '@/cards/ct-p10/B10016';
import { event } from '@/engine/event';
import { guard } from '@/engine/flow/guard';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type PermissionMode = 'conditional' | 'granted' | 'printed';
type Row = { source: CardDef; mode: PermissionMode };

const ROWS = [
  { source: B09028, mode: 'conditional' },
  { source: B09054, mode: 'granted' },
  { source: B09054P, mode: 'granted' },
  { source: B10016, mode: 'printed' },
] as const satisfies readonly Row[];
const CASES = ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner })));

const ATTACKER = fixture('W122_ATTACKER');
const BULLET_ATTACKER = fixture('W123_BULLET_ATTACKER', { keywords: ['ブレット'] });
const REPEAT_ATTACKER = fixture('W124_REPEAT_ATTACKER', { ap: 0 });
const PLAIN_GUARDER = fixture('W125_PLAIN_GUARDER');
const TARGET = fixture('W122_TARGET');
const OSAKA_ALLY = fixture('W122_OSAKA_ALLY', { ap: 0, traits: ['大阪府警'] });
const AKAI_GUARDER = fixture('W122_AKAI_GUARDER', { traits: ['赤井家'] });

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['白'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Waves122-123 state');
  return state;
}

function stateFor(row: Row, owner: Player, attacker: CardDef): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[other(owner)].scene = [sceneChar(attacker.id, 'attacker')];
  state.players[owner].scene = [sceneChar(TARGET.id, 'target', { state: 'sleep' })];

  if (row.mode === 'conditional') {
    state.players[owner].scene.push(
      sceneChar(row.source.id, 'guarder'),
      sceneChar(OSAKA_ALLY.id, 'osaka-ally'),
    );
  } else if (row.mode === 'granted') {
    state.players[owner].scene.push(
      sceneChar(row.source.id, 'grant-source'),
      sceneChar(AKAI_GUARDER.id, 'guarder'),
    );
  } else {
    state.players[owner].scene.push(sceneChar(row.source.id, 'guarder'));
  }
  return state;
}

function installPermission(
  row: Row,
  owner: Player,
  attacker: CardDef,
  guarderState: 'active' | 'sleep' | 'stun',
): void {
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(stateFor(row, owner, attacker))).toBe(true);

  if (row.mode === 'granted') {
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'grant-source', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toEqual({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick).toMatchObject({
      player: owner, ownerPlayer: owner, atomVerb: 'charSetTurnEffect', nMin: 0, nMax: 1,
      source: { uid: 'grant-source', cardId: row.source.id, abilityId: 'a2' },
    });
    expect(pick?.candidates.map(candidate => candidate.uid)).toContain('guarder');
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: 'guarder',
    }))).toEqual({ ok: true });
  }

  expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(true);
  const ready = structuredClone(current());
  ready.turn = { number: 5, player: other(owner), phase: 'main', isFirstPlayerFirstTurn: false };
  ready.players[owner].scene.find(character => character.uid === 'guarder')!.state = guarderState;
  expect(useGameStateStore.getState().setGameState(ready)).toBe(true);
}

function declare(byUid = 'attacker'): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid, targetUid: 'target' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  return actionId!;
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
  for (const card of [
    ATTACKER, BULLET_ATTACKER, REPEAT_ATTACKER, PLAIN_GUARDER, YELLOW_ATTACKER,
    TARGET, OSAKA_ALLY, AKAI_GUARDER,
  ]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave122: active sleep-guard bearers still sleep after guarding', () => {
  // Card-bound physical rows: B09028 B09054 B09054P B10016.
  it.each(CASES)('$source.id owner $owner', ({ source, mode, owner }) => {
    installPermission({ source, mode }, owner, ATTACKER, 'active');
    const actionId = declare();
    expect(guard.candidates(current(), 'attacker', 'target').map(candidate => candidate.uid))
      .toContain('guarder');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: true });
    expect(current().players[owner].scene.find(character => character.uid === 'guarder')?.state)
      .toBe('sleep');
  });
});

describe('official QA Wave123: Bullet still prevents sleep-guard permission', () => {
  // Card-bound physical rows: B09028 B09054 B09054P B10016.
  it.each(CASES)('$source.id owner $owner', ({ source, mode, owner }) => {
    installPermission({ source, mode }, owner, BULLET_ATTACKER, 'sleep');
    const actionId = declare();
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(true);
    expect(guard.candidates(current(), 'attacker', 'target')).toEqual([]);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players[owner].scene.find(character => character.uid === 'guarder')?.state)
      .toBe('sleep');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
  });
});

function finishCharacterAction(actionId: string): void {
  for (let step = 0; step < 20 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    const action = current().actionContexts?.[actionId];
    if (!action) break;
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === actingUid)
        ? 'self'
        : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    } else if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    }
    if (useGameStateStore.getState().activeActionId === actionId) {
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    }
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

describe('official QA Wave124: the same eligible bearer may guard again in one turn', () => {
  // Card-bound physical rows: B09028 B09054 B09054P B10016.
  it.each(CASES)('$source.id owner $owner', ({ source, mode, owner }) => {
    installPermission({ source, mode }, owner, REPEAT_ATTACKER, 'active');
    let actionId = declare();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: true });
    finishCharacterAction(actionId);
    expect(current().players[owner].scene.find(character => character.uid === 'guarder')?.state)
      .toBe('sleep');
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(true);

    const second = structuredClone(current());
    second.players[other(owner)].scene.push(sceneChar(REPEAT_ATTACKER.id, 'attacker-2'));
    expect(useGameStateStore.getState().setGameState(second)).toBe(true);
    actionId = declare('attacker-2');
    expect(guard.candidates(current(), 'attacker-2', 'target').map(candidate => candidate.uid))
      .toContain('guarder');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: true });
  });
});

describe('official QA Wave125: stun remains ineligible despite sleep-guard permission', () => {
  // Card-bound physical rows: B09028 B09054 B09054P B10016.
  it.each(CASES)('$source.id owner $owner', ({ source, mode, owner }) => {
    installPermission({ source, mode }, owner, ATTACKER, 'stun');
    const withDecoy = structuredClone(current());
    withDecoy.players[owner].scene.push(sceneChar(PLAIN_GUARDER.id, 'plain-guarder'));
    expect(useGameStateStore.getState().setGameState(withDecoy)).toBe(true);

    const actionId = declare();
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(true);
    const candidateUids = guard.candidates(current(), 'attacker', 'target').map(candidate => candidate.uid);
    expect(candidateUids).toContain('plain-guarder');
    expect(candidateUids).not.toContain('guarder');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players[owner].scene.find(character => character.uid === 'guarder')?.state)
      .toBe('stun');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
  });
});

// qa: card:B09028:31d03128b5170ea5589887ff0e06067d7b24ba1fd934248f4d1644f835a84003
// qa: card:B10016:31d03128b5170ea5589887ff0e06067d7b24ba1fd934248f4d1644f835a84003
// qa: card:B09028:994d30af4d93af550bf5f2fade6b238d84f11ba9dcf0b9fcf7a1949add4f7b07
// qa: card:B09028:c5a3cdddff8ccf11b34763f972a8687787f0073d28df03b185cd97943c2722dc

const TARGET_SELF_ROWS = [
  { source: B09028, mode: 'conditional' },
  { source: B10016, mode: 'printed' },
] as const satisfies readonly Row[];
const YELLOW_ATTACKER = fixture('W126_YELLOW_ATTACKER', { ap: 9000, colors: ['黄'] });

describe('official QA Wave126: the action target cannot guard itself', () => {
  it.each(TARGET_SELF_ROWS.flatMap(row => (
    ['self', 'opp'] as const
  ).map(owner => ({ ...row, owner }))))('$source.id owner $owner', ({ source, mode, owner }) => {
    expect([B09028.id, B10016.id]).toContain(source.id);
    installPermission({ source, mode }, owner, ATTACKER, 'sleep');
    const state = structuredClone(current());
    state.players[owner].scene.push(sceneChar(PLAIN_GUARDER.id, 'plain-guarder'));
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'guarder',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    const candidateUids = guard.candidates(current(), 'attacker', 'guarder')
      .map(candidate => candidate.uid);
    expect(candidateUids).toContain('plain-guarder');
    expect(candidateUids).not.toContain('guarder');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
  });
});

describe('official QA Wave126: B09028 counts itself and evaluates its condition live', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    installPermission({ source: B09028, mode: 'conditional' }, owner, ATTACKER, 'sleep');
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(true);
    const oneOsaka = structuredClone(current());
    oneOsaka.players[owner].scene = oneOsaka.players[owner].scene
      .filter(character => character.uid !== 'osaka-ally');
    expect(useGameStateStore.getState().setGameState(oneOsaka)).toBe(true);
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(false);
  });
});

describe('official QA Wave126: action-declare removal invalidates B09028 before guard choice', () => {
  it.each(['self', 'opp'] as const)('owner %s', owner => {
    const attacker = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 5, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[attacker].partner = {
      cardId: 'D05001', state: 'active', colors: ['黄'], location: 'partner-area',
    } as GameState['players']['self']['partner'];
    state.players[attacker].scene = [
      sceneChar('B05086', 'removal-source'),
      sceneChar(YELLOW_ATTACKER.id, 'attacker'),
    ];
    state.players[owner].scene = [
      sceneChar(TARGET.id, 'target', { state: 'sleep' }),
      sceneChar(B09028.id, 'guarder', { state: 'sleep' }),
      sceneChar(OSAKA_ALLY.id, 'osaka-ally'),
    ];
    endMatchSession();
    beginMatchSession(attacker);
    (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = attacker;
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(true);

    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'target',
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      player: attacker, ownerPlayer: attacker, atomVerb: 'sceneRemove',
      source: { uid: 'removal-source', cardId: 'B05086', abilityId: 'a1' },
    });
    expect(pending?.candidates.map(candidate => candidate.uid)).toContain('osaka-ally');
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: 'osaka-ally',
    }))).toEqual({ ok: true });

    expect(current().players[owner].scene.some(character => character.uid === 'osaka-ally'))
      .toBe(false);
    expect(readChar.hasTextAbility(current(), 'guarder', 'sleepGuard')).toBe(false);
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(guard.candidates(current(), 'attacker', 'target').map(candidate => candidate.uid))
      .not.toContain('guarder');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guarder' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
  });
});
