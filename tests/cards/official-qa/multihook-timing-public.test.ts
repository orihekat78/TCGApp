// qa: card:D03007:f99615ed14f068c2665eb794f70f387bc172946f72a10011407b0a091f842aa3
// qa: card:B02004:f99615ed14f068c2665eb794f70f387bc172946f72a10011407b0a091f842aa3
// qa: card:B04039:2f88f1f8690a3760b8d4c020c17dc0c623c0174bb3f83930ecfae2064ebdb74a

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02004 } from '@/cards/ct-p02/B02004';
import { B02004P } from '@/cards/ct-p02/B02004P';
import { B04039 } from '@/cards/ct-p04/B04039';
import { D03007 } from '@/cards/ct-d03/D03007';
import { D10023 } from '@/cards/ct-d10/D10023';
import { PR173 } from '@/cards/pr-01/PR173';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const DRAW_FIRST = 'QA_MULTIHOOK_DRAW_FIRST';
const EVIDENCE_SECOND = 'QA_MULTIHOOK_EVIDENCE_SECOND';
const ACTION_TARGET = 'QA_MULTIHOOK_ACTION_TARGET';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  };
}

const enterDraw: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
};

const SHIRAISHI = character('QA_MULTIHOOK_SHIRAISHI', { names: ['白馬探'] });
const KUDO = character('QA_MULTIHOOK_KUDO', { names: ['工藤新一'] });
const EIRI = character('QA_MULTIHOOK_EIRI', { names: ['妃英理'], colors: ['青'], level: 3, abilities: [enterDraw] });
const TARGET = character(ACTION_TARGET, { colors: ['赤'], ap: 1000, lp: 1 });

function base(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.deck = [DRAW_FIRST, EVIDENCE_SECOND];
  return state;
}

function install(state: GameState): void {
  endMatchSession();
  beginMatchSession('self');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _resetActionContexts();
  registerAll();
  [SHIRAISHI, KUDO, EIRI, TARGET].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('official reasoning/action multi-hook timing through public dispatch', () => {
  it('D03007 draws after the reasoner sleeps but before reasoning adds evidence', () => {
    const state = base();
    state.players.self.scene = [makeChar({ cardId: D03007.id, uid: 'reasoner', state: 'active' })];
    install(state);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });

    expect(current().players.self.hand).toEqual([DRAW_FIRST]);
    expect(current().players.self.evidence.map(card => card.cardId)).toEqual([EVIDENCE_SECOND]);
  });

  it('B04039 observes Shirai reasoning before evidence is added', () => {
    const state = base();
    state.players.self.scene = [
      makeChar({ cardId: B04039.id, uid: 'watson', state: 'active' }),
      makeChar({ cardId: SHIRAISHI.id, uid: 'reasoner', state: 'active' }),
    ];
    install(state);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });

    expect(current().players.self.hand).toEqual([DRAW_FIRST]);
    expect(current().players.self.evidence.map(card => card.cardId)).toEqual([EVIDENCE_SECOND]);
  });

  it('B02004 surfaces its reanimate before evidence, then the entered trigger resolves before reasoning resumes', () => {
    const state = base();
    state.players.self.scene = [
      makeChar({ cardId: B02004.id, uid: 'reasoner', state: 'active', lpOverride: 1 }),
      makeChar({ cardId: KUDO.id, uid: 'bond', state: 'active' }),
    ];
    state.players.self.remove = [EIRI.id];
    install(state);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(current().players.self.evidence, 'effect must precede evidence').toHaveLength(0);

    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.source).toMatchObject({ cardId: B02004.id, abilityId: 'a1' });
    const eiri = pending!.candidates.find(candidate => candidate.cardId === EIRI.id);
    expect(eiri).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: eiri!.uid,
    }))).toEqual({ ok: true });

    expect(current().players.self.scene.some(card => card.cardId === EIRI.id)).toBe(true);
    expect(current().players.self.hand).toEqual([DRAW_FIRST]);
    expect(current().players.self.evidence.map(card => card.cardId)).toEqual([EVIDENCE_SECOND]);
    expect(B02004P.abilities).toEqual(B02004.abilities);
    expect(D10023.abilities).toEqual(B02004.abilities);
    expect(PR173.abilities).toEqual(B02004.abilities);
  });

  it('D03007 action sleeps, draws, and remains before the public guard decision', () => {
    const contacts: unknown[] = [];
    event.on('contact:start', (_state, payload) => { contacts.push(payload); });
    const state = base();
    state.players.self.scene = [makeChar({ cardId: D03007.id, uid: 'actor', state: 'active' })];
    state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'target', state: 'sleep' })];
    install(state);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' })).toEqual({ ok: true });

    expect(current().players.self.scene[0]?.state).toBe('sleep');
    expect(current().players.self.hand).toEqual([DRAW_FIRST]);
    expect(useGameStateStore.getState().activeActionId).toBeTruthy();
    expect(contacts).toEqual([]);
  });

  it('B04039 observes Hakuba action and draws before the public guard decision', () => {
    const contacts: unknown[] = [];
    event.on('contact:start', (_state, payload) => { contacts.push(payload); });
    const state = base();
    state.players.self.scene = [
      makeChar({ cardId: B04039.id, uid: 'watson', state: 'active' }),
      makeChar({ cardId: SHIRAISHI.id, uid: 'actor', state: 'active' }),
    ];
    state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'target', state: 'sleep' })];
    install(state);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' })).toEqual({ ok: true });

    expect(current().players.self.scene.find((card) => card.uid === 'actor')?.state).toBe('sleep');
    expect(current().players.self.hand).toEqual([DRAW_FIRST]);
    expect(useGameStateStore.getState().activeActionId).toBeTruthy();
    expect(contacts).toEqual([]);
  });

  it('B02004 action surfaces its reanimate and blocks guard until the choice resolves', () => {
    const state = base();
    state.players.self.scene = [
      makeChar({ cardId: B02004.id, uid: 'actor', state: 'active', lpOverride: 1 }),
      makeChar({ cardId: KUDO.id, uid: 'bond', state: 'active' }),
    ];
    state.players.self.remove = [EIRI.id];
    state.players.opp.scene = [makeChar({ cardId: ACTION_TARGET, uid: 'target', state: 'sleep' })];
    install(state);

    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(current().players.self.scene.find((card) => card.uid === 'actor')?.state).toBe('sleep');
    expect(pending?.source).toMatchObject({ cardId: B02004.id, abilityId: 'a1' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: false, reason: 'not-allowed' });

    const eiri = pending!.candidates.find((candidate) => candidate.cardId === EIRI.id);
    expect(eiri).toBeTruthy();
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve', pickedUid: eiri!.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.scene.some((card) => card.cardId === EIRI.id)).toBe(true);
    expect(current().players.self.hand).toEqual([DRAW_FIRST]);
  });
});
