// qa: card:PR060:f0205ebe785380650d240fdf4799be132d63a973ea8eedc201b577d4d66bc433
// qa: card:PR064:f0205ebe785380650d240fdf4799be132d63a973ea8eedc201b577d4d66bc433
// qa: card:PR154:f0205ebe785380650d240fdf4799be132d63a973ea8eedc201b577d4d66bc433

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { PR060 } from '@/cards/pr-01/PR060';
import { PR064 } from '@/cards/pr-01/PR064';
import { PR154 } from '@/cards/pr-01/PR154';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const SOURCES = [PR060, PR064, PR154] as const;
const PARTNER_GREEN = fixture('W117_PARTNER_GREEN', { kind: 'partner', colors: ['緑'], ap: undefined, lp: 5 });
const OWN_SLEEP = fixture('W117_OWN_SLEEP', { level: 5 });
const OPP_SLEEP = fixture('W117_OPP_SLEEP', { level: 6 });
const OPP_STUN = fixture('W117_OPP_STUN', { level: 6 });
const OPP_STUN_TWO = fixture('W117_OPP_STUN_TWO', { level: 4 });
const OPP_ACTIVE = fixture('W117_OPP_ACTIVE', { level: 4 });
const OPP_HIGH = fixture('W117_OPP_HIGH', { level: 8 });
const TAIL = fixture('W117_TAIL');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave117 state');
  return state;
}

function install(
  source: CardDef,
  owner: Player,
  options: {
    caseStatus?: '事件編' | '解決編';
    gate?: 'mixed' | 'sleep-active' | 'two-stun';
    ownTarget?: boolean;
  } = {},
): void {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case,
    status: options.caseStatus ?? '解決編',
    colors: ['緑'],
  };
  state.players[owner].partner = {
    cardId: PARTNER_GREEN.id, state: 'active', colors: ['緑'], location: 'partner-area',
  } as GameState['players']['self']['partner'];
  state.players[owner].file = Array.from(
    { length: source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: TAIL.id }),
  );
  state.players[owner].hand = [source.id];
  if (options.ownTarget !== false) {
    state.players[owner].scene = [sceneChar(OWN_SLEEP.id, 'own-sleep', { state: 'sleep' })];
  }
  const gate = options.gate ?? 'mixed';
  state.players[other(owner)].scene = gate === 'mixed'
    ? [
        sceneChar(OPP_SLEEP.id, 'opp-sleep', { state: 'sleep' }),
        sceneChar(OPP_STUN.id, 'opp-stun', { state: 'stun' }),
        sceneChar(OPP_ACTIVE.id, 'opp-active', { state: 'active' }),
        sceneChar(OPP_HIGH.id, 'opp-high', { state: 'sleep' }),
      ]
    : gate === 'two-stun'
      ? [
          sceneChar(OPP_STUN.id, 'opp-stun', { state: 'stun' }),
          sceneChar(OPP_STUN_TWO.id, 'opp-stun-two', { state: 'stun' }),
        ]
      : [
          sceneChar(OPP_SLEEP.id, 'opp-sleep', { state: 'sleep' }),
          sceneChar(OPP_ACTIVE.id, 'opp-active', { state: 'active' }),
        ];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
    .toEqual({ ok: true });
  surfacePendingSideChannels();
}

function pending(source: CardDef) {
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({
    atomVerb: 'sceneRemove', player: pick?.player, nMin: 0, nMax: 1,
    source: { cardId: source.id, abilityId: 'a1', abilityOrigin: 'printed', abilityIndex: 0 },
  });
  return pick!;
}

function resolve(pick: ReturnType<typeof pending>, uid: string | null) {
  return dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve', pickedUid: uid,
  }));
}

function expectSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick).toBeNull();
  expect(store.pendingEffectOptional).toBeNull();
  expect(store.pendingEffectChoice).toBeNull();
  expect(current().pendingRuntimeState).toBeUndefined();
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [PARTNER_GREEN, OWN_SLEEP, OPP_SLEEP, OPP_STUN, OPP_STUN_TWO, OPP_ACTIVE, OPP_HIGH, TAIL]) {
    register(card);
  }
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave117: stun opens the gate but is not a sleep removal target', () => {
  // Card-bound physical rows: PR060 PR064 PR154.
  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).flatMap(owner => (
    (['own', 'opponent'] as const).map(target => ({ source, owner, target }))
  ))))('$source.id owner $owner may remove an eligible $target sleep card', ({ source, owner, target }) => {
    install(source, owner);
    const pick = pending(source);
    expect(pick.player).toBe(owner);
    expect(pick.candidates.map(candidate => candidate.uid).sort()).toEqual(['opp-sleep', 'own-sleep']);
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('opp-stun');
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('opp-active');
    expect(pick.candidates.map(candidate => candidate.uid)).not.toContain('opp-high');
    const uid = target === 'own' ? 'own-sleep' : 'opp-sleep';
    expect(resolve(pick, uid)).toEqual({ ok: true });
    expect(current().players[owner].scene.some(card => card.cardId === source.id)).toBe(true);
    expect(current().players[other(owner)].scene.find(card => card.uid === 'opp-stun')?.state).toBe('stun');
    const removedSide = target === 'own' ? owner : other(owner);
    expect(current().players[removedSide].remove).toContain(target === 'own' ? OWN_SLEEP.id : OPP_SLEEP.id);
    expectSettled();
  });

  it.each(SOURCES)('$id counts two stun cards and may remove an owner sleep card', source => {
    install(source, 'self', { gate: 'two-stun' });
    const pick = pending(source);
    expect(pick.candidates.map(candidate => candidate.uid)).toEqual(['own-sleep']);
    expect(resolve(pick, 'own-sleep')).toEqual({ ok: true });
    expect(current().players.opp.scene.map(card => card.state)).toEqual(['stun', 'stun']);
  });

  it.each(['self', 'opp'] as const)('two stun cards and no sleep target settle for owner %s', owner => {
    install(PR060, owner, { gate: 'two-stun', ownTarget: false });
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players[other(owner)].scene.map(card => card.state)).toEqual(['stun', 'stun']);
    expect(current().players[owner].scene.some(card => card.cardId === PR060.id)).toBe(true);
    expectSettled();
  });

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner rejects one sleep plus one active as the two-card gate',
    ({ source, owner }) => {
      install(source, owner, { gate: 'sleep-active' });
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players[owner].scene.some(card => card.uid === 'own-sleep')).toBe(true);
      expect(current().players[other(owner)].scene.map(card => card.uid)).toEqual(['opp-sleep', 'opp-active']);
      expectSettled();
    },
  );

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner may select zero despite eligible sleep cards',
    ({ source, owner }) => {
      install(source, owner);
      expect(resolve(pending(source), null)).toEqual({ ok: true });
      expect(current().players[owner].remove).toEqual([]);
      expect(current().players[other(owner)].remove).toEqual([]);
      expect(current().players[other(owner)].scene.find(card => card.uid === 'opp-stun')?.state).toBe('stun');
      expectSettled();
    },
  );

  it.each(SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner does not fire outside the resolved case',
    ({ source, owner }) => {
      install(source, owner, { caseStatus: '事件編' });
      expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
      expect(current().players[owner].scene.some(card => card.cardId === source.id)).toBe(true);
      expect(current().players[owner].scene.some(card => card.uid === 'own-sleep')).toBe(true);
      expect(current().players[other(owner)].scene.find(card => card.uid === 'opp-stun')?.state).toBe('stun');
      expectSettled();
    },
  );
});
