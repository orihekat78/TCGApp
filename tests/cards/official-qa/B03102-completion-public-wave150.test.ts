// qa: card:B03102:0d310607ecb1545941beca62cb928c162123c380c3ec000be0d418c018300f0c
// qa: card:B03102:5bc3bbbf1d67f3f2b633fd036fbbba931355c206cfed03b10635ccd894f13bc1
// qa: card:B03102:d9dae1726ce1b1757956c9f650c92cb0f5298878d8abe941b4def9387ecdd306
// qa: card:B03102:df53870dd5d17d4c1a2cd4154c3783a655d97554cf5937bafad10797564ab4aa

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B03102 } from '@/cards/ct-p03/B03102';
import { D02009 } from '@/cards/ct-d02/D02009';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetMisreadRegistered, _resetPendingMisread, registerMisreadListener } from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' || kind === 'partner' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const POLICE_ZERO = fixture('W150_POLICE_ZERO', { level: 4, lp: 0, traits: ['警察'] });
const PARTNER = fixture('W150_PARTNER', { kind: 'partner', ap: undefined, lp: 1 });
const TAIL = fixture('W150_TAIL');
const REACTIVATOR_ABILITY: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: {
    kind: 'atom', verb: 'sceneSetState',
    args: {
      player: 'self', side: 'self', max: 1, state: 'active',
      filter: { cardName: '遠山銀司郎' },
    },
  },
  description: 'Activate one own Ginshiro Toyama.',
  ruleRefs: ['rules/03-field-areas.md'],
};
const REACTIVATOR = fixture('W150_REACTIVATOR', { abilities: [REACTIVATOR_ABILITY] });

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave150 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  resetPresentationQueue(`qa-wave150-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function reactivateReasoner(): void {
  expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'reactivator', abilId: 'a1' }))
    .toEqual({ ok: true });
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({ atomVerb: 'sceneSetState' });
  expect(pick?.candidates.map(candidate => candidate.uid)).toEqual(['reasoner']);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'reasoner',
  }))).toEqual({ ok: true });
}

beforeEach(() => {
  resetPendingRuntimeState();
  _resetPendingMisread();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetMisreadRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  for (const card of [POLICE_ZERO, PARTNER, TAIL, REACTIVATOR]) register(card);
  registerMisreadListener();
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  _resetPendingMisread();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave150: B03102 reasoning timing', () => {
  it('applies after the police character sleeps and before Misread or evidence', () => {
    const state = createEmptyGameState();
    state.turn = { number: 50, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [
      sceneChar(B03102.id, 'source'),
      sceneChar(D02009.id, 'reasoner'),
    ];
    state.players.opp.deck = [TAIL.id];
    state.players.self.scene = [sceneChar(D02009.id, 'misread')];
    install(state, 'self', 'before-misread');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(current().players.opp.scene.find(character => character.uid === 'reasoner')?.state).toBe('sleep');
    expect(readChar.ap(current(), 'source')).toBe(6000);
    expect(current().players.opp.evidence).toHaveLength(0);
    expect(useGameStateStore.getState().pendingMisread).toMatchObject({
      reasoningPlayer: 'opp', reasoningUid: 'reasoner', candidates: [{ uid: 'misread', x: 1 }],
    });
  });
});

describe('official QA Wave150: B03102 character and LP boundaries', () => {
  it('does not fire when its partner reasons', () => {
    const state = createEmptyGameState();
    state.turn = { number: 50, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B03102.id, 'source')];
    state.players.self.partner = {
      cardId: PARTNER.id, state: 'active', colors: ['黄'], location: 'partner-area',
    } as GameState['players']['self']['partner'];
    state.players.self.deck = [TAIL.id];
    install(state, 'self', 'partner');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' })).toEqual({ ok: true });
    expect(current().players.self.partner.state).toBe('sleep');
    expect(current().players.self.evidence).toHaveLength(1);
    expect(readChar.ap(current(), 'source')).toBe(5000);
  });

  it('fires for a qualifying LP0 police character while evidence stays zero', () => {
    const state = createEmptyGameState();
    state.turn = { number: 50, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B03102.id, 'source'),
      sceneChar(POLICE_ZERO.id, 'reasoner'),
    ];
    state.players.self.deck = [TAIL.id];
    install(state, 'self', 'lp-zero');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(readChar.ap(current(), 'source')).toBe(6000);
    expect(current().players.self.evidence).toHaveLength(0);
  });
});

describe('official QA Wave150: B03102 has no Turn1', () => {
  it('stacks on every qualifying reasoning and expires at turn end', () => {
    const state = createEmptyGameState();
    state.turn = { number: 50, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B03102.id, 'source'),
      sceneChar(D02009.id, 'reasoner'),
      sceneChar(REACTIVATOR.id, 'reactivator'),
    ];
    state.players.self.deck = [TAIL.id, TAIL.id, TAIL.id];
    install(state, 'self', 'repeat');

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(readChar.ap(current(), 'source')).toBe(6000);
    reactivateReasoner();
    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    expect(readChar.ap(current(), 'source')).toBe(7000);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(readChar.ap(current(), 'source')).toBe(5000);
  });
});
