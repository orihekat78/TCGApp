// qa: card:B01085:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54
// qa: card:B02002:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54
// qa: card:B02014:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54
// qa: card:B05048:7516cd02c9848ddc808d369cd3af22fc7928580f38f6762c35b66bb22678cbcf
// qa: card:D02004:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54
// qa: card:D02008:151b435edeb61c22d4471596da22371c8592c23c410528efb5e78938a1bb3b54
// qa: card:D08021:48b267b665b93068b48a3841335d719e52488557dca2c79e94e14777d0fb5d3a
// qa: card:D09008:7516cd02c9848ddc808d369cd3af22fc7928580f38f6762c35b66bb22678cbcf
// qa: card:D09009:7516cd02c9848ddc808d369cd3af22fc7928580f38f6762c35b66bb22678cbcf
// qa: card:D09016:7516cd02c9848ddc808d369cd3af22fc7928580f38f6762c35b66bb22678cbcf
// qa: card:D09017:7516cd02c9848ddc808d369cd3af22fc7928580f38f6762c35b66bb22678cbcf
// qa: card:PR283:7516cd02c9848ddc808d369cd3af22fc7928580f38f6762c35b66bb22678cbcf
// Rules: action:declare fires after target selection/source sleep and before guard.
// Wave48 direct routes: B01085/B02002/D02004/D02008/D09008/D09009/PR283.
// Wave49 decision/grant/order routes: B02014/B05048/D08021/D09016/D09017.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01085 } from '@/cards/ct-p01/B01085';
import { B02002 } from '@/cards/ct-p02/B02002';
import { B02014 } from '@/cards/ct-p02/B02014';
import { B05048 } from '@/cards/ct-p05/B05048';
import { D02004 } from '@/cards/ct-d02/D02004';
import { D02008 } from '@/cards/ct-d02/D02008';
import { D08021 } from '@/cards/ct-d08/D08021';
import { D09008 } from '@/cards/ct-d09/D09008';
import { D09009 } from '@/cards/ct-d09/D09009';
import { D09016 } from '@/cards/ct-d09/D09016';
import { D09017 } from '@/cards/ct-d09/D09017';
import { PR283 } from '@/cards/pr-01/PR283';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _getContext, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import { createMainGameState } from '../../helpers/main-game-state';

const TARGET = 'W48_TARGET';
const DRAW_A = 'W48_DRAW_A';
const DRAW_B = 'W48_DRAW_B';
const HIGH = 'W48_HIGH';
const RED = 'W48_RED';
const YELLOW = 'W48_YELLOW';
const BLUE = 'W48_BLUE';
const WHITE_ENTRY = 'W48_WHITE_ENTRY';
const NAGANO = 'W48_NAGANO';
const BOY = 'W48_BOY';
const CUTIN = 'W48_CUTIN';

type Player = 'self' | 'opp';
type DeclareObservation = { byUid: string; targetUid: string | null; sourceState: string | undefined };

let observedDeclare: DeclareObservation | null = null;

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3,
    ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures = [
  fixture(TARGET, { ap: 9000 }),
  fixture(DRAW_A),
  fixture(DRAW_B),
  fixture(HIGH, { level: 5 }),
  fixture(RED, { colors: ['赤'], level: 7 }),
  fixture(YELLOW, { colors: ['黄'], level: 7 }),
  fixture(BLUE, { colors: ['青'], level: 7 }),
  fixture(WHITE_ENTRY, { colors: ['白'], level: 5 }),
  fixture(NAGANO, { colors: ['黄'], traits: ['長野県警'] }),
  fixture(BOY, { level: 3, traits: ['少年探偵団'] }),
  fixture(CUTIN, {
    kind: 'event', level: 1,
    abilities: [{
      id: 'ci', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true },
      effect: { kind: 'atom', verb: 'noop', args: {} },
      description: 'Wave48 cut-in fixture', ruleRefs: [],
    }],
  }),
];

function cardBacks(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const, cardId: `W48_FILE_${index}`,
  }));
}

function stateFor(cardId: string): GameState {
  const state = createMainGameState();
  state.players.self.case.colors = ['青', '白', '黄', '緑'];
  state.players.self.file = cardBacks(7);
  state.players.self.deck = [DRAW_A, DRAW_B, DRAW_A, DRAW_B, DRAW_A, DRAW_B];
  state.players.self.scene = [sceneChar(cardId, 'source')];
  state.players.opp.scene = [sceneChar(TARGET, 'target', { state: 'sleep' })];
  state.players.opp.deck = [HIGH, DRAW_A, DRAW_B];
  return state;
}

function install(state: GameState, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  observedDeclare = null;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave48 state');
  return state;
}

function assertDeclareBoundary(): string {
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(observedDeclare).toEqual({ byUid: 'source', targetUid: 'target', sourceState: 'sleep' });
  expect(current().players.self.scene.find(character => character.uid === 'source')?.state).toBe('sleep');
  expect(_getContext(current(), actionId!)).toMatchObject({
    id: actionId, byUid: 'source', phase: 'guard-window', target: { kind: 'char', uid: 'target' },
  });
  expect(_getContext(current(), actionId!)?.guardUid).toBeUndefined();
  return actionId!;
}

function declareSource(): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'source', targetUid: 'target' }))
    .toEqual({ ok: true });
  return assertDeclareBoundary();
}

function expectGuardBlocked(actionId: string): void {
  const before = JSON.stringify(current());
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
    .toEqual({ ok: false, reason: 'not-allowed' });
  expect(JSON.stringify(current())).toBe(before);
}

function simpleDraw(cardId: string) {
  const state = stateFor(cardId);
  install(state, `w48-draw-${cardId}`);
  const actionId = declareSource();
  return {
    actionId,
    handCount: current().players.self.hand.length,
    phase: _getContext(current(), actionId)?.phase,
    sourceState: current().players.self.scene.find(character => character.uid === 'source')?.state,
  };
}

function naganoDrawDiscard(cardId: string) {
  const state = stateFor(cardId);
  state.players.self.file = cardBacks(6);
  state.players.self.hand = [NAGANO];
  install(state, `w48-nagano-${cardId}`);
  const actionId = declareSource();
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source).toMatchObject({ cardId, uid: 'source', abilityId: 'a1' });
  expectGuardBlocked(actionId);
  const nagano = pick?.candidates.find(candidate => candidate.cardId === NAGANO);
  expect(nagano).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: nagano!.uid,
  }))).toEqual({ ok: true });
  return {
    sourceAp: readChar.ap(current(), 'source'),
    hand: [...current().players.self.hand],
    remove: [...current().players.self.remove],
    phase: _getContext(current(), actionId)?.phase,
  };
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetActionContexts();
  resetPendingRuntimeState();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  event.on('action:declare', (state, payload) => {
    const value = payload as { byUid?: string; target?: { kind?: string; uid?: string } };
    if (value.byUid !== 'source') return;
    const owner: Player = state.players.self.scene.some(character => character.uid === value.byUid) ? 'self' : 'opp';
    observedDeclare = {
      byUid: value.byUid,
      targetUid: value.target?.kind === 'char' ? value.target.uid ?? null : null,
      sourceState: state.players[owner].scene.find(character => character.uid === value.byUid)?.state,
    };
  });
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetActionContexts();
  endMatchSession();
  useGameStateStore.getState().resetMatchSessionState();
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Waves48-49: action-declare abilities resolve before guard', () => {
  it('B01085 sleeps, reveals, and applies its found-card AP before guard', () => {
    const state = stateFor(B01085.id);
    install(state, 'w48-B01085');
    const actionId = declareSource();
    surfacePendingSideChannels();
    expect({
      ap: readChar.ap(current(), 'source'),
      phase: _getContext(current(), actionId)?.phase,
      reveal: useGameStateStore.getState().pendingDeckReveal,
    }).toMatchObject({
      ap: 5000,
      phase: 'guard-window',
      reveal: { player: 'opp', revealed: [HIGH], source: { cardId: B01085.id, abilityId: 'a1' } },
    });
    expect(readChar.ap(current(), 'source'), B01085.id).toBe(5000);
  });

  it('B02002 snapshots non-blue scene count and gains AP before guard', () => {
    const state = stateFor(B02002.id);
    state.players.self.scene.push(sceneChar(RED, 'red'), sceneChar(YELLOW, 'yellow'), sceneChar(BLUE, 'blue'));
    install(state, 'w48-B02002');
    const actionId = declareSource();
    expect({ ap: readChar.ap(current(), 'source'), phase: _getContext(current(), actionId)?.phase })
      .toEqual({ ap: 7000, phase: 'guard-window' });
    expect(readChar.ap(current(), 'source'), B02002.id).toBe(7000);
  });

  it('B02014 grants a draw-on-action that resolves before guard', () => {
    const state = stateFor(BOY);
    state.players.self.hand = [B02014.id];
    install(state, 'w48-B02014');
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B02014.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.candidates.map(candidate => candidate.uid)).toContain('source');
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: 'source', pickedUids: ['source'],
    }))).toEqual({ ok: true });
    expect(readChar.hasKeyword(current(), 'source', '突撃[事件]')).toBe(true);
    const handBefore = current().players.self.hand.length;
    const actionId = declareSource();
    expect({ handDelta: current().players.self.hand.length - handBefore, phase: _getContext(current(), actionId)?.phase })
      .toEqual({ handDelta: 1, phase: 'guard-window' });
    expect(current().players.self.hand.length - handBefore, B02014.id).toBe(1);
  });

  it('B05048 opens its remove-area entry choice before guard', () => {
    const state = stateFor(B05048.id);
    state.players.self.remove = [WHITE_ENTRY];
    install(state, 'w48-B05048');
    const actionId = declareSource();
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.source).toMatchObject({ cardId: B05048.id, uid: 'source', abilityId: 'a2' });
    expectGuardBlocked(actionId);
    const entry = pick?.candidates.find(candidate => candidate.cardId === WHITE_ENTRY);
    expect(entry).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve', pickedUid: entry!.uid,
    }))).toEqual({ ok: true });
    expect({ entered: current().players.self.scene.some(character => character.cardId === WHITE_ENTRY), phase: _getContext(current(), actionId)?.phase })
      .toEqual({ entered: true, phase: 'guard-window' });
    expect(current().players.self.scene.some(character => character.cardId === WHITE_ENTRY), B05048.id).toBe(true);
  });

  it('D02004 counts sleep/stun targets and gains action AP before guard', () => {
    const state = stateFor(D02004.id);
    state.players.opp.scene.push(
      sceneChar(TARGET, 'stun-decoy', { state: 'stun' }),
      sceneChar(TARGET, 'active-decoy', { state: 'active' }),
    );
    install(state, 'w48-D02004');
    const actionId = declareSource();
    expect({ ap: readChar.ap(current(), 'source'), phase: _getContext(current(), actionId)?.phase })
      .toEqual({ ap: 6000, phase: 'guard-window' });
    expect(readChar.ap(current(), 'source'), D02004.id).toBe(6000);
  });

  it('D02008 sets the opponent cut-in ban before guard', () => {
    const state = stateFor(D02008.id);
    state.players.opp.hand = [CUTIN];
    install(state, 'w48-D02008');
    const actionId = declareSource();
    const source = current().players.self.scene.find(character => character.uid === 'source');
    expect({ ban: source?.turnEffects.cutinBanOpp_action, phase: _getContext(current(), actionId)?.phase })
      .toEqual({ ban: true, phase: 'guard-window' });
    expect(source?.turnEffects.cutinBanOpp_action, D02008.id).toBe(true);
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(_getContext(current(), actionId)).toMatchObject({ phase: 'action-1', firstUid: 'source' });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(_getContext(current(), actionId)).toMatchObject({ phase: 'action-2', secondUid: 'target' });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'opp', choice: { kind: 'cutin', cardId: CUTIN },
    })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('D08021 queues both five-stack action abilities before guard and resolves them there', () => {
    const state = stateFor(D08021.id);
    state.players.self.scene = [sceneChar(D08021.id, 'source', { stackedCards: 5 })];
    install(state, 'w48-D08021');
    const actionId = declareSource();
    const group = pendingOwnerOrderGroup(current(), 'self')
      .filter(entry => entry.source.cardId === D08021.id)
      .sort((left, right) => (left.source.abilityId ?? '').localeCompare(right.source.abilityId ?? ''));
    expect(group.map(entry => entry.source.abilityId), D08021.id).toEqual(['a3', 'a4']);
    const paused = structuredClone(current());
    const expectPausedStepBlocked = (
      configure: (state: GameState) => void,
      action: Parameters<typeof dispatchEngineAction>[0],
    ) => {
      const variant = structuredClone(paused);
      configure(variant);
      expect(useGameStateStore.getState().setGameState(variant)).toBe(true);
      const before = JSON.stringify(current());
      expect(dispatchEngineAction(action)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
    };
    expectPausedStepBlocked(() => {}, { type: 'actionGuard', actionId, guarderUid: null });
    expectPausedStepBlocked((state) => { state.actionContexts![actionId]!.phase = 'leave-resolution'; }, {
      type: 'actionAdvance', actionId,
    });
    expectPausedStepBlocked((state) => { state.actionContexts![actionId]!.phase = 'judge'; }, {
      type: 'actionJudge', actionId,
    });
    expectPausedStepBlocked((state) => {
      Object.assign(state.actionContexts![actionId]!, {
        phase: 'action-1', firstUid: 'source', secondUid: 'target', firstActed: undefined,
      });
    }, { type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } });
    expect(useGameStateStore.getState().setGameState(paused)).toBe(true);
    group.forEach((entry, order) => {
      expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: entry.id, order, player: 'self' }))
        .toEqual({ ok: true });
    });
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', player: 'self', entryIds: group.map(entry => entry.id) }))
      .toEqual({ ok: true });
    expect({ hand: current().players.self.hand.length, evidence: current().players.self.evidence.length, phase: _getContext(current(), actionId)?.phase })
      .toEqual({ hand: 1, evidence: 1, phase: 'guard-window' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    expect(_getContext(current(), actionId)?.phase).toBe('leave-resolution');
  });

  it('D09008 draws before guard', () => {
    expect(simpleDraw(D09008.id), D09008.id).toMatchObject({ handCount: 1, phase: 'guard-window', sourceState: 'sleep' });
  });

  it('D09009 draws before guard', () => {
    expect(simpleDraw(D09009.id), D09009.id).toMatchObject({ handCount: 1, phase: 'guard-window', sourceState: 'sleep' });
  });

  it('D09016 draws and opens mandatory discard before guard', () => {
    expect(naganoDrawDiscard(D09016.id), D09016.id).toEqual({ sourceAp: 5000, hand: [DRAW_A], remove: [NAGANO], phase: 'guard-window' });
  });

  it('D09017 draws and opens mandatory discard before guard', () => {
    expect(naganoDrawDiscard(D09017.id), D09017.id).toEqual({ sourceAp: 5000, hand: [DRAW_A], remove: [NAGANO], phase: 'guard-window' });
  });

  it('PR283 draws before guard', () => {
    expect(simpleDraw(PR283.id), PR283.id).toMatchObject({ handCount: 1, phase: 'guard-window', sourceState: 'sleep' });
  });
});
