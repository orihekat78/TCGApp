// qa: card:B05055:c51f6838f7814f2243bbe0560dc33c4dc896f1b0b13d486cd4223cb898983c95
// qa: card:B05056:c51f6838f7814f2243bbe0560dc33c4dc896f1b0b13d486cd4223cb898983c95
// qa: card:B07020:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B07037:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B07082:f9ca6c1f234b459fe5e73452949fcd02e3b7ec4cf30f2df07134d771866a5398
// qa: card:B08056:c51f6838f7814f2243bbe0560dc33c4dc896f1b0b13d486cd4223cb898983c95
// qa: card:B08083:c51f6838f7814f2243bbe0560dc33c4dc896f1b0b13d486cd4223cb898983c95
// qa: card:B09109:d3f368d5baca2d075770eacd3703dd420726b14f2957c03c2f001e21b37e73f9
// Rules: 15-abilities-effects, 17-icons, 20-color-and-switch.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const CASE_ALL = 'W63-CASE-ALL';
const PARTNER_ALL = 'W63-PARTNER-ALL';
const FILLER = 'W63-FILLER';
const POLICE_WITNESS = 'W63-POLICE-WITNESS';
const TYPED_DECOY = 'W63-TYPED-DECOY';
const HAND_COST = 'W63-HAND-COST';
const BIG_JEWEL = 'W63-BIG-JEWEL';
const DRAW_1 = 'W63-DRAW-1';
const DRAW_2 = 'W63-DRAW-2';
const DRAW_3 = 'W63-DRAW-3';
const DECK_DECOY = 'W63-DECK-DECOY';
const ENTRY_SUZUKI = 'W63-ENTRY-SUZUKI';
const ENTRY_MARO = 'W63-ENTRY-MARO';
const ENTRY_AOKO = 'W63-ENTRY-AOKO';
const ENTRY_SATO = 'W63-ENTRY-SATO';
const ENTRY_MIYANO = 'W63-ENTRY-MIYANO';
const ENTRY_LEAVE = 'W63-ENTRY-LEAVE';
const ENTRY_MATCH = 'W63-ENTRY-MATCH';

const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Nested entry sentinel.', ruleRefs: ['rules/17-icons.md'],
};
const leaveAbility: AbilityDef = {
  id: 'leave-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Printed leave-trigger sentinel.', ruleRefs: ['rules/17-icons.md'],
};

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['青'], traits: [], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures: CardDef[] = [
  fixture(CASE_ALL, { kind: 'case', colors: ['青', '緑', '白', '黄', '赤', '黒'], caseLevel: 10, caseTraits: [] }),
  fixture(PARTNER_ALL, { kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], lp: 5 }),
  fixture(FILLER),
  fixture(POLICE_WITNESS, { level: 7, traits: ['警視庁'] }),
  fixture(TYPED_DECOY, { kind: 'event', names: ['宮野エレーナ'], traits: ['鈴木財閥', '警察', '現場リムーブ時'] }),
  fixture(HAND_COST, { kind: 'event' }),
  fixture(BIG_JEWEL, { kind: 'event', traits: ['ビッグジュエル'] }),
  fixture(DRAW_1, { kind: 'event' }), fixture(DRAW_2, { kind: 'event' }), fixture(DRAW_3, { kind: 'event' }),
  fixture(DECK_DECOY, { names: ['別人'], level: 3 }),
  fixture(ENTRY_SUZUKI, { traits: ['鈴木財閥'], level: 5, abilities: [enterDraw] }),
  fixture(ENTRY_MARO, { names: ['マロちゃん'], traits: ['警察'], level: 5, abilities: [enterDraw] }),
  fixture(ENTRY_AOKO, { names: ['中森青子'], level: 6, abilities: [enterDraw] }),
  fixture(ENTRY_SATO, { names: ['佐藤美和子'], level: 5, abilities: [enterDraw] }),
  fixture(ENTRY_MIYANO, { names: ['宮野エレーナ'], level: 7, abilities: [enterDraw] }),
  fixture(ENTRY_LEAVE, { level: 5, abilities: [enterDraw, leaveAbility] }),
  fixture(ENTRY_MATCH, { names: ['江戸川コナン'], level: 4, abilities: [enterDraw] }),
];

type Route = 'declared-hand' | 'declared-remove-cost' | 'enter-pa' | 'enter-remove' | 'declared-deck';
type Origin = 'hand' | 'remove' | 'deck';
type Row = {
  cardId: string;
  baseId: string;
  abilityId: 'a1' | 'a2';
  abilityIndex: number;
  route: Route;
  origin: Origin;
  target: string;
  targetState: 'active' | 'sleep';
  sourceSleeps: boolean;
};

const ROWS: Row[] = [
  { cardId: 'B05055', baseId: 'B05055', abilityId: 'a1', abilityIndex: 0, route: 'declared-hand', origin: 'hand', target: ENTRY_SUZUKI, targetState: 'active', sourceSleeps: true },
  { cardId: 'B05056', baseId: 'B05056', abilityId: 'a2', abilityIndex: 1, route: 'declared-hand', origin: 'hand', target: ENTRY_SUZUKI, targetState: 'active', sourceSleeps: true },
  { cardId: 'B07020', baseId: 'B07020', abilityId: 'a1', abilityIndex: 0, route: 'declared-remove-cost', origin: 'remove', target: ENTRY_MARO, targetState: 'active', sourceSleeps: true },
  { cardId: 'B07020P', baseId: 'B07020', abilityId: 'a1', abilityIndex: 0, route: 'declared-remove-cost', origin: 'remove', target: ENTRY_MARO, targetState: 'active', sourceSleeps: true },
  { cardId: 'B07037', baseId: 'B07037', abilityId: 'a1', abilityIndex: 0, route: 'enter-pa', origin: 'remove', target: ENTRY_AOKO, targetState: 'sleep', sourceSleeps: false },
  { cardId: 'B07082', baseId: 'B07082', abilityId: 'a1', abilityIndex: 0, route: 'enter-remove', origin: 'remove', target: ENTRY_SATO, targetState: 'sleep', sourceSleeps: false },
  { cardId: 'B07082P', baseId: 'B07082', abilityId: 'a1', abilityIndex: 0, route: 'enter-remove', origin: 'remove', target: ENTRY_SATO, targetState: 'sleep', sourceSleeps: false },
  { cardId: 'B08056', baseId: 'B08056', abilityId: 'a1', abilityIndex: 0, route: 'declared-hand', origin: 'hand', target: ENTRY_MIYANO, targetState: 'active', sourceSleeps: true },
  { cardId: 'B08083', baseId: 'B08083', abilityId: 'a2', abilityIndex: 1, route: 'declared-hand', origin: 'hand', target: ENTRY_LEAVE, targetState: 'active', sourceSleeps: true },
  { cardId: 'B09109', baseId: 'B09109', abilityId: 'a1', abilityIndex: 0, route: 'declared-deck', origin: 'deck', target: ENTRY_MATCH, targetState: 'active', sourceSleeps: false },
  { cardId: 'B09109P', baseId: 'B09109', abilityId: 'a1', abilityIndex: 0, route: 'declared-deck', origin: 'deck', target: ENTRY_MATCH, targetState: 'active', sourceSleeps: false },
];
const BASE_ROWS = ROWS.filter(row => row.cardId === row.baseId);

function other(side: Player): Player {
  return side === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave63 state');
  return state;
}

function prepared(row: Row, side: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const owner = state.players[side];
  owner.partner = { cardId: PARTNER_ALL, state: 'active', location: 'partner-area' };
  owner.case = { ...owner.case, cardId: CASE_ALL, status: '解決編', colors: ['青', '緑', '白', '黄', '赤', '黒'] };
  owner.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  owner.deck = [DRAW_1, DRAW_2, DRAW_3];
  const sourceInHand = row.route === 'enter-pa' || row.route === 'enter-remove';
  const scene = row.route === 'enter-remove'
    ? [sceneChar(POLICE_WITNESS, `${side}-witness`), ...Array.from({ length: 3 }, (_value, index) => sceneChar(FILLER, `${side}-full-${index + 1}`))]
    : row.route === 'declared-deck'
      ? [sceneChar(row.cardId, 'source'), sceneChar(ENTRY_MATCH, 'match-scene'), ...Array.from({ length: 3 }, (_value, index) => sceneChar(FILLER, `${side}-full-${index + 1}`))]
      : Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER, `${side}-full-${index + 1}`));
  if (!sourceInHand && row.route !== 'declared-deck') scene.unshift(sceneChar(row.cardId, 'source'));
  owner.scene = scene;
  owner.hand = sourceInHand ? [row.cardId] : [];
  if (row.origin === 'hand') owner.hand.push(row.target, TYPED_DECOY);
  if (row.origin === 'remove') owner.remove = [row.target, TYPED_DECOY];
  if (row.route === 'declared-remove-cost') owner.hand.push(HAND_COST);
  if (row.route === 'enter-pa') owner.partnerAreaCards = [BIG_JEWEL, BIG_JEWEL];
  if (row.route === 'declared-deck') owner.deck = [DECK_DECOY, row.target, DRAW_1, DRAW_2, DRAW_3];
  state.players[other(side)].scene = [sceneChar(FILLER, `${other(side)}-victim`)];
  state.players[other(side)].deck = [DRAW_1, DRAW_2, DRAW_3];
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-w63-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function authority(row: Row, side: Player, uid?: string) {
  return {
    player: side,
    source: {
      cardId: row.cardId, abilityId: row.abilityId,
      abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      ...(uid ? { uid } : {}),
    },
  };
}

function pendingPick(row: Row, side: Player, verb: string, sourceUid: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${row.cardId}: ${verb} authority`).toMatchObject({
    ...authority(row, side, sourceUid), ownerPlayer: side, atomVerb: verb,
  });
  return pending!;
}

function resolveOptional(row: Row, side: Player, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${row.cardId}: optional authority`).toMatchObject(authority(row, side));
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run }))).toEqual({ ok: true });
}

function openSource(row: Row, side: Player, label: string): string {
  install(prepared(row, side), label, side);
  if (row.route === 'enter-pa' || row.route === 'enter-remove') {
    expect(dispatchEngineAction({ type: 'handUseCard', player: side, cardId: row.cardId })).toEqual({ ok: true });
  }
  const source = current().players[side].scene.find(character => character.cardId === row.cardId);
  expect(source, `${row.cardId}: physical source`).toBeTruthy();
  expect(current().players[side].scene).toHaveLength(5);
  return source!.uid;
}

function dispatchDeclared(row: Row, sourceUid: string): void {
  const costParams = row.route === 'declared-remove-cost'
    ? { removeFromHand: { indices: [0] } }
    : undefined;
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid, abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex, ...(costParams ? { costParams } : {}),
  })).toEqual({ ok: true });
}

function reachEntry(row: Row, side: Player, label: string) {
  const sourceUid = openSource(row, side, label);
  if (row.route.startsWith('declared-')) dispatchDeclared(row, sourceUid);
  if (row.route === 'enter-pa') {
    resolveOptional(row, side, true);
    const payment = pendingPick(row, side, 'partnerAreaRemove', sourceUid);
    const pickedUids = payment.candidates.slice(0, 2).map(candidate => candidate.uid);
    expect(pickedUids).toHaveLength(2);
    expect(dispatchEngineAction(bindPendingDecision(payment, {
      type: 'effectPickResolve', pickedUid: pickedUids[0]!, pickedUids,
    }))).toEqual({ ok: true });
  }
  const verb = row.route === 'declared-deck' ? 'bindPick' : 'sceneEnter';
  const pending = pendingPick(row, side, verb, sourceUid);
  if (row.route === 'declared-deck') {
    expect(pending.candidates.map(candidate => candidate.uid)).toContain('match-scene');
  } else {
    const ids = pending.candidates.map(candidate => candidate.cardId);
    expect(ids).toContain(row.target);
    expect(ids).not.toContain(TYPED_DECOY);
  }
  return { sourceUid, pending };
}

function expectSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice])
    .toEqual([null, null, null]);
  expect(current().pendingRuntimeState).toBeUndefined();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
}

function proveFullScene(row: Row, side: Player, label: string): void {
  const { sourceUid, pending } = reachEntry(row, side, label);
  const pickedUid = row.route === 'declared-deck'
    ? 'match-scene'
    : pending.candidates.find(candidate => candidate.cardId === row.target)!.uid;
  const hooks: string[] = [];
  let sourceLeaveLogLength: number | null = null;
  event.on('leave:to-remove', (_state, payload, source) => {
    if (payload.uid === sourceUid && source?.cardId === row.cardId) {
      sourceLeaveLogLength = _state.log.length;
      hooks.push(`leave:${source.cardId}:${payload.uid}`);
    }
  });
  event.on('enter', (_state, payload, source) => {
    if (source?.cardId === row.target) hooks.push(`enter:${source.cardId}:${payload.uid}`);
  });
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid, switchRemoveUid: sourceUid,
  }))).toEqual({ ok: true });

  const state = current();
  const owner = state.players[side];
  const entrant = owner.scene.find(character => (
    character.cardId === row.target && (row.route !== 'declared-deck' || character.uid !== 'match-scene')
  ));
  expect(owner.scene).toHaveLength(5);
  expect(owner.scene.some(character => character.uid === sourceUid)).toBe(false);
  expect(owner.remove).toContain(row.cardId);
  expect(entrant).toBeTruthy();
  expect(entrant?.state).toBe(row.targetState);
  expect(hooks).toEqual([
    `leave:${row.cardId}:${sourceUid}`,
    `enter:${row.target}:${entrant!.uid}`,
  ]);
  const nested = state.pendingEffects.filter(effect => (
    effect.source.cardId === row.target && effect.source.uid === entrant!.uid && effect.source.abilityId === enterDraw.id
  ));
  expect(nested).toHaveLength(1);
  expect(nested[0]?.state).toBe('resolved');
  if (row.route === 'declared-remove-cost') expect(owner.remove).toContain(HAND_COST);
  if (row.route === 'enter-pa') {
    expect(owner.partnerAreaCards).toEqual([]);
    expect(owner.remove.filter(cardId => cardId === BIG_JEWEL)).toHaveLength(2);
  }
  if (row.route === 'declared-deck') {
    expect(entrant?.turnEffects.toDeckBottomOnTurnEnd).toBe(true);
    expect([...owner.deck, ...owner.hand].sort()).toEqual([DECK_DECOY, DRAW_1, DRAW_2, DRAW_3].sort());
    expect(owner.deck).toHaveLength(3);
    expect(owner.hand).toHaveLength(1);
    const shuffleIndex = state.log.findIndex(entry => entry.action === 'effect:deckShuffle');
    expect(sourceLeaveLogLength).not.toBeNull();
    expect(shuffleIndex).toBeGreaterThanOrEqual(sourceLeaveLogLength!);
  }
  if (row.origin === 'hand') expect(owner.hand).not.toContain(row.target);
  if (row.origin === 'remove') expect(owner.remove).not.toContain(row.target);
  if (row.origin === 'deck') expect(owner.deck.filter(cardId => cardId === row.target)).toHaveLength(0);
  expectSettled();
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave63: effect entry can switch its source at a full scene', () => {
  it.each(ROWS)('$cardId switches its exact physical source while the effect entry finishes', row => {
    proveFullScene(row, 'self', `${row.cardId}-self-switch`);
    if (row.cardId === 'B05055') expect(current().players.self.remove).toContain('B05055');
    if (row.cardId === 'B05056') expect(current().players.self.remove).toContain('B05056');
    if (row.cardId === 'B07020') expect(current().players.self.remove).toContain('B07020');
    if (row.cardId === 'B07037') expect(current().players.self.remove).toContain('B07037');
    if (row.cardId === 'B07082') expect(current().players.self.remove).toContain('B07082');
    if (row.cardId === 'B08056') expect(current().players.self.remove).toContain('B08056');
    if (row.cardId === 'B08083') expect(current().players.self.remove).toContain('B08083');
    if (row.cardId === 'B09109') expect(current().players.self.remove).toContain('B09109');
  });

  it.each(BASE_ROWS)('$cardId permits zero entry without a false switch', row => {
    const { sourceUid, pending } = reachEntry(row, 'self', `${row.cardId}-zero-entry`);
    const deckBefore = [...current().players.self.deck];
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });
    const owner = current().players.self;
    expect(owner.scene).toHaveLength(5);
    expect(owner.scene.find(character => character.uid === sourceUid)?.state)
      .toBe(row.sourceSleeps ? 'sleep' : 'active');
    expect(row.origin === 'hand' ? owner.hand : row.origin === 'remove' ? owner.remove : owner.deck).toContain(row.target);
    expect(current().pendingEffects.some(effect => effect.source.cardId === row.target && effect.source.abilityId === enterDraw.id)).toBe(false);
    if (row.route === 'declared-remove-cost') expect(owner.remove).toContain(HAND_COST);
    if (row.route === 'enter-pa') expect(owner.partnerAreaCards).toEqual([]);
    if (row.route === 'declared-deck') {
      expect(owner.deck).toEqual(deckBefore);
      expect(owner.hand).toEqual([]);
      expect(owner.scene.filter(character => character.cardId === ENTRY_MATCH)).toHaveLength(1);
      expect(owner.scene.some(character => character.turnEffects.toDeckBottomOnTurnEnd === true)).toBe(false);
      expect(useGameStateStore.getState().pendingDeckReveal).toBeNull();
      expect(current().log.some(entry => entry.action === 'effect:deckRevealUntil')).toBe(false);
      expect(current().log.some(entry => entry.action === 'effect:deckShuffle')).toBe(false);
    }
    expectSettled();
  });

  it('B07037 optional decline keeps its partner-area payment and full scene', () => {
    const row = ROWS.find(entry => entry.cardId === 'B07037')!;
    const sourceUid = openSource(row, 'self', 'B07037-decline');
    resolveOptional(row, 'self', false);
    expect(current().players.self.scene.find(character => character.uid === sourceUid)?.state).toBe('active');
    expect(current().players.self.partnerAreaCards).toEqual([BIG_JEWEL, BIG_JEWEL]);
    expect(current().players.self.remove).toContain(ENTRY_AOKO);
    expectSettled();
  });

  it('B05055 owner=opp receives the same source-self switch authority', () => {
    const row = ROWS.find(entry => entry.cardId === 'B05055')!;
    proveFullScene(row, 'opp', 'B05055-owner-opp');
    expect(current().players.opp.remove).toContain('B05055');
    expect(current().players.self.remove).not.toContain('B05055');
  });

  it('B05055 rejects a forged cross-owner switch victim transactionally', () => {
    const row = ROWS.find(entry => entry.cardId === 'B05055')!;
    const { sourceUid, pending } = reachEntry(row, 'self', 'B05055-forged');
    const target = pending.candidates.find(candidate => candidate.cardId === row.target)!;
    const beforeState = JSON.stringify(current());
    const beforePending = useGameStateStore.getState().pendingEffectPick;
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: target.uid, switchRemoveUid: 'opp-victim',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeState);
    expect(useGameStateStore.getState().pendingEffectPick).toEqual(beforePending);
    expect(current().players.self.scene.some(character => character.uid === sourceUid)).toBe(true);
  });
});
