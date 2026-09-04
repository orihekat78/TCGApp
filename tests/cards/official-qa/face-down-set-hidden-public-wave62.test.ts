// qa: card:B08033:d52596199be14d625d7776309eeaca145097a31eecca550237262ad7075cb2f4
// qa: card:B08034:41a4d71898ca68c0a066e9abd2abb7dadd774393e70eb45b6f20ad04f878f316
// qa: card:B08035:d52596199be14d625d7776309eeaca145097a31eecca550237262ad7075cb2f4
// qa: card:B10021:d5170059a9de91cea01aec02d44b8d76f2b3a0525695aa1ed607cfb81144b15d
// qa: card:B10022:d5170059a9de91cea01aec02d44b8d76f2b3a0525695aa1ed607cfb81144b15d
// qa: card:B10023:d5170059a9de91cea01aec02d44b8d76f2b3a0525695aa1ed607cfb81144b15d
// qa: card:B10026:c93226a2bebd7c4a5a21e373534e75faba33cbe2ec6c147a0d4b0d4a745cec10
// qa: card:B10027:c93226a2bebd7c4a5a21e373534e75faba33cbe2ec6c147a0d4b0d4a745cec10
// qa: card:B10040:c93226a2bebd7c4a5a21e373534e75faba33cbe2ec6c147a0d4b0d4a745cec10
// Rules: 16-card-set. Face-down identity is hidden from every viewer until removal.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { FILE_CARD_BACK_PLACEHOLDER, type CardDef, type GameState, type Player } from '@/engine/types';
import { runDeclaredAbilityFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { confirmSetCardCostChoice, toggleSetCardCostChoice } from '@/ui/hooks/useSetCardCostPicker';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const CASE_ALL = 'W62-CASE-ALL';
const PARTNER_ALL = 'W62-PARTNER-ALL';
const HOST_A = 'W62-HOST-A';
const HOST_B = 'W62-HOST-B';
const OPP_HOST = 'W62-OPP-HOST';
const SECRET_A = 'W62-SECRET-A';
const SECRET_B = 'W62-SECRET-B';
const PUBLIC_SET = 'W62-PUBLIC-SET';
const DRAW_1 = 'W62-DRAW-1';
const DRAW_2 = 'W62-DRAW-2';
const LEVEL4_TARGET = 'W62-LEVEL4-TARGET';
const LEVEL5_DECOY = 'W62-LEVEL5-DECOY';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['緑'], traits: [], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const fixtures: CardDef[] = [
  fixture(CASE_ALL, { kind: 'case', colors: ['青', '緑', '白', '黄', '赤', '黒'], caseLevel: 10, caseTraits: [] }),
  fixture(PARTNER_ALL, { kind: 'partner', colors: ['青', '緑', '白', '黄', '赤', '黒'], lp: 5 }),
  fixture(HOST_A, { names: ['服部平次'], colors: ['緑'], traits: ['警察'] }),
  fixture(HOST_B, { colors: ['緑'], traits: ['警察'] }),
  fixture(OPP_HOST),
  fixture(SECRET_A, { level: 4 }), fixture(SECRET_B, { kind: 'event', level: 2 }),
  fixture(PUBLIC_SET, { kind: 'event' }), fixture(DRAW_1, { kind: 'event' }), fixture(DRAW_2, { kind: 'event' }),
  fixture(LEVEL4_TARGET, { level: 4 }), fixture(LEVEL5_DECOY, { level: 5 }),
];

type Route = 'cost-two' | 'cost-one-pa' | 'effect-reasoning' | 'effect-declared' | 'effect-enter';
type Row = {
  cardId: string;
  baseId: string;
  abilityId: 'a1' | 'a2';
  abilityIndex: number;
  route: Route;
  costN?: 1 | 2;
};

const ROWS: Row[] = [
  { cardId: 'B08033', baseId: 'B08033', abilityId: 'a2', abilityIndex: 1, route: 'cost-two', costN: 2 },
  { cardId: 'B08033P', baseId: 'B08033', abilityId: 'a2', abilityIndex: 1, route: 'cost-two', costN: 2 },
  { cardId: 'B08034', baseId: 'B08034', abilityId: 'a2', abilityIndex: 1, route: 'effect-reasoning' },
  { cardId: 'B08034P', baseId: 'B08034', abilityId: 'a2', abilityIndex: 1, route: 'effect-reasoning' },
  { cardId: 'B08035', baseId: 'B08035', abilityId: 'a2', abilityIndex: 1, route: 'effect-declared' },
  { cardId: 'B10021', baseId: 'B10021', abilityId: 'a2', abilityIndex: 1, route: 'cost-one-pa', costN: 1 },
  { cardId: 'B10021P', baseId: 'B10021', abilityId: 'a2', abilityIndex: 1, route: 'cost-one-pa', costN: 1 },
  { cardId: 'B10022', baseId: 'B10022', abilityId: 'a2', abilityIndex: 1, route: 'cost-two', costN: 2 },
  { cardId: 'B10022P', baseId: 'B10022', abilityId: 'a2', abilityIndex: 1, route: 'cost-two', costN: 2 },
  { cardId: 'B10023', baseId: 'B10023', abilityId: 'a2', abilityIndex: 1, route: 'cost-two', costN: 2 },
  { cardId: 'B10023P', baseId: 'B10023', abilityId: 'a2', abilityIndex: 1, route: 'cost-two', costN: 2 },
  { cardId: 'B10026', baseId: 'B10026', abilityId: 'a1', abilityIndex: 0, route: 'effect-declared' },
  { cardId: 'B10026P', baseId: 'B10026', abilityId: 'a1', abilityIndex: 0, route: 'effect-declared' },
  { cardId: 'B10027', baseId: 'B10027', abilityId: 'a1', abilityIndex: 0, route: 'effect-declared' },
  { cardId: 'B10027P', baseId: 'B10027', abilityId: 'a1', abilityIndex: 0, route: 'effect-declared' },
  { cardId: 'B10040', baseId: 'B10040', abilityId: 'a2', abilityIndex: 1, route: 'effect-enter' },
];
const BASE_ROWS = ROWS.filter(row => row.cardId === row.baseId);
const BASE_COST_TWO = BASE_ROWS.filter(row => row.route === 'cost-two');

function other(side: Player): Player {
  return side === 'self' ? 'opp' : 'self';
}

function hidden(cardId: string, instanceId: string) {
  return { cardId, faceUp: false, instanceId };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave62 state');
  return state;
}

function prepared(row: Row, side: Player = 'self'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: side, phase: 'main', isFirstPlayerFirstTurn: false };
  const owner = state.players[side];
  owner.partner = { cardId: PARTNER_ALL, state: 'active', location: 'partner-area' };
  owner.case = { ...owner.case, cardId: CASE_ALL, status: '事件編', colors: ['青', '緑', '白', '黄', '赤', '黒'] };
  owner.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: DRAW_2 }));
  owner.deck = [DRAW_1, DRAW_2, DRAW_1, DRAW_2];
  const hostA = sceneChar(HOST_A, 'host-a', { setCards: [
    hidden(SECRET_A, 'set:hidden-a'),
    { cardId: PUBLIC_SET, faceUp: true, instanceId: 'set:public' },
  ] });
  const hostB = sceneChar(HOST_B, 'host-b', { setCards: [hidden(SECRET_B, 'set:hidden-b')] });
  if (row.route === 'cost-one-pa') {
    owner.scene = [hostA, hostB];
    owner.partnerAreaMR = sceneChar(row.cardId, `partnerMR:${side}`);
  } else if (row.route === 'effect-enter') {
    owner.scene = [hostA, hostB];
    owner.hand = [row.cardId];
  } else {
    owner.scene = [sceneChar(row.cardId, 'source'), hostA, hostB];
  }
  const opponent = state.players[other(side)];
  opponent.scene = [sceneChar(OPP_HOST, 'opp-host', { setCards: [hidden(SECRET_B, 'set:hidden-opp')] })];
  if (row.baseId === 'B10026') {
    opponent.scene.push(sceneChar(LEVEL4_TARGET, 'level4'), sceneChar(LEVEL5_DECOY, 'level5'));
  }
  opponent.deck = [DRAW_1, DRAW_2];
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-w62-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function sourceUid(row: Row, side: Player): string {
  return row.route === 'cost-one-pa' ? `partnerMR:${side}` : 'source';
}

function expectPrivateBeforeRemoval(state: GameState): void {
  expect(JSON.stringify(state)).toContain(SECRET_A);
  expect(JSON.stringify(state)).toContain(SECRET_B);
  for (const mode of ['solo-self', 'spectator'] as const) {
    const projected = projectReplayStateForViewer(state, mode);
    const json = JSON.stringify(projected);
    expect(json).not.toContain(SECRET_A);
    expect(json).not.toContain(SECRET_B);
    expect(json).not.toContain('set:hidden-a');
    expect(json).not.toContain('set:hidden-b');
    expect(json).not.toContain('set:hidden-opp');
    const hosted = [...projected.players.self.scene, ...projected.players.opp.scene]
      .flatMap(character => character.setCards);
    expect(hosted.filter(entry => !entry.faceUp).every(entry => entry.cardId === FILE_CARD_BACK_PLACEHOLDER)).toBe(true);
    expect(hosted.filter(entry => !entry.faceUp)).toHaveLength(3);
    expect(hosted).toContainEqual(expect.objectContaining({ cardId: PUBLIC_SET, faceUp: true }));
  }
}

function pendingPick(row: Row, side: Player, verb: string, uid = sourceUid(row, side)) {
  surfacePendingSideChannels();
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending, `${row.cardId}: ${verb} authority`).toMatchObject({
    player: side, ownerPlayer: side, atomVerb: verb,
    source: { cardId: row.cardId, uid, abilityId: row.abilityId, abilityOrigin: 'printed', abilityIndex: row.abilityIndex },
  });
  return pending!;
}

function resolvePick(row: Row, side: Player, verb: string, pickedUid: string | null): void {
  const pending = pendingPick(row, side, verb);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid,
  }))).toEqual({ ok: true });
}

function costParams(row: Row) {
  const n = row.costN ?? 0;
  return {
    removeSetCard: {
      hostUids: n === 1 ? ['host-a'] : ['host-a', 'host-b'],
      instanceIds: n === 1 ? ['set:hidden-a'] : ['set:hidden-a', 'set:hidden-b'],
    },
  };
}

function triggerCost(row: Row, side: Player): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility', uid: sourceUid(row, side), abilId: row.abilityId,
    abilityOrigin: 'printed', abilityIndex: row.abilityIndex, costParams: costParams(row),
  })).toEqual({ ok: true });
  if (row.baseId === 'B08033') resolvePick(row, side, 'charModifyAP', null);
  if (row.baseId === 'B10022') resolvePick(row, side, 'sceneRemove', null);
  if (row.baseId === 'B10021') {
    const discard = pendingPick(row, side, 'discard');
    expect(discard.candidates).toHaveLength(1);
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: discard.candidates[0]!.uid,
    }))).toEqual({ ok: true });
  }
}

function triggerEffect(row: Row, side: Player): string {
  let uid = sourceUid(row, side);
  if (row.route === 'effect-reasoning') {
    expect(dispatchEngineAction({ type: 'reasoning', uid })).toEqual({ ok: true });
  } else if (row.route === 'effect-enter') {
    expect(dispatchEngineAction({ type: 'handUseCard', player: side, cardId: row.cardId })).toEqual({ ok: true });
    uid = current().players[side].scene.find(character => character.cardId === row.cardId)!.uid;
  } else {
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid, abilId: row.abilityId,
      abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
    })).toEqual({ ok: true });
  }
  return uid;
}

function expectSettled(): void {
  surfacePendingSideChannels();
  const store = useGameStateStore.getState();
  expect([store.pendingEffectPick, store.pendingEffectOptional, store.pendingEffectChoice, store.pendingSetCardChoice])
    .toEqual([null, null, null, null]);
  expect(current().pendingRuntimeState).toBeUndefined();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function advanceDeclaredUiFlow(source: string): Promise<void> {
  for (let step = 0; step < 6; step += 1) {
    if (useGameStateStore.getState().pendingSetCardChoice) return;
    const target = useTargetPickerStore.getState();
    if (target._resolver) {
      const resolve = target._resolver;
      target._setPhase({ phase: 'idle' });
      target._setResolver(null);
      resolve(source);
      await tick();
      continue;
    }
    const choice = useChoicePickerStore.getState();
    if (choice._resolver) {
      const resolve = choice._resolver;
      choice._setCurrent(null);
      choice._setResolver(null);
      resolve({ kind: 'choose', index: 0 });
      await tick();
      continue;
    }
    const confirmation = useConfirmationStore.getState();
    if (confirmation._resolver) {
      const resolve = confirmation._resolver;
      confirmation._setCurrent(null);
      confirmation._setResolver(null);
      resolve(true);
      await tick();
      continue;
    }
    await tick();
  }
}

function proveRow(row: Row, side: Player, label: string): void {
  install(prepared(row, side), label, side);
  expectPrivateBeforeRemoval(current());
  if (row.costN) {
    triggerCost(row, side);
    const owner = current().players[side];
    expect(owner.remove).toContain(SECRET_A);
    if (row.costN === 2) expect(owner.remove).toContain(SECRET_B);
    expect(owner.scene.find(character => character.uid === 'host-a')?.setCards)
      .toContainEqual(expect.objectContaining({ cardId: PUBLIC_SET, faceUp: true }));
    const projected = projectReplayStateForViewer(current(), side === 'self' ? 'solo-self' : 'spectator');
    expect(projected.players[side].remove).toContain(SECRET_A);
    expectSettled();
    return;
  }

  const uid = triggerEffect(row, side);
  const pending = pendingPick(row, side, 'charRemoveSetCard', uid);
  expect(pending.candidates.length).toBeGreaterThan(0);
  expect(pending.candidates.every(candidate => candidate.hidden === true)).toBe(true);
  expect(JSON.stringify(pending)).not.toContain(SECRET_A);
  expect(JSON.stringify(pending)).not.toContain(SECRET_B);
  expect(pending.candidates.map(candidate => candidate.setCardInstanceId)).not.toContain('set:public');
  const selectedInstance = row.route === 'effect-enter' ? 'set:hidden-opp' : 'set:hidden-a';
  const selected = pending.candidates.find(candidate => candidate.setCardInstanceId === selectedInstance);
  expect(selected).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve', pickedUid: selected!.uid,
  }))).toEqual({ ok: true });

  if (row.baseId === 'B08035') {
    const apPick = pendingPick(row, side, 'charModifyAP', uid);
    const source = apPick.candidates.find(candidate => candidate.uid === uid)!;
    expect(dispatchEngineAction(bindPendingDecision(apPick, {
      type: 'effectPickResolve', pickedUid: source.uid,
    }))).toEqual({ ok: true });
    expect(readChar.ap(current(), uid)).toBe(7000);
  }
  if (row.baseId === 'B10026') {
    const removal = pendingPick(row, side, 'sceneRemove', uid);
    expect(removal.candidates.map(candidate => candidate.uid)).toContain('level4');
    expect(removal.candidates.map(candidate => candidate.uid)).not.toContain('level5');
    expect(dispatchEngineAction(bindPendingDecision(removal, {
      type: 'effectPickResolve', pickedUid: 'level4',
    }))).toEqual({ ok: true });
  }
  if (row.baseId === 'B10027') {
    expect(readChar.ap(current(), uid)).toBe(6000);
    expect(readChar.hasKeyword(current(), uid, '突撃')).toBe(true);
  }
  const removedSide = row.route === 'effect-enter' ? other(side) : side;
  const removedSecret = row.route === 'effect-enter' ? SECRET_B : SECRET_A;
  expect(current().players[removedSide].remove).toContain(removedSecret);
  expect(current().players[side].scene.find(character => character.uid === 'host-a')?.setCards)
    .toContainEqual(expect.objectContaining({ cardId: PUBLIC_SET, faceUp: true }));
  const projected = projectReplayStateForViewer(current(), side === 'self' ? 'solo-self' : 'spectator');
  expect(projected.players[removedSide].remove).toContain(removedSecret);
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
  useTargetPickerStore.getState()._reset();
  useChoicePickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave62: face-down set identity stays private until removal', () => {
  it.each(ROWS)('$cardId hides exact set identities through its public set-card route', row => {
    proveRow(row, 'self', `${row.cardId}-privacy`);
    if (row.cardId === 'B08033') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B08034') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B08035') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B10021') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B10022') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B10023') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B10026') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B10027') expect(current().players.self.remove).toContain('W62-SECRET-A');
    if (row.cardId === 'B10040') expect(current().players.opp.remove).toContain('W62-SECRET-B');
  });

  it.each(BASE_COST_TWO)('$cardId rejects an insufficient exact-two hidden-set cost transactionally', row => {
    const state = prepared(row);
    state.players.self.scene.find(character => character.uid === 'host-b')!.setCards = [];
    install(state, `${row.cardId}-insufficient`, 'self');
    const before = current();
    const beforeJson = JSON.stringify(before);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: sourceUid(row, 'self'), abilId: row.abilityId,
      abilityOrigin: 'printed', abilityIndex: row.abilityIndex,
      costParams: { removeSetCard: { hostUids: ['host-a'], instanceIds: ['set:hidden-a'] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
  });

  it.each([
    ['duplicate', ['host-a', 'host-a'], ['set:hidden-a', 'set:hidden-a']],
    ['stale', ['host-a', 'host-b'], ['set:hidden-a', 'set:missing']],
    ['cross-owner', ['host-a', 'opp-host'], ['set:hidden-a', 'set:hidden-opp']],
  ] as const)('B10022 rejects a %s hidden-set witness transactionally', (_label, hostUids, instanceIds) => {
    const row = ROWS.find(entry => entry.cardId === 'B10022')!;
    install(prepared(row), `B10022-${_label}`, 'self');
    const before = current();
    const beforeJson = JSON.stringify(before);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeSetCard: { hostUids: [...hostUids], instanceIds: [...instanceIds] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(JSON.stringify(current())).toBe(beforeJson);
  });

  it('B10021 rejects its one-card cost when only a face-up set card remains', () => {
    const row = ROWS.find(entry => entry.cardId === 'B10021')!;
    const state = prepared(row);
    state.players.self.scene.find(character => character.uid === 'host-a')!.setCards = [
      { cardId: PUBLIC_SET, faceUp: true, instanceId: 'set:public' },
    ];
    state.players.self.scene.find(character => character.uid === 'host-b')!.setCards = [];
    install(state, 'B10021-face-up-only', 'self');
    const before = JSON.stringify(current());
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { removeSetCard: { hostUids: ['host-a'], instanceIds: ['set:public'] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(before);
  });

  it('B10023 public cost UI carries occurrence authority without hidden card identity', async () => {
    const row = ROWS.find(entry => entry.cardId === 'B10023')!;
    install(prepared(row), 'B10023-public-cost-ui', 'self');
    const flow = runDeclaredAbilityFlow({ player: 'self' });
    await advanceDeclaredUiFlow('source');
    const pending = useGameStateStore.getState().pendingSetCardChoice;
    expect(pending).toMatchObject({
      player: 'self', purpose: 'cost', nMin: 2, nMax: 2,
      source: { uid: 'source', cardId: 'B10023', abilityId: 'a2' },
    });
    expect(pending?.entries).toHaveLength(2);
    expect(pending?.entries.every(entry => entry.hidden === true && entry.cardId === undefined)).toBe(true);
    expect(pending?.entries.map(entry => entry.instanceId).sort()).toEqual(['set:hidden-a', 'set:hidden-b']);
    expect(JSON.stringify(pending)).not.toContain(SECRET_A);
    expect(JSON.stringify(pending)).not.toContain(SECRET_B);
    toggleSetCardCostChoice('set:hidden-a');
    toggleSetCardCostChoice('set:hidden-b');
    confirmSetCardCostChoice();
    await expect(flow).resolves.toEqual({ ok: true });
    expect(current().players.self.remove).toEqual(expect.arrayContaining([SECRET_A, SECRET_B]));
    expect(useGameStateStore.getState().pendingSetCardChoice).toBeNull();
  });

  it('B10026 owner=opp receives the same hidden pending authority and reveal boundary', () => {
    const row = ROWS.find(entry => entry.cardId === 'B10026')!;
    proveRow(row, 'opp', 'B10026-owner-opp');
    expect(current().players.opp.remove).toContain(SECRET_A);
    expect(current().players.self.remove).toContain(LEVEL4_TARGET);
  });
});
