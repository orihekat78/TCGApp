// qa: card:B03088:37d1a5bf035569e61acdccac31f828d38114d0105e6cbe77aa883552b82699c7
// qa: card:B03095:37d1a5bf035569e61acdccac31f828d38114d0105e6cbe77aa883552b82699c7
// Rules: 07-action-flow, 10-action-event, 13-keywords, 15-abilities-effects,
// 17-icons, 19-special-rules, 21-declared-ability-cost, 22-qa-action-contact.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

type B03088Row = { cardId: 'B03088' | 'B03088P' };
const B03088_ROWS: B03088Row[] = [{ cardId: 'B03088' }, { cardId: 'B03088P' }];

const FURUYA = 'W74-FURUYA';
const HIRO = 'W74-HIRO';
const DATE = 'W74-DATE';
const HAGI = 'W74-HAGI';
const TARGET7 = 'W74-TARGET7';
const TARGET8 = 'W74-TARGET8';
const POLICE = 'W74-POLICE';
const NON_POLICE = 'W74-NON-POLICE';
const OPP_POLICE = 'W74-OPP-POLICE';
const ACTOR1 = 'W74-ACTOR1';
const ACTOR2 = 'W74-ACTOR2';
const DRAW = 'W74-DRAW';
const TAIL = 'W74-TAIL';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: id, kind, names: [id], colors: ['黄'], level: 3,
    ap: kind === 'character' ? 3000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(FURUYA, { names: ['降谷零'], level: 8 }),
  fixture(HIRO, { names: ['諸伏景光'], level: 8 }),
  fixture(DATE, { names: ['伊達航'], level: 8 }),
  fixture(HAGI, { names: ['萩原研二'], level: 8 }),
  fixture(TARGET7, { level: 7, ap: 7000 }),
  fixture(TARGET8, { level: 8, ap: 8000 }),
  fixture(POLICE, { traits: ['警察'], ap: 4000 }),
  fixture(NON_POLICE, { traits: ['探偵'] }),
  fixture(OPP_POLICE, { traits: ['警察'] }),
  fixture(ACTOR1, { ap: 1000 }),
  fixture(ACTOR2, { ap: 1000 }),
  fixture(DRAW), fixture(TAIL),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave74 state');
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function resolvePublicPick(cardId: string, abilityId: string, pickedUid: string | null): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.source).toMatchObject({ cardId, abilityId });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function b03088State(row: B03088Row, owner: Player, sourceState: 'active' | 'sleep' = 'sleep'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 6, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [
    sceneChar(row.cardId, `${owner}-matsuda`, { state: sourceState }),
    sceneChar(FURUYA, `${owner}-furuya`),
    sceneChar(HIRO, `${owner}-hiro`),
    sceneChar(DATE, `${owner}-date`),
    sceneChar(HAGI, `${owner}-hagi`),
  ];
  state.players[other(owner)].scene = [
    sceneChar(TARGET7, `${other(owner)}-target7`, { state: 'sleep' }),
    sceneChar(TARGET8, `${other(owner)}-target8`, { state: 'sleep' }),
  ];
  state.players[owner].deck = [DRAW, TAIL];
  state.players[other(owner)].deck = [TAIL, TAIL, TAIL];
  return state;
}

function declareB03088(row: B03088Row, owner: Player): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: `${owner}-matsuda`, abilId: 'a1',
    abilityOrigin: 'printed', abilityIndex: 0,
  })).toEqual({ ok: true });
}

function b03095State(owner: Player, includeTargets = true): GameState {
  const attacker = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 8, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar('B03095', `${owner}-source`, { state: 'sleep' })];
  if (includeTargets) {
    state.players[owner].scene.push(
      sceneChar(POLICE, `${owner}-police`, { state: 'sleep' }),
      sceneChar(NON_POLICE, `${owner}-non-police`, { state: 'sleep' }),
    );
  }
  state.players[attacker].scene = [
    sceneChar(ACTOR1, `${attacker}-actor1`),
    sceneChar(ACTOR2, `${attacker}-actor2`),
    sceneChar(OPP_POLICE, `${attacker}-opp-police`),
  ];
  state.players.self.deck = [TAIL, TAIL, TAIL];
  state.players.opp.deck = [TAIL, TAIL, TAIL];
  return state;
}

function declareAgainstSource(owner: Player, actorIndex = 1): string {
  const attacker = other(owner);
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: `${attacker}-actor${actorIndex}`, targetUid: `${owner}-source`,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  return actionId!;
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

// Card-bound physical rows: B03088 B03088P B03095.
describe('official QA Wave74: an eligible effect source can select itself', () => {
  it.each(B03088_ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId publicly selects its own $owner occurrence and applies the complete outcome',
    ({ owner, ...row }) => {
      install(b03088State(row, owner), `${row.cardId}:wave74-self-${owner}`, owner);
      declareB03088(row, owner);
      surfacePendingSideChannels();
      const pick = useGameStateStore.getState().pendingEffectPick!;
      expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${owner}-matsuda`);
      expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${other(owner)}-target7`);
      expect(pick.candidates.map(candidate => candidate.uid)).not.toContain(`${other(owner)}-target8`);
      resolvePublicPick(row.cardId, 'a1', `${owner}-matsuda`);

      expect(readChar.ap(current(), `${owner}-matsuda`)).toBe(6000);
      expect(current().players[owner].scene[0]?.state).toBe('active');
      expect(readChar.hasKeyword(current(), `${owner}-matsuda`, '突撃')).toBe(true);
      expect(current().players[owner].hand).toEqual([DRAW]);
      expect(current().players[owner].deck).toEqual([TAIL]);
    },
  );

  it.each(B03088_ROWS)('$cardId can select itself while already active', row => {
    install(b03088State(row, 'self', 'active'), `${row.cardId}:wave74-active-self`, 'self');
    declareB03088(row, 'self');
    resolvePublicPick(row.cardId, 'a1', 'self-matsuda');
    expect(current().players.self.scene[0]?.state).toBe('active');
    expect(readChar.ap(current(), 'self-matsuda')).toBe(6000);
  });

  it.each(B03088_ROWS)('$cardId zero-pick preserves characters but still draws and consumes turn use', row => {
    install(b03088State(row, 'self'), `${row.cardId}:wave74-zero`, 'self');
    declareB03088(row, 'self');
    resolvePublicPick(row.cardId, 'a1', null);
    expect(current().players.self.scene[0]?.state).toBe('sleep');
    expect(readChar.ap(current(), 'self-matsuda')).toBe(5000);
    expect(readChar.hasKeyword(current(), 'self-matsuda', '突撃')).toBe(false);
    expect(current().players.self.hand).toEqual([DRAW]);
    expect(readChar.declaredUseCount(current(), 'self-matsuda', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
  });

  it.each(B03088_ROWS)('$cardId requires all four printed bond names', row => {
    const state = b03088State(row, 'self');
    state.players.self.scene = state.players.self.scene.filter(card => card.cardId !== HAGI);
    install(state, `${row.cardId}:wave74-bond-missing`, 'self');
    const before = current();
    const beforeJson = JSON.stringify(before);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'self-matsuda', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
  });

  it('B03088 keeps AP permanent while its granted Assault expires at turn end', () => {
    const row = B03088_ROWS[0]!;
    install(b03088State(row, 'self'), 'B03088:wave74-expiry', 'self');
    declareB03088(row, 'self');
    resolvePublicPick(row.cardId, 'a1', 'self-matsuda');
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(readChar.ap(current(), 'self-matsuda')).toBe(6000);
    expect(readChar.hasKeyword(current(), 'self-matsuda', '突撃')).toBe(false);
  });

  it.each(B03088_ROWS)('$cardId public Hirameki decline leaves the physical card in remove', row => {
    const state = createEmptyGameState();
    state.players.self.deck = [TAIL, TAIL];
    state.players.opp.deck = [TAIL, TAIL];
    const { actionId, pending } = openCaseHirameki(state, row.cardId, {
      evidencePlayer: 'self', humanPlayer: 'self', sessionLabel: `${row.cardId}-wave74-skip`,
    });
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'hiramekiResolve', choice: 'skip',
    }))).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(current().players.self.remove).toContain(row.cardId);
    expect(current().players.self.hand).not.toContain(row.cardId);
  });
  // B03095 public source and owner-relative target assertions.
  it.each(['self', 'opp'] as const)('B03095 publicly selects its own sleeping $s occurrence', owner => {
    install(b03095State(owner), `B03095:wave74-self-${owner}`, owner);
    declareAgainstSource(owner);
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.source).toMatchObject({ cardId: 'B03095', uid: `${owner}-source`, abilityId: 'a1' });
    expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${owner}-source`);
    expect(pick.candidates.map(candidate => candidate.uid)).toContain(`${owner}-police`);
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain(`${owner}-non-police`);
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain(`${other(owner)}-opp-police`);
    resolvePublicPick('B03095', 'a1', `${owner}-source`);
    expect(current().players[owner].scene.find(card => card.uid === `${owner}-source`)?.state).toBe('active');
  });

  it('B03095 zero-pick leaves itself sleeping and consumes the triggered turn limit', () => {
    install(b03095State('self'), 'B03095:wave74-zero', 'self');
    declareAgainstSource('self');
    resolvePublicPick('B03095', 'a1', null);
    expect(current().players.self.scene.find(card => card.uid === 'self-source')?.state).toBe('sleep');
    expect(readChar.declaredUseCount(current(), 'self-source', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
  });

  it('B03095 active source does not trigger from an opponent action', () => {
    const state = b03095State('self');
    state.players.self.scene[0]!.state = 'active';
    install(state, 'B03095:wave74-active-gate', 'self');
    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'opp-actor1', targetUid: 'self-police',
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('B03095 enforces its triggered turn limit across two opponent action declarations', () => {
    const state = b03095State('self', false);
    (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
    event.emit(state, 'action:declare', {
      byUid: 'opp-actor1', uid: 'opp-actor1', player: 'opp',
      target: { kind: 'char', uid: 'self-source' }, targetUid: 'self-source',
    }, { player: 'opp', uid: 'opp-actor1' });
    runAllUntilEmpty(state);
    drainAiEffectPicks(state);
    runAllUntilEmpty(state);
    expect(state.players.self.scene[0]?.state).toBe('active');
    state.players.self.scene[0]!.state = 'sleep';

    event.emit(state, 'action:declare', {
      byUid: 'opp-actor2', uid: 'opp-actor2', player: 'opp',
      target: { kind: 'char', uid: 'self-source' }, targetUid: 'self-source',
    }, { player: 'opp', uid: 'opp-actor2' });
    runAllUntilEmpty(state);
    drainAiEffectPicks(state);
    runAllUntilEmpty(state);
    expect(state.players.self.scene[0]?.state).toBe('sleep');
    expect(readChar.declaredUseCount(state, 'self-source', 'a1', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
  });

  it.each(B03088_ROWS)('$cardId CPU chooses self over an eligible opponent target', row => {
    const state = b03088State(row, 'opp');
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'declaredAbility' && candidate.uid === 'opp-matsuda' && candidate.abilityId === 'a1'
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.opp.scene.find(card => card.uid === 'opp-matsuda')?.state).toBe('active');
    expect(readChar.ap(after, 'opp-matsuda')).toBe(6000);
    expect({ hand: after.players.opp.hand, targetState: after.players.self.scene.find(card => card.uid === 'self-target7')?.state, targetAp: readChar.ap(after, 'self-target7') }).toEqual({ hand: [DRAW], targetState: 'sleep', targetAp: 7000 });
  });

  it('B03095 CPU opponent action resolves the only Police target', () => {
    const state = b03095State('self', false);
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'actionAgainstChar'
      && candidate.byUid === 'opp-actor1'
      && candidate.targetUid === 'self-source'
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.find(card => card.uid === 'self-source')?.state).toBe('active');
  });
});
