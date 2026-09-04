// qa: card:B04046:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// qa: card:B05007:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// qa: card:B05090:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// qa: card:B06090:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// qa: card:B09038:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// qa: card:B10005:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// qa: card:B10023:6b96389cc833a3fa159cdc9a1b55a5f5db61c7ee0131677aa3e999ce49bd2c2d
// Rules: 15-abilities-effects, 17-icons, 20-color-and-switch, 25-qa-effects-resolution.

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

const CASE_ALL = 'W61-CASE-ALL';
const PARTNER_ALL = 'W61-PARTNER-ALL';
const FILLER = 'W61-FILLER';
const TYPED_DECOY = 'W61-TYPED-DECOY';
const DISCARD = 'W61-DISCARD';
const SET_TOP = 'W61-SET-TOP';
const DRAW_1 = 'W61-DRAW-1';
const DRAW_2 = 'W61-DRAW-2';
const DRAW_3 = 'W61-DRAW-3';
const ENTRY_FBI = 'W61-ENTRY-FBI';
const ENTRY_SHINICHI = 'W61-ENTRY-SHINICHI';
const ENTRY_YELLOW = 'W61-ENTRY-YELLOW';
const ENTRY_POIROT = 'W61-ENTRY-POIROT';
const ENTRY_YUSAKU = 'W61-ENTRY-YUSAKU';
const ENTRY_HIGO = 'W61-ENTRY-HIGO';
const ENTRY_POLICE = 'W61-ENTRY-POLICE';

const enterDraw: AbilityDef = {
  id: 'enter-draw', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'Nested public enter sentinel.', ruleRefs: ['rules/17-icons.md'],
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
  fixture(CASE_ALL, {
    kind: 'case', colors: ['青', '緑', '白', '黄', '赤', '黒'], caseLevel: 10, caseTraits: [],
  }),
  fixture(PARTNER_ALL, { kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], lp: 5 }),
  fixture(FILLER), fixture(DISCARD, { kind: 'event' }),
  fixture(SET_TOP, { kind: 'event' }), fixture(DRAW_1, { kind: 'event' }),
  fixture(DRAW_2, { kind: 'event' }), fixture(DRAW_3, { kind: 'event' }),
  fixture(TYPED_DECOY, {
    kind: 'event', names: ['工藤新一', '工藤優作', '比護隆佑'],
    colors: ['青', '緑', '白', '黄', '赤', '黒'],
    traits: ['FBI', '毛利探偵事務所', '警察', '喫茶ポアロ', 'サッカー選手'],
  }),
  fixture(ENTRY_FBI, { traits: ['FBI'], level: 6, abilities: [enterDraw] }),
  fixture(ENTRY_SHINICHI, { names: ['工藤新一'], level: 6, abilities: [enterDraw] }),
  fixture(ENTRY_YELLOW, { colors: ['黄'], traits: ['警察', '喫茶ポアロ'], level: 4, abilities: [enterDraw] }),
  fixture(ENTRY_POIROT, { traits: ['喫茶ポアロ'], level: 5, abilities: [enterDraw] }),
  fixture(ENTRY_YUSAKU, { names: ['工藤優作'], level: 6, abilities: [enterDraw] }),
  fixture(ENTRY_HIGO, { names: ['比護隆佑'], traits: ['サッカー選手'], level: 6, abilities: [enterDraw] }),
  fixture(ENTRY_POLICE, { colors: ['緑'], traits: ['警察'], level: 6, abilities: [enterDraw] }),
];

type Route = 'direct' | 'optional' | 'optional-discard';
type Origin = 'hand' | 'remove';

type Row = {
  cardId: string;
  baseId: string;
  abilityId: 'a1' | 'a2';
  abilityIndex: number;
  route: Route;
  origin: Origin;
  target: string;
  outerDraws: number;
  zeroEntryDraws: number;
  selfSleeps: boolean;
  setTop?: boolean;
};

const ROWS: Row[] = [
  { cardId: 'B04046', baseId: 'B04046', abilityId: 'a2', abilityIndex: 1, route: 'direct', origin: 'hand', target: ENTRY_FBI, outerDraws: 1, zeroEntryDraws: 1, selfSleeps: false },
  { cardId: 'B04046P', baseId: 'B04046', abilityId: 'a2', abilityIndex: 1, route: 'direct', origin: 'hand', target: ENTRY_FBI, outerDraws: 1, zeroEntryDraws: 1, selfSleeps: false },
  { cardId: 'B05007', baseId: 'B05007', abilityId: 'a1', abilityIndex: 0, route: 'optional', origin: 'hand', target: ENTRY_SHINICHI, outerDraws: 1, zeroEntryDraws: 1, selfSleeps: true },
  { cardId: 'B05007P', baseId: 'B05007', abilityId: 'a1', abilityIndex: 0, route: 'optional', origin: 'hand', target: ENTRY_SHINICHI, outerDraws: 1, zeroEntryDraws: 1, selfSleeps: true },
  { cardId: 'B05090', baseId: 'B05090', abilityId: 'a1', abilityIndex: 0, route: 'direct', origin: 'hand', target: ENTRY_YELLOW, outerDraws: 1, zeroEntryDraws: 0, selfSleeps: false },
  { cardId: 'B06090', baseId: 'B06090', abilityId: 'a1', abilityIndex: 0, route: 'optional', origin: 'remove', target: ENTRY_POIROT, outerDraws: 0, zeroEntryDraws: 0, selfSleeps: true },
  { cardId: 'B06090P', baseId: 'B06090', abilityId: 'a1', abilityIndex: 0, route: 'optional', origin: 'remove', target: ENTRY_POIROT, outerDraws: 0, zeroEntryDraws: 0, selfSleeps: true },
  { cardId: 'B09038', baseId: 'B09038', abilityId: 'a2', abilityIndex: 1, route: 'optional', origin: 'hand', target: ENTRY_YUSAKU, outerDraws: 1, zeroEntryDraws: 1, selfSleeps: true, setTop: true },
  { cardId: 'B09038P', baseId: 'B09038', abilityId: 'a2', abilityIndex: 1, route: 'optional', origin: 'hand', target: ENTRY_YUSAKU, outerDraws: 1, zeroEntryDraws: 1, selfSleeps: true, setTop: true },
  { cardId: 'B10005', baseId: 'B10005', abilityId: 'a2', abilityIndex: 1, route: 'optional', origin: 'hand', target: ENTRY_HIGO, outerDraws: 1, zeroEntryDraws: 0, selfSleeps: true },
  { cardId: 'B10005P', baseId: 'B10005', abilityId: 'a2', abilityIndex: 1, route: 'optional', origin: 'hand', target: ENTRY_HIGO, outerDraws: 1, zeroEntryDraws: 0, selfSleeps: true },
  { cardId: 'B10023', baseId: 'B10023', abilityId: 'a1', abilityIndex: 0, route: 'optional-discard', origin: 'remove', target: ENTRY_POLICE, outerDraws: 0, zeroEntryDraws: 0, selfSleeps: true },
  { cardId: 'B10023P', baseId: 'B10023', abilityId: 'a1', abilityIndex: 0, route: 'optional-discard', origin: 'remove', target: ENTRY_POLICE, outerDraws: 0, zeroEntryDraws: 0, selfSleeps: true },
];

const BASE_ROWS = ROWS.filter(row => row.cardId === row.baseId);
const OPTIONAL_BASE_ROWS = BASE_ROWS.filter(row => row.route === 'optional' || row.route === 'optional-discard');

function other(side: Player): Player {
  return side === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave61 state');
  return state;
}

function prepared(row: Row, side: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const owner = state.players[side];
  owner.partner = { cardId: PARTNER_ALL, state: 'active', location: 'partner-area' };
  owner.case = {
    ...owner.case, cardId: CASE_ALL, status: '解決編',
    colors: ['青', '緑', '白', '黄', '赤', '黒'],
  };
  owner.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: FILLER }));
  owner.deck = [SET_TOP, DRAW_1, DRAW_2, DRAW_3];
  owner.scene = Array.from({ length: 4 }, (_value, index) => sceneChar(FILLER, `${side}-full-${index + 1}`));
  owner.hand = [row.cardId];
  if (row.origin === 'hand') owner.hand.push(row.target, TYPED_DECOY);
  else owner.remove = [row.target, TYPED_DECOY];
  if (row.route === 'optional-discard') owner.hand.push(DISCARD);

  const opponent = state.players[other(side)];
  opponent.scene = [sceneChar(FILLER, `${other(side)}-victim`)];
  opponent.deck = [DRAW_1, DRAW_2, DRAW_3, SET_TOP];
  return state;
}

function install(state: GameState, label: string, human: Player = 'self'): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-w61-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function sourceAuthority(row: Row, side: Player, uid?: string) {
  return {
    player: side,
    source: {
      cardId: row.cardId, abilityId: row.abilityId,
      abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      ...(uid ? { uid } : {}),
    },
  };
}

function openSource(row: Row, side: Player, label: string): string {
  install(prepared(row, side), label, side);
  expect(dispatchEngineAction({ type: 'handUseCard', player: side, cardId: row.cardId }))
    .toEqual({ ok: true });
  const source = current().players[side].scene.find(character => character.cardId === row.cardId);
  expect(source, `${row.cardId}: outer source entered`).toBeTruthy();
  expect(current().players[side].scene).toHaveLength(5);
  return source!.uid;
}

function resolveOptional(row: Row, side: Player, run: boolean): void {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectOptional;
  expect(pending, `${row.cardId}: optional authority`).toMatchObject(sourceAuthority(row, side));
  expect(dispatchEngineAction(bindPendingDecision(pending!, { type: 'optionalResolve', run })))
    .toEqual({ ok: true });
}

function pendingPick(row: Row, side: Player, verb: string, sourceUid: string) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${row.cardId}: ${verb} authority`).toMatchObject({
    ...sourceAuthority(row, side, sourceUid), ownerPlayer: side, atomVerb: verb,
  });
  return pending!;
}

function resolveDiscard(row: Row, side: Player, sourceUid: string): void {
  const pending = pendingPick(row, side, 'discard', sourceUid);
  const candidate = pending.candidates.find(entry => entry.cardId === DISCARD);
  expect(candidate, `${row.cardId}: exact discard occurrence`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: candidate!.uid,
  }))).toEqual({ ok: true });
}

function reachEntry(row: Row, side: Player, label: string): { sourceUid: string; entry: ReturnType<typeof pendingPick> } {
  const sourceUid = openSource(row, side, label);
  if (row.route === 'optional' || row.route === 'optional-discard') resolveOptional(row, side, true);
  if (row.route === 'optional-discard') resolveDiscard(row, side, sourceUid);
  const entry = pendingPick(row, side, 'sceneEnter', sourceUid);
  const ids = entry.candidates.map(candidate => candidate.cardId);
  expect(ids, `${row.cardId}: exact eligible entrant`).toContain(row.target);
  expect(ids, `${row.cardId}: event-shaped typed decoy`).not.toContain(TYPED_DECOY);
  return { sourceUid, entry };
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
  const { sourceUid, entry } = reachEntry(row, side, label);
  const target = entry.candidates.find(candidate => candidate.cardId === row.target)!;
  const hookOrder: string[] = [];
  event.on('leave:to-remove', (_state, payload, source) => {
    if (payload.uid === sourceUid && source?.cardId === row.cardId) {
      hookOrder.push(`leave:${source.cardId}:${payload.uid}`);
    }
  });
  event.on('enter', (_state, payload, source) => {
    if (source?.cardId === row.target) hookOrder.push(`enter:${source.cardId}:${payload.uid}`);
  });
  expect(dispatchEngineAction(bindPendingDecision(entry, {
    type: 'effectPickResolve', pickedUid: target.uid, switchRemoveUid: sourceUid,
  }))).toEqual({ ok: true });

  const state = current();
  const owner = state.players[side];
  const entrant = owner.scene.find(character => character.cardId === row.target);
  expect(owner.scene, `${row.cardId}: net-neutral full-scene switch`).toHaveLength(5);
  expect(owner.scene.some(character => character.uid === sourceUid), `${row.cardId}: source switches itself`).toBe(false);
  expect(owner.remove, `${row.cardId}: physical source leaves`).toContain(row.cardId);
  expect(entrant, `${row.cardId}: selected character enters`).toBeTruthy();
  expect(entrant?.state, `${row.cardId}: printed post-entry state`).toBe('active');
  expect(hookOrder, `${row.cardId}: switch leave precedes effect entry`).toEqual([
    `leave:${row.cardId}:${sourceUid}`,
    `enter:${row.target}:${entrant!.uid}`,
  ]);
  const origin = row.origin === 'hand' ? owner.hand : owner.remove;
  expect(origin, `${row.cardId}: selected occurrence moved`).not.toContain(row.target);
  expect(origin, `${row.cardId}: typed decoy stays put`).toContain(TYPED_DECOY);

  const nested = state.pendingEffects.filter(effect => (
    effect.source.cardId === row.target && effect.source.abilityId === enterDraw.id
  ));
  expect(nested, `${row.cardId}: entrant's own enter hook fires once`).toHaveLength(1);
  expect(nested[0]?.state).toBe('resolved');
  expect(state.log.filter(entryLog => entryLog.action === 'effect:draw'), `${row.cardId}: outer tail plus nested hook`)
    .toHaveLength(row.outerDraws + 1);

  if (row.setTop) {
    expect(entrant?.setCards).toContainEqual(expect.objectContaining({ cardId: SET_TOP, faceUp: false }));
  }
  if (row.cardId === 'B05090') {
    expect(state.log).toContainEqual(expect.objectContaining({ action: 'effect:sceneSetState', target: entrant!.uid }));
  }
  if (row.route === 'optional-discard') expect(owner.remove).toContain(DISCARD);
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

describe('official QA Wave61: effect entry at a full scene', () => {
  it.each(ROWS)('$cardId may switch out its newly entered physical source and finish the effect', row => {
    proveFullScene(row, 'self', `${row.cardId}-self-switch`);
    if (row.cardId === 'B04046') expect(current().players.self.remove).toContain('B04046');
    if (row.cardId === 'B05007') expect(current().players.self.remove).toContain('B05007');
    if (row.cardId === 'B05090') expect(current().players.self.remove).toContain('B05090');
    if (row.cardId === 'B06090') expect(current().players.self.remove).toContain('B06090');
    if (row.cardId === 'B09038') expect(current().players.self.remove).toContain('B09038');
    if (row.cardId === 'B10005') expect(current().players.self.remove).toContain('B10005');
    if (row.cardId === 'B10023') expect(current().players.self.remove).toContain('B10023');
  });

  it.each(BASE_ROWS)('$cardId permits zero entrants and preserves its printed mandatory tail', row => {
    const { sourceUid, entry } = reachEntry(row, 'self', `${row.cardId}-zero-entry`);
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    const state = current();
    const owner = state.players.self;
    expect(owner.scene).toHaveLength(5);
    expect(owner.scene.find(character => character.uid === sourceUid)?.state)
      .toBe(row.selfSleeps ? 'sleep' : 'active');
    expect(row.origin === 'hand' ? owner.hand : owner.remove).toContain(row.target);
    expect(state.pendingEffects.some(effect => effect.source.cardId === row.target)).toBe(false);
    expect(state.log.filter(entryLog => entryLog.action === 'effect:draw'))
      .toHaveLength(row.zeroEntryDraws);
    if (row.route === 'optional-discard') expect(owner.remove).toContain(DISCARD);
    expectSettled();
  });

  it.each(OPTIONAL_BASE_ROWS)('$cardId optional decline keeps the full scene and all costs untouched', row => {
    const sourceUid = openSource(row, 'self', `${row.cardId}-optional-decline`);
    resolveOptional(row, 'self', false);
    const owner = current().players.self;
    expect(owner.scene).toHaveLength(5);
    expect(owner.scene.find(character => character.uid === sourceUid)?.state).toBe('active');
    expect(row.origin === 'hand' ? owner.hand : owner.remove).toContain(row.target);
    expect(current().log.filter(entryLog => entryLog.action === 'effect:draw')).toHaveLength(0);
    if (row.route === 'optional-discard') expect(owner.hand).toContain(DISCARD);
    expectSettled();
  });

  it('B06090 owner=opp gets the same full-scene source-self switch authority', () => {
    const row = ROWS.find(entry => entry.cardId === 'B06090')!;
    proveFullScene(row, 'opp', 'B06090-owner-opp');
    expect(current().players.opp.remove).toContain('B06090');
    expect(current().players.self.remove).not.toContain('B06090');
  });

  it('B06090 rejects a forged cross-owner switch victim without moving either character', () => {
    const row = ROWS.find(entry => entry.cardId === 'B06090')!;
    const { sourceUid, entry } = reachEntry(row, 'self', 'B06090-forged-switch');
    const target = entry.candidates.find(candidate => candidate.cardId === row.target)!;
    const beforeState = JSON.stringify(current());
    const beforePending = useGameStateStore.getState().pendingEffectPick;
    expect(dispatchEngineAction(bindPendingDecision(entry, {
      type: 'effectPickResolve', pickedUid: target.uid, switchRemoveUid: 'opp-victim',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current()), 'forged switch is transactional').toBe(beforeState);
    expect(useGameStateStore.getState().pendingEffectPick).toEqual(beforePending);
    expect(current().players.self.scene.some(character => character.uid === sourceUid)).toBe(true);
  });
});
