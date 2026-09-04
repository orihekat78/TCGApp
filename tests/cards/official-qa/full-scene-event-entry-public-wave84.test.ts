// qa: card:B05062:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B07090:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B08029:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:D08024:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:D09025:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:PR291:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:PR297:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// Rules: 03-field-areas, 15-abilities-effects, 17-icons, 20-color-and-switch,
// 25-qa-effects-resolution.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards';
import { B08029 } from '@/cards/ct-p08/B08029';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, EffectCtx, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const CASE_ALL = 'W84-CASE-ALL';
const PARTNER_ALL = 'W84-PARTNER-ALL';
const FILLER = 'W84-FILLER';
const KID = 'W84-KID';
const ENTRY = 'W84-ENTRY';
const TYPED_DECOY = 'W84-TYPED-DECOY';
const DRAW = 'W84-DRAW';

const enterDraw: AbilityDef = {
  id: 'enter-draw',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Wave84 nested enter observer.',
  ruleRefs: ['rules/17-icons.md'],
};

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id,
    no: `test/${id}`,
    kind,
    names: [id],
    colors: ['白'],
    level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(CASE_ALL, {
    kind: 'case',
    colors: ['青', '緑', '白', '黄', '赤', '黒'],
    caseLevel: 10,
    caseTraits: [],
  }),
  fixture(PARTNER_ALL, {
    kind: 'partner',
    colors: ['青', '緑', '白', '黄', '赤', '黒'],
    lp: 5,
  }),
  fixture(FILLER),
  fixture(KID, { names: ['怪盗キッド'] }),
  fixture(DRAW, { kind: 'event' }),
  fixture(ENTRY, {
    names: ['京極真', '伊織無我'],
    colors: ['白'],
    level: 3,
    traits: ['鈴木財閥', '警視庁', '少年探偵団', '長野県警'],
    abilities: [enterDraw],
  }),
  fixture(TYPED_DECOY, {
    kind: 'event',
    names: ['京極真', '伊織無我'],
    colors: ['白'],
    level: 3,
    traits: ['鈴木財閥', '警視庁', '少年探偵団', '長野県警'],
  }),
];

type Route = 'direct-remove' | 'b05062-choice' | 'b08029-choice' | 'partner-hand';

type Row = {
  cardId: string;
  baseId: string;
  route: Route;
  enteredState: 'active' | 'sleep';
};

const ROWS: Row[] = [
  { cardId: 'B05062', baseId: 'B05062', route: 'b05062-choice', enteredState: 'active' },
  { cardId: 'B07090', baseId: 'B07090', route: 'direct-remove', enteredState: 'active' },
  { cardId: 'B07090P', baseId: 'B07090', route: 'direct-remove', enteredState: 'active' },
  { cardId: 'B08029', baseId: 'B08029', route: 'b08029-choice', enteredState: 'active' },
  { cardId: 'B08029P', baseId: 'B08029', route: 'b08029-choice', enteredState: 'active' },
  { cardId: 'D08024', baseId: 'D08024', route: 'direct-remove', enteredState: 'active' },
  { cardId: 'D09025', baseId: 'D09025', route: 'direct-remove', enteredState: 'active' },
  { cardId: 'PR291', baseId: 'PR291', route: 'partner-hand', enteredState: 'sleep' },
  { cardId: 'PR297', baseId: 'PR297', route: 'partner-hand', enteredState: 'sleep' },
];

const BASE_ROWS = ROWS.filter(row => row.cardId === row.baseId);

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave84 state');
  return state;
}

function victimUid(player: Player): string {
  return `${player}-w84-victim`;
}

function prepared(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 28, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  const player = state.players[owner];
  player.partner = { cardId: PARTNER_ALL, state: 'active', location: 'partner-area' };
  player.case = {
    ...player.case,
    cardId: CASE_ALL,
    status: '解決編',
    colors: ['青', '緑', '白', '黄', '赤', '黒'],
  };
  player.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  player.deck = [DRAW, FILLER, FILLER];
  player.scene = [
    sceneChar(KID, `${owner}-w84-kid`),
    sceneChar(FILLER, victimUid(owner), { state: 'stun' }),
    sceneChar(FILLER, `${owner}-w84-fill-2`, { state: 'sleep' }),
    sceneChar(FILLER, `${owner}-w84-fill-3`, { state: 'active', isNamed: true }),
    sceneChar(FILLER, `${owner}-w84-fill-4`),
  ];
  if (row.route === 'partner-hand') {
    player.hand = [row.cardId, ENTRY, TYPED_DECOY];
  } else {
    player.hand = [row.cardId];
    player.remove = [ENTRY, TYPED_DECOY];
  }
  state.players[other(owner)].scene = [sceneChar(FILLER, `${other(owner)}-w84-cross-victim`)];
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-w84-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function resolveChoice(row: Row, choiceIndex: number): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectChoice;
  expect(pending, `${row.cardId}: choice authority`).toMatchObject({
    player: expect.any(String),
    source: { cardId: row.cardId, abilityId: 'a1' },
  });
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'choiceResolve',
    choiceIndex,
  }))).toEqual({ ok: true });
}

function reachEntry(row: Row, owner: Player, label: string) {
  install(prepared(row, owner), label, owner);
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: row.cardId }))
    .toEqual({ ok: true });
  if (row.route === 'b05062-choice') resolveChoice(row, 1);
  if (row.route === 'b08029-choice') resolveChoice(row, 0);

  for (let step = 0; step < 3; step += 1) {
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending, `${row.cardId}: entry path remains actionable`).toBeTruthy();
    if (pending!.atomVerb === 'sceneEnter') {
      expect(pending).toMatchObject({
        player: owner,
        ownerPlayer: owner,
        source: { cardId: row.cardId, abilityId: 'a1' },
        nMin: 0,
        nMax: 1,
      });
      expect(pending!.candidates.map(candidate => candidate.cardId)).toContain(ENTRY);
      expect(pending!.candidates.map(candidate => candidate.cardId)).not.toContain(TYPED_DECOY);
      return pending!;
    }
    expect(pending!.atomVerb, `${row.cardId}: only optional AP removal may precede entry`)
      .toBe('sceneRemove');
    expect(pending!.candidates).toEqual([]);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve',
      pickedUid: null,
    }))).toEqual({ ok: true });
  }
  throw new Error(`${row.cardId}: sceneEnter not reached`);
}

function resolvePostEntry(row: Row, entrantUid: string): void {
  for (let step = 0; step < 5; step += 1) {
    surfacePendingSideChannels();
    const pending = useGameStateStore.getState().pendingEffectPick;
    if (!pending) return;
    expect(['charModifyAP', 'handAddFromRemove', 'sceneSetState'])
      .toContain(pending.atomVerb);
    const entrant = pending.candidates.find(candidate => candidate.uid === entrantUid);
    const pickedUid = pending.atomVerb === 'charModifyAP' ? entrant?.uid ?? null : null;
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid,
    }))).toEqual({ ok: true });
  }
  throw new Error(`${row.cardId}: post-entry decisions did not settle`);
}

function assertSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect([store.pendingEffectPick, store.pendingEffectChoice, store.pendingEffectOptional])
    .toEqual([null, null, null]);
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
  expect(current().pendingRuntimeState).toBeUndefined();
}

function proveSwitch(row: Row, owner: Player, label: string): void {
  const entry = reachEntry(row, owner, label);
  const target = entry.candidates.find(candidate => candidate.cardId === ENTRY)!;
  const beforeMissingSwitch = JSON.stringify(current());
  expect(dispatchEngineAction(bindPendingDecision(entry, {
    type: 'effectPickResolve',
    pickedUid: target.uid,
  }))).toEqual({ ok: false, reason: 'not-allowed' });
  expect(JSON.stringify(current()), `${row.cardId}: missing victim is atomic`).toBe(beforeMissingSwitch);

  const hookOrder: string[] = [];
  event.on('leave:to-remove', (_state, payload) => {
    if ((payload as { uid?: string }).uid === victimUid(owner)) hookOrder.push('leave');
  });
  event.on('enter', (_state, payload, source) => {
    if (source?.cardId === ENTRY) hookOrder.push(`enter:${(payload as { uid?: string }).uid}`);
  });
  expect(dispatchEngineAction(bindPendingDecision(entry, {
    type: 'effectPickResolve',
    pickedUid: target.uid,
    switchRemoveUid: victimUid(owner),
  }))).toEqual({ ok: true });

  const entrant = current().players[owner].scene.find(character => character.cardId === ENTRY)!;
  resolvePostEntry(row, entrant.uid);
  const player = current().players[owner];
  const settledEntrant = player.scene.find(character => character.uid === entrant.uid)!;
  expect(player.scene).toHaveLength(5);
  expect(player.scene.some(character => character.uid === victimUid(owner))).toBe(false);
  expect(player.remove).toContain(FILLER);
  expect(settledEntrant.state).toBe(row.enteredState);
  expect(hookOrder).toEqual(['leave', `enter:${entrant.uid}`]);
  const origin = row.route === 'partner-hand' ? player.hand : player.remove;
  expect(origin).not.toContain(ENTRY);
  expect(origin).toContain(TYPED_DECOY);
  expect(current().pendingEffects.filter(effect => (
    effect.source.cardId === ENTRY && effect.source.abilityId === enterDraw.id
  )).map(effect => effect.state)).toEqual(['resolved']);

  if (row.route === 'partner-hand') {
    expect(player.partnerAreaCards).toContain(row.cardId);
    expect(player.remove).not.toContain(row.cardId);
  } else {
    expect(player.remove).toContain(row.cardId);
  }
  if (row.baseId === 'B07090') expect(settledEntrant.turnEffects.actionTargetsActive).toBe(true);
  if (row.baseId === 'B08029') expect(readChar.hasKeyword(current(), settledEntrant.uid, '突撃[キャラ]')).toBe(true);
  if (row.baseId === 'D09025') expect(readChar.hasKeyword(current(), settledEntrant.uid, '突撃')).toBe(true);
  if (row.baseId === 'B07090' || row.baseId === 'D08024') {
    expect(current().log).toContainEqual(expect.objectContaining({
      action: 'effect:charModifyAP',
      target: settledEntrant.uid,
    }));
  }
  assertSettled();
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
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave84: public event effect entry switches at a full scene', () => {
  // Card-bound rows: B05062, B07090/P, B08029/P, D08024, D09025, PR291, PR297.
  it.each(ROWS)('$cardId removes one own scene character before effect entry', row => {
    proveSwitch(row, 'self', `${row.cardId}-self-switch`);
    expect(current().players.self.scene, `${row.cardId}: public switch stays at cap`).toHaveLength(5);
  });

  it.each(BASE_ROWS)('$cardId permits zero entrants without requiring a switch', row => {
    const entry = reachEntry(row, 'self', `${row.cardId}-zero-entry`);
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve',
      pickedUid: null,
    }))).toEqual({ ok: true });
    resolvePostEntry(row, 'missing-entrant');
    const player = current().players.self;
    expect(player.scene).toHaveLength(5);
    expect(player.scene.some(character => character.uid === victimUid('self'))).toBe(true);
    expect(row.route === 'partner-hand' ? player.hand : player.remove).toContain(ENTRY);
    assertSettled();
  });

  it('B07090 rejects an opponent switch victim transactionally', () => {
    const row = ROWS.find(item => item.cardId === 'B07090')!;
    const entry = reachEntry(row, 'self', 'B07090-cross-owner-victim');
    const target = entry.candidates.find(candidate => candidate.cardId === ENTRY)!;
    const before = current();
    const beforeJson = JSON.stringify(before);
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve',
      pickedUid: target.uid,
      switchRemoveUid: 'opp-w84-cross-victim',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
    expect(useGameStateStore.getState().pendingEffectPick?.decisionId).toBe(entry.decisionId);
  });

  it('B07090 owner=opp receives the same source-owned switch authority', () => {
    const row = ROWS.find(item => item.cardId === 'B07090')!;
    proveSwitch(row, 'opp', 'B07090-owner-opp');
    expect(current().players.opp.scene.some(character => character.cardId === ENTRY)).toBe(true);
    expect(current().players.self.scene.some(character => character.cardId === ENTRY)).toBe(false);
  });

  it.each(['D09025', 'PR291'])('%s reauthenticates its pending switch after save hydration', cardId => {
    const row = ROWS.find(item => item.cardId === cardId)!;
    const stale = reachEntry(row, 'self', `${cardId}-save`);
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    surfacePendingSideChannels();
    const restored = useGameStateStore.getState().pendingEffectPick!;
    expect(restored.decisionId).not.toBe(stale.decisionId);
    expect(restored.source).toMatchObject(stale.source);
    expect(restored.candidates.map(candidate => candidate.uid))
      .toEqual(stale.candidates.map(candidate => candidate.uid));
    const target = restored.candidates.find(candidate => candidate.cardId === ENTRY)!;
    const beforeStale = current();
    const beforeStaleJson = JSON.stringify(beforeStale);
    expect(dispatchEngineAction(bindPendingDecision(stale, {
      type: 'effectPickResolve',
      pickedUid: target.uid,
      switchRemoveUid: victimUid('self'),
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toBe(beforeStale);
    expect(JSON.stringify(current())).toBe(beforeStaleJson);
    expect(dispatchEngineAction(bindPendingDecision(restored, {
      type: 'effectPickResolve',
      pickedUid: target.uid,
      switchRemoveUid: victimUid('self'),
    }))).toEqual({ ok: true });
    const entrant = current().players.self.scene.find(character => character.cardId === ENTRY)!;
    resolvePostEntry(row, entrant.uid);
    expect(current().players.self.scene).toHaveLength(5);
    expect(current().players.self.remove).toContain(FILLER);
    expect(entrant.state).toBe(row.enteredState);
    assertSettled();
  });

  it('B08029 CPU choice enters through a full-scene switch and grants its rider', () => {
    const row = ROWS.find(item => item.cardId === 'B08029')!;
    const state = prepared(row, 'opp');
    const originalUids = new Set(state.players.opp.scene.map(character => character.uid));
    const ctx: EffectCtx = {
      source: { player: 'opp', area: 'hand', cardId: B08029.id, abilityId: 'a1' },
      bindings: {},
    };
    const resolved = produce(state, draft => {
      runEffect(draft, B08029.abilities[0]!.effect!, ctx);
      runAllUntilEmpty(draft);
      drainAiEffectPicks(draft, {
        chooseAtomTarget: (_state, _verb, _args, candidates) => (
          candidates.find(candidate => candidate.cardId === ENTRY)
            ?? candidates.find(candidate => candidate.uid === victimUid('opp'))
            ?? null
        ),
      });
    });

    const entered = resolved.players.opp.scene.find(character => character.cardId === ENTRY);
    expect(entered).toBeTruthy();
    expect(resolved.players.opp.scene).toHaveLength(5);
    expect(resolved.players.opp.scene.filter(character => originalUids.has(character.uid))).toHaveLength(4);
    expect(resolved.players.opp.remove).toContain(FILLER);
    expect(readChar.hasKeyword(resolved, entered!.uid, '突撃[キャラ]')).toBe(true);
    expect(resolved.pendingEffects.filter(effect => (
      effect.source.cardId === ENTRY && effect.source.abilityId === enterDraw.id
    )).map(effect => effect.state)).toEqual(['resolved']);
    expect(resolved.pendingRuntimeState).toBeUndefined();
  });
});
