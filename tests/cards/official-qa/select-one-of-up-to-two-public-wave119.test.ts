// qa: card:B04027:9bafe2020798f633e8f0c109144c9d2df6edaeea89943b94f2424dbc601e886a
// qa: card:B04042:9bafe2020798f633e8f0c109144c9d2df6edaeea89943b94f2424dbc601e886a
// qa: card:B04084:9bafe2020798f633e8f0c109144c9d2df6edaeea89943b94f2424dbc601e886a

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B04027 } from '@/cards/ct-p04/B04027';
import { B04027P } from '@/cards/ct-p04/B04027P';
import { B04042 } from '@/cards/ct-p04/B04042';
import { B04042P } from '@/cards/ct-p04/B04042P';
import { B04084 } from '@/cards/ct-p04/B04084';
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

const B04027_SOURCES = [B04027, B04027P] as const;
const B04042_SOURCES = [B04042, B04042P] as const;
const PARTNER_ALL = fixture('W119_PARTNER_ALL', {
  kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], ap: undefined, lp: 5,
});
const HIGH = fixture('W119_HIGH', { ap: 8000, level: 8 });
const LOW = fixture('W119_LOW', { ap: 4000, level: 4 });
const MID = fixture('W119_MID', { ap: 6000, level: 6 });
const LV6 = fixture('W119_LV6', { level: 6 });
const LV5 = fixture('W119_LV5', { level: 5 });
const LV4 = fixture('W119_LV4', { level: 4 });
const POL6 = fixture('W119_POL6', { level: 6, traits: ['警察'] });
const POL5 = fixture('W119_POL5', { level: 5, traits: ['警察'] });
const POL4 = fixture('W119_POL4', { level: 4, traits: ['警察'] });
const COST_A = fixture('W119_COST_A');
const COST_B = fixture('W119_COST_B');
const TAIL = fixture('W119_TAIL');

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['白'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave119 state');
  return state;
}

function base(source: CardDef, owner: Player, extraHand: readonly string[] = []): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, status: '解決編', colors: [...source.colors],
  };
  state.players[owner].partner = {
    cardId: PARTNER_ALL.id, state: 'active', colors: [...PARTNER_ALL.colors], location: 'partner-area',
  } as GameState['players']['self']['partner'];
  state.players[owner].file = Array.from(
    { length: source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: TAIL.id }),
  );
  state.players[owner].hand = [source.id, ...extraHand];
  return state;
}

function install(state: GameState, owner: Player): void {
  endMatchSession();
  beginMatchSession(owner);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function playEvent(source: CardDef, owner: Player): void {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: source.id }))
    .toEqual({ ok: true });
}

function pending(source: CardDef, verb: string) {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick).toMatchObject({
    atomVerb: verb,
    source: { cardId: source.id, abilityId: 'a1', abilityOrigin: 'printed', abilityIndex: 0 },
  });
  return pick!;
}

function resolve(pick: ReturnType<typeof pending>, uids: readonly string[]) {
  return dispatchEngineAction(bindPendingDecision(pick, {
    type: 'effectPickResolve',
    pickedUid: uids[0] ?? null,
    ...(uids.length > 0 ? { pickedUids: [...uids] } : {}),
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

function startB04084(owner: Player, hand: readonly string[] = [COST_A.id, COST_B.id]) {
  const state = base(B04084, owner, hand);
  state.players[owner].remove = [POL6.id, POL5.id, POL4.id];
  install(state, owner);
  playEvent(B04084, owner);
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional?.source).toMatchObject({ cardId: B04084.id, abilityId: 'a1' });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
  return useGameStateStore.getState().pendingEffectPick;
}

function payB04084(owner: Player) {
  const discard = pending(B04084, 'discard');
  expect(discard.candidates.map(candidate => candidate.cardId)).toEqual([COST_A.id, COST_B.id]);
  expect(resolve(discard, discard.candidates.map(candidate => candidate.uid))).toEqual({ ok: true });
  const group = pending(B04084, 'bindPick');
  expect(group).toMatchObject({ nMin: 0, nMax: 2, aggregateLevelMax: 10 });
  expect(group.candidates.map(candidate => candidate.cardId)).toEqual([POL6.id, POL5.id, POL4.id]);
  expect(current().players[owner].remove).toEqual(expect.arrayContaining([COST_A.id, COST_B.id]));
  return group;
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  for (const card of [
    PARTNER_ALL, HIGH, LOW, MID, LV6, LV5, LV4, POL6, POL5, POL4, COST_A, COST_B, TAIL,
  ]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave119: B04027/P independent up-to-one branches', () => {
  // Card-bound physical rows: B04027 B04027P.
  const patterns = [
    { label: 'zero and zero', high: false, low: false },
    { label: 'high only', high: true, low: false },
    { label: 'low only', high: false, low: true },
    { label: 'both maxima', high: true, low: true },
  ] as const;
  it.each(B04027_SOURCES.flatMap(source => (['self', 'opp'] as const).flatMap(owner => (
    patterns.map(pattern => ({ source, owner, pattern }))
  ))))('$source.id owner $owner selects $pattern.label', ({ source, owner, pattern }) => {
    const state = base(source, owner);
    state.players[owner].scene = [sceneChar(HIGH.id, 'high')];
    state.players[other(owner)].scene = [sceneChar(LOW.id, 'low'), sceneChar(MID.id, 'mid')];
    install(state, owner);
    playEvent(source, owner);

    const highPick = pending(source, 'sceneRemove');
    expect(highPick).toMatchObject({ nMin: 0, nMax: 1 });
    expect(highPick.candidates.map(candidate => candidate.uid)).toEqual(['high']);
    expect(resolve(highPick, pattern.high ? ['high'] : [])).toEqual({ ok: true });

    const lowPick = pending(source, 'sceneRemove');
    expect(lowPick).toMatchObject({ nMin: 0, nMax: 1 });
    expect(lowPick.candidates.map(candidate => candidate.uid)).toEqual(['low']);
    expect(resolve(lowPick, pattern.low ? ['low'] : [])).toEqual({ ok: true });

    expect(current().players[owner].remove.includes(HIGH.id)).toBe(pattern.high);
    expect(current().players[other(owner)].remove.includes(LOW.id)).toBe(pattern.low);
    expect(current().players[other(owner)].scene.some(card => card.uid === 'mid')).toBe(true);
    expectSettled();
  });
});

describe('official QA Wave119: B04042/P may select zero, one, or two under the level budget', () => {
  // Card-bound physical rows: B04042 B04042P.
  it.each(B04042_SOURCES.flatMap(source => (['self', 'opp'] as const).flatMap(owner => (
    [0, 1, 2].map(count => ({ source, owner, count }))
  ))))('$source.id owner $owner selects $count', ({ source, owner, count }) => {
    const state = base(source, owner);
    state.players[owner].scene = [sceneChar(LV6.id, 'lv6')];
    state.players[other(owner)].scene = [sceneChar(LV5.id, 'lv5'), sceneChar(LV4.id, 'lv4')];
    install(state, owner);
    playEvent(source, owner);
    const pick = pending(source, 'sceneSetState');
    expect(pick).toMatchObject({ nMin: 0, nMax: 2, aggregateLevelMax: 10 });
    expect(pick.candidates.map(candidate => candidate.uid).sort()).toEqual(['lv4', 'lv5', 'lv6']);
    const selected = count === 0 ? [] : count === 1 ? ['lv6'] : ['lv6', 'lv4'];
    expect(resolve(pick, selected)).toEqual({ ok: true });
    for (const uid of ['lv6', 'lv5', 'lv4']) {
      const character = [...current().players.self.scene, ...current().players.opp.scene]
        .find(card => card.uid === uid)!;
      expect(character.state).toBe(selected.includes(uid) ? 'stun' : 'active');
    }
    expectSettled();
  });

  it.each(B04042_SOURCES.flatMap(source => (['self', 'opp'] as const).map(owner => ({ source, owner }))))(
    '$source.id owner $owner rejects aggregate level eleven atomically',
    ({ source, owner }) => {
      const state = base(source, owner);
      state.players[owner].scene = [sceneChar(LV6.id, 'lv6')];
      state.players[other(owner)].scene = [sceneChar(LV5.id, 'lv5'), sceneChar(LV4.id, 'lv4')];
      install(state, owner);
      playEvent(source, owner);
      const pick = pending(source, 'sceneSetState');
      const before = JSON.stringify(current());
      expect(resolve(pick, ['lv6', 'lv5'])).toEqual({ ok: false, reason: 'not-allowed' });
      expect(JSON.stringify(current())).toBe(before);
      expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(pick.decisionId);
    },
  );
});

describe('official QA Wave119: B04084 one selected card enters active without a stale remainder', () => {
  // Card-bound physical row: B04084.
  it.each((['self', 'opp'] as const).flatMap(owner => [0, 1, 2].map(count => ({ owner, count }))))(
    'owner $owner selects $count after exact payment',
    ({ owner, count }) => {
      startB04084(owner);
      const group = payB04084(owner);
      const selected = count === 0
        ? []
        : count === 1
          ? [group.candidates.find(candidate => candidate.cardId === POL6.id)!.uid]
          : [
              group.candidates.find(candidate => candidate.cardId === POL6.id)!.uid,
              group.candidates.find(candidate => candidate.cardId === POL4.id)!.uid,
            ];
      expect(resolve(group, selected)).toEqual({ ok: true });
      if (count > 0) {
        const active = pending(B04084, 'sceneEnter');
        const activeUid = active.candidates.find(candidate => candidate.cardId === POL6.id)!.uid;
        expect(resolve(active, [activeUid])).toEqual({ ok: true });
      }
      if (count === 2) {
        const sleeping = pending(B04084, 'sceneEnter');
        const sleepingUid = sleeping.candidates.find(candidate => candidate.cardId === POL4.id)!.uid;
        expect(resolve(sleeping, [sleepingUid])).toEqual({ ok: true });
      }
      const entered = current().players[owner].scene.filter(card => [POL6.id, POL4.id].includes(card.cardId));
      expect(entered).toHaveLength(count);
      if (count >= 1) expect(entered.find(card => card.cardId === POL6.id)?.state).toBe('active');
      if (count === 2) expect(entered.find(card => card.cardId === POL4.id)?.state).toBe('sleep');
      expect(current().players[owner].remove).toContain(POL5.id);
      expectSettled();
    },
  );

  it.each(['self', 'opp'] as const)('owner %s rejects aggregate level eleven after payment', owner => {
    startB04084(owner);
    const group = payB04084(owner);
    const invalid = [POL6.id, POL5.id].map(cardId => (
      group.candidates.find(candidate => candidate.cardId === cardId)!.uid
    ));
    const before = JSON.stringify(current());
    expect(resolve(group, invalid)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(group.decisionId);
  });

  it.each(['self', 'opp'] as const)('owner %s cannot partially pay the exact two-card prerequisite', owner => {
    const firstPending = startB04084(owner, [COST_A.id]);
    expect(firstPending).toBeNull();
    expect(current().players[owner].hand).toEqual([COST_A.id]);
    expect(current().players[owner].remove).toEqual([POL6.id, POL5.id, POL4.id, B04084.id]);
    expectSettled();
  });
});
