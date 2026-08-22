// qa: card:B04048:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B06013:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B06098:014f2691ad874f37e79a23b267a277a9a5765c69846855f51d1a56be3b297313
// qa: card:B07010:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B07015:3c04cba51906fa1ef9003b4bc5b559506c8bc3c060a9eb376693659ec29e5c6c
// qa: card:B08024:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B08071:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B08094:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B09073:53a5d52afc28c1985518616756bcd02b3756db1813dbe83fa54068f30dbe474d
// qa: card:B09112:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:B10068:ab95854e7cd23f7bf1f7ed620d4e6b5b95c4d1e008dd5b63ba100a8632121099
// qa: card:B10082:c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf
// qa: card:PR098:6f90cb127af1c12c8a5b08b830d7a2d32066a401549fe855e6fd4d5d8bd1edeb
// qa: card:PR104:6f90cb127af1c12c8a5b08b830d7a2d32066a401549fe855e6fd4d5d8bd1edeb
// qa: card:PR180:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:PR186:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// Rules: 15-abilities-effects.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { _peekPendingDeckRevealSide } from '@/engine/effect/atom-handlers';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, def as readDef, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

type Route = 'scene-declared' | 'case-declared' | 'partner-declared' | 'enter'
  | 'partner-enter' | 'leave' | 'end';
type Row = {
  cardId: string;
  abilityId: string;
  qa: string;
  route: Route;
  maxN: number;
  remainder: 'bottom' | 'remove';
};

const SENTINEL = 'W30-SENTINEL';
const TAIL = 'W30-DECK-TAIL';
const OPP_DECK = ['W30-OPP-1', 'W30-OPP-2', 'W30-OPP-3', 'W30-OPP-4', 'W30-OPP-5'] as const;
const ATTACKER = 'W30-ATTACKER';
const SET_CARD = 'W30-SET-CARD';
const HOST = 'W30-HOST';
const HEIJI = 'W30-HEIJI';
const KUDO = 'W30-KUDO';
const HAIBARA = 'W30-HAIBARA';
const KID = 'W30-KID';
const FURUYA = 'W30-FURUYA';
const BLACK_A = 'W30-BLACK-A';
const BLACK_B = 'W30-BLACK-B';
const DECOYS = ['W30-DECOY-1', 'W30-DECOY-2', 'W30-DECOY-3'] as const;

const ROWS: readonly Row[] = [
  { cardId: 'B04048', abilityId: 'a2', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'scene-declared', maxN: 2, remainder: 'bottom' },
  { cardId: 'B06013', abilityId: 'a2', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'case-declared', maxN: 3, remainder: 'bottom' },
  { cardId: 'B06098', abilityId: 'a2', qa: '014f2691ad874f37e79a23b267a277a9a5765c69846855f51d1a56be3b297313', route: 'partner-declared', maxN: 3, remainder: 'remove' },
  { cardId: 'B07010', abilityId: 'a1', qa: '3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd', route: 'enter', maxN: 2, remainder: 'remove' },
  { cardId: 'B07015', abilityId: 'a2', qa: '3c04cba51906fa1ef9003b4bc5b559506c8bc3c060a9eb376693659ec29e5c6c', route: 'partner-enter', maxN: 4, remainder: 'remove' },
  { cardId: 'B08024', abilityId: 'a2', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'scene-declared', maxN: 3, remainder: 'bottom' },
  { cardId: 'B08071', abilityId: 'a1', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'scene-declared', maxN: 4, remainder: 'bottom' },
  { cardId: 'B08094', abilityId: 'a2', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'case-declared', maxN: 3, remainder: 'bottom' },
  { cardId: 'B09073', abilityId: 'a2', qa: '53a5d52afc28c1985518616756bcd02b3756db1813dbe83fa54068f30dbe474d', route: 'leave', maxN: 3, remainder: 'remove' },
  { cardId: 'B09112', abilityId: 'a2', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'case-declared', maxN: 1, remainder: 'bottom' },
  { cardId: 'B10068', abilityId: 'a2', qa: 'ab95854e7cd23f7bf1f7ed620d4e6b5b95c4d1e008dd5b63ba100a8632121099', route: 'end', maxN: 2, remainder: 'remove' },
  { cardId: 'B10082', abilityId: 'a2', qa: 'c2131ef2b4d611ed2fdcba93cb1619157aea6dcc39318ced5a4a6f69bc29faaf', route: 'case-declared', maxN: 2, remainder: 'remove' },
  { cardId: 'PR098', abilityId: 'a1', qa: '6f90cb127af1c12c8a5b08b830d7a2d32066a401549fe855e6fd4d5d8bd1edeb', route: 'enter', maxN: 2, remainder: 'bottom' },
  { cardId: 'PR104', abilityId: 'a1', qa: '6f90cb127af1c12c8a5b08b830d7a2d32066a401549fe855e6fd4d5d8bd1edeb', route: 'enter', maxN: 2, remainder: 'bottom' },
  { cardId: 'PR180', abilityId: 'a2', qa: '3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd', route: 'enter', maxN: 3, remainder: 'bottom' },
  { cardId: 'PR186', abilityId: 'a2', qa: '3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd', route: 'enter', maxN: 3, remainder: 'bottom' },
];

function fixtureCard(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...overrides,
  };
}

function targetCard(row: Row): CardDef {
  const id = `W30-TARGET-${row.cardId}`;
  switch (row.cardId) {
    case 'B04048': return fixtureCard(id, { names: ['対象-B04048'] });
    case 'B06013': return fixtureCard(id, { names: ['工藤新一'] });
    case 'B06098': return fixtureCard(id, { colors: ['黒'], level: 3, keywords: ['カットイン'] });
    case 'B07010': return fixtureCard(id, { traits: ['少年探偵団'] });
    case 'B07015': return fixtureCard(id, { kind: 'event', colors: ['緑'], ap: undefined, lp: undefined });
    case 'B08024': return fixtureCard(id, { colors: ['緑'] });
    case 'B08071': return fixtureCard(id, { names: ['佐藤美和子'] });
    case 'B08094': return fixtureCard(id, { keywords: ['現場リムーブ時'] });
    case 'B09073': return fixtureCard(id, { level: 7, keywords: ['疾風'] });
    case 'B09112': return fixtureCard(id, { names: ['キッド'] });
    case 'B10068':
    case 'B10082': return fixtureCard(id, { names: ['降谷零'] });
    case 'PR098':
    case 'PR104': return fixtureCard(id, { traits: ['高校生'] });
    case 'PR180':
    case 'PR186': return fixtureCard(id, { traits: ['FBI'] });
    default: throw new Error(`${row.cardId}: missing target fixture`);
  }
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function baseState(row: Row, targetId: string): GameState {
  const state = createEmptyGameState();
  state.turn = {
    number: 6,
    player: row.route === 'leave' ? 'opp' : 'self',
    phase: 'main',
    isFirstPlayerFirstTurn: false,
  };
  state.players.self.case.colors = ['赤', '青', '緑', '黄', '白', '黒'];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [SENTINEL];
  state.players.self.deck = [targetId, ...DECOYS.slice(0, row.maxN - 1), TAIL];
  state.players.opp.deck = [...OPP_DECK];

  if (row.route === 'case-declared') {
    state.players.self.case.cardId = row.cardId;
    state.players.self.case.status = '解決編';
    state.players.self.evidence = [0, 1].map(index => ({
      cardId: `W30-EVIDENCE-${index}`,
      faceUp: false,
      origin: { turn: 1, via: 'effect' as const },
    }));
  }

  switch (row.cardId) {
    case 'B04048':
      state.players.self.scene = [makeChar({ cardId: row.cardId, uid: 'source' })];
      break;
    case 'B06013':
      state.players.self.scene = [makeChar({ cardId: KUDO, uid: 'condition-kudo' })];
      break;
    case 'B06098':
      state.players.self.partnerAreaMR = makeChar({ cardId: row.cardId, uid: 'partnerMR:self' });
      state.players.self.scene = [
        makeChar({ cardId: BLACK_A, uid: 'black-a' }),
        makeChar({ cardId: BLACK_B, uid: 'black-b' }),
      ];
      break;
    case 'B07010':
      state.players.self.case.status = '解決編';
      state.players.self.hand.unshift(row.cardId);
      break;
    case 'B07015':
      state.players.self.partnerAreaMR = makeChar({ cardId: row.cardId, uid: 'partnerMR:self' });
      state.players.self.hand.unshift(HEIJI);
      break;
    case 'B08024':
      state.players.self.scene = [
        makeChar({ cardId: row.cardId, uid: 'source' }),
        makeChar({
          cardId: HOST,
          uid: 'set-host',
          setCards: [{ cardId: SET_CARD, faceUp: false, instanceId: 'set:wave30:0' }],
        }),
      ];
      break;
    case 'B08071':
      state.players.self.scene = [makeChar({ cardId: row.cardId, uid: 'source' })];
      break;
    case 'B08094':
      state.players.self.scene = [makeChar({ cardId: HAIBARA, uid: 'condition-haibara' })];
      break;
    case 'B09073':
      state.players.self.scene = [makeChar({ cardId: row.cardId, uid: 'source', state: 'sleep' })];
      state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
      break;
    case 'B09112':
      state.players.self.scene = [makeChar({ cardId: KID, uid: 'condition-kid' })];
      break;
    case 'B10068':
      state.players.self.scene = [
        makeChar({ cardId: row.cardId, uid: 'source' }),
        makeChar({ cardId: FURUYA, uid: 'condition-furuya' }),
      ];
      break;
    case 'B10082':
      state.players.self.scene = [makeChar({ cardId: FURUYA, uid: 'condition-furuya' })];
      break;
    default:
      state.players.self.hand.unshift(row.cardId);
      break;
  }
  return state;
}

function removeThroughPublicContact(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function orderEnterEffects(row: Row, enteredUid: string): void {
  const group = pendingOwnerOrderGroup(current(), 'self');
  expect(group.map(entry => entry.source.abilityId).sort(), `${row.cardId}: simultaneous enter effects`).toEqual(['a1', 'a2']);
  const deckLook = group.find(entry => entry.source.uid === enteredUid && entry.source.abilityId === row.abilityId)!;
  expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: deckLook.id, order: 0, player: 'self' })).toEqual({ ok: true });
  const ordered = pendingOwnerOrderGroup(current(), 'self');
  expect(dispatchEngineAction({
    type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map(entry => entry.id),
  })).toEqual({ ok: true });
}

function trigger(row: Row): { uid: string; area: string } {
  if (row.route === 'scene-declared') {
    const costParams = row.cardId === 'B04048' ? { declaredName: '対象-B04048' } : undefined;
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'source', abilId: row.abilityId, ...(costParams ? { costParams } : {}),
    })).toEqual({ ok: true });
    if (row.cardId === 'B08024') {
      const setPick = useGameStateStore.getState().pendingEffectPick;
      expect(setPick?.atomVerb).toBe('charRemoveSetCard');
      expect(setPick?.candidates).toHaveLength(1);
      expect(dispatchEngineAction(bindPendingDecision(setPick!, {
        type: 'effectPickResolve', pickedUid: setPick!.candidates[0]!.uid,
      }))).toEqual({ ok: true });
    }
    return { uid: 'source', area: 'scene' };
  }

  if (row.route === 'case-declared') {
    const costParams = {
      flipFaceUpEvidence: { indices: [0, 1] },
      ...(row.cardId === 'B09112' ? { declaredName: 'キッド' } : {}),
    };
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'case:self', abilId: row.abilityId, costParams,
    })).toEqual({ ok: true });
    return { uid: 'case:self', area: 'case' };
  }

  if (row.route === 'partner-declared') {
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: row.abilityId,
    })).toEqual({ ok: true });
    return { uid: 'partnerMR:self', area: 'partner-area' };
  }

  if (row.route === 'enter') {
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: row.cardId })).toEqual({ ok: true });
    const entered = current().players.self.scene.find(card => card.cardId === row.cardId);
    if (!entered) throw new Error(`${row.cardId}: source did not enter`);
    if (row.cardId === 'PR180' || row.cardId === 'PR186') orderEnterEffects(row, entered.uid);
    return { uid: entered.uid, area: 'scene' };
  }

  if (row.route === 'partner-enter') {
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: HEIJI })).toEqual({ ok: true });
    return { uid: 'partnerMR:self', area: 'partner-area' };
  }

  if (row.route === 'leave') {
    removeThroughPublicContact();
    return { uid: 'source', area: 'scene' };
  }

  expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
  return { uid: 'source', area: 'scene' };
}

function settlePublicTail(): void {
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
  }
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve', order: [...reorder.cardIds],
    }))).toEqual({ ok: true });
  }
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
}

function expectTerminalCleared(row: Row): void {
  const store = useGameStateStore.getState();
  const pendingKeys = [
    'pendingHirameki', 'pendingMisread', 'pendingEffectPick', 'pendingEffectChoice',
    'pendingEffectOptional', 'pendingChooseIntercept', 'pendingLeaveIntercept', 'pendingRps',
    'pendingSetCardChoice', 'pendingSetCardReplacement', 'pendingEffectRepeatOptional',
    'pendingDeckReveal', 'pendingPublicHandReveal', 'pendingDeckReorder', 'pendingDeckPlace',
  ] as const;
  for (const key of pendingKeys) expect(store[key], `${row.cardId}: ${key}`).toBeNull();
  expect(store.activeActionId, `${row.cardId}: active action`).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved'), `${row.cardId}: effect stack`).toBe(true);
  expect(current().pendingTurnTransition, `${row.cardId}: turn continuation`).toBeUndefined();
}

function expectCardSpecificTail(row: Row, sourceUid: string): void {
  const state = current();
  if (row.route === 'case-declared') expect(state.players.self.evidence.every(item => item.faceUp)).toBe(true);
  if (row.cardId === 'B08024') expect(state.players.self.remove).toContain(SET_CARD);
  if (row.cardId === 'B08071' || row.cardId === 'B09073') expect(state.players.self.remove).toContain(row.cardId);
  if (row.cardId === 'B07015') expect(state.players.self.scene.some(card => card.cardId === HEIJI)).toBe(true);
  if (row.cardId === 'B10068') expect(state.turn).toMatchObject({ number: 7, player: 'opp', phase: 'main' });
  if (row.cardId === 'PR180' || row.cardId === 'PR186') {
    expect(state.players.self.scene.find(card => card.uid === sourceUid)?.state).toBe('sleep');
  }
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  for (const card of [
    fixtureCard(SENTINEL), fixtureCard(TAIL), ...OPP_DECK.map(id => fixtureCard(id)),
    fixtureCard(ATTACKER, { ap: 9000 }), fixtureCard(SET_CARD), fixtureCard(HOST),
    fixtureCard(HEIJI, { names: ['服部平次'], colors: ['緑'] }),
    fixtureCard(KUDO, { names: ['工藤新一'] }), fixtureCard(HAIBARA, { names: ['灰原哀'] }),
    fixtureCard(KID, { names: ['キッド'] }), fixtureCard(FURUYA, { names: ['降谷零'] }),
    fixtureCard(BLACK_A, { traits: ['黒ずくめの組織'] }), fixtureCard(BLACK_B, { traits: ['黒ずくめの組織'] }),
    ...DECOYS.map(id => fixtureCard(id)),
  ]) register(card);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  vi.restoreAllMocks();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

function prove(row: Row): string {
  const source = readDef.card(row.cardId);
  expect(source, `${row.cardId}: registered source`).toBeDefined();
  const target = targetCard(row);
  register(target);
  install(baseState(row, target.id), `qa-wave30-${row.cardId}`);

  const authority = trigger(row);
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.atomVerb, `${row.cardId}: deck look surfaced`).toBe('deckRevealUntil');
  expect(pending?.source, `${row.cardId}: exact source authority`).toMatchObject({
    cardId: row.cardId,
    abilityId: row.abilityId,
    uid: authority.uid,
    area: authority.area,
  });
  expect([pending?.nMin, pending?.nMax], `${row.cardId}: up-to-one range`).toEqual([0, 1]);
  expect(pending?.candidates.map(candidate => candidate.cardId), `${row.cardId}: eligible match exists`).toEqual([target.id]);
  const looked = [target.id, ...DECOYS.slice(0, row.maxN - 1)];
  if (row.cardId === 'B10068') {
    const reveal = useGameStateStore.getState().pendingDeckReveal;
    expect(reveal, 'B10068: private look waits for its owner choice').toMatchObject({
      player: 'self', visibility: 'private', viewer: 'self', awaitingPick: true, revealed: looked,
      source: { cardId: 'B10068', abilityId: 'a2' },
    });
    expect(useGameStateStore.getState().pendingPublicHandReveal,
      'B10068: choice window publishes no deck identity').toBeNull();
  }

  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
  if (row.cardId === 'B10068') {
    const reveal = useGameStateStore.getState().pendingDeckReveal;
    expect(reveal, 'B10068: private look records the decline').toMatchObject({
      player: 'self', visibility: 'private', viewer: 'self', matched: null,
      source: { cardId: 'B10068', abilityId: 'a2' },
    });
    expect(reveal?.awaitingPick, 'B10068: public reveal leaves hold mode').toBeUndefined();
    expect(useGameStateStore.getState().pendingPublicHandReveal,
      'B10068: decline publishes no deck identity').toBeNull();
  }
  settlePublicTail();

  const state = current();
  expect(state.players.self.hand, `${row.cardId}: eligible target declined`).not.toContain(target.id);
  expect(state.players.self.hand, `${row.cardId}: selected-only discard skipped`).toContain(SENTINEL);
  if (row.remainder === 'remove') {
    expect(state.players.self.remove, `${row.cardId}: all looked cards removed`).toEqual(expect.arrayContaining(looked));
    expect(state.players.self.deck, `${row.cardId}: only unrevealed tail remains`).toEqual([TAIL]);
  } else {
    expect(state.players.self.deck[0], `${row.cardId}: unrevealed tail stays on top`).toBe(TAIL);
    expect(state.players.self.deck, `${row.cardId}: all declined cards moved to bottom`).toEqual(expect.arrayContaining(looked));
    expect(state.players.self.remove, `${row.cardId}: bottom cards not removed`).not.toEqual(expect.arrayContaining(looked));
  }
  expectCardSpecificTail(row, authority.uid);
  expectTerminalCleared(row);
  return row.cardId;
}

describe('official QA Wave 30: deck-look up-to-one may decline an eligible match', () => {
  it(`card:B04048:${ROWS[0]!.qa}`, () => expect(prove(ROWS[0]!)).toBe('B04048'));
  it(`card:B06013:${ROWS[1]!.qa}`, () => expect(prove(ROWS[1]!)).toBe('B06013'));
  it(`card:B06098:${ROWS[2]!.qa}`, () => expect(prove(ROWS[2]!)).toBe('B06098'));
  it(`card:B07010:${ROWS[3]!.qa}`, () => expect(prove(ROWS[3]!)).toBe('B07010'));
  it(`card:B07015:${ROWS[4]!.qa}`, () => expect(prove(ROWS[4]!)).toBe('B07015'));
  it(`card:B08024:${ROWS[5]!.qa}`, () => expect(prove(ROWS[5]!)).toBe('B08024'));
  it(`card:B08071:${ROWS[6]!.qa}`, () => expect(prove(ROWS[6]!)).toBe('B08071'));
  it(`card:B08094:${ROWS[7]!.qa}`, () => expect(prove(ROWS[7]!)).toBe('B08094'));
  it(`card:B09073:${ROWS[8]!.qa}`, () => expect(prove(ROWS[8]!)).toBe('B09073'));
  it(`card:B09112:${ROWS[9]!.qa}`, () => expect(prove(ROWS[9]!)).toBe('B09112'));
  it(`card:B10068:${ROWS[10]!.qa}`, () => expect(prove(ROWS[10]!)).toBe('B10068'));
  it(`card:B10082:${ROWS[11]!.qa}`, () => expect(prove(ROWS[11]!)).toBe('B10082'));
  it(`card:PR098:${ROWS[12]!.qa}`, () => expect(prove(ROWS[12]!)).toBe('PR098'));
  it(`card:PR104:${ROWS[13]!.qa}`, () => expect(prove(ROWS[13]!)).toBe('PR104'));
  it(`card:PR180:${ROWS[14]!.qa}`, () => expect(prove(ROWS[14]!)).toBe('PR180'));
  it(`card:PR186:${ROWS[15]!.qa}`, () => expect(prove(ROWS[15]!)).toBe('PR186'));

  it('B10068 keeps the looked pair private and publishes only the selected card', () => {
    const row = ROWS[10]!;
    const target = targetCard(row);
    register(target);
    install(baseState(row, target.id), 'qa-wave30-B10068-selected-publication');
    trigger(row);

    const pending = useGameStateStore.getState().pendingEffectPick!;
    const selected = pending.candidates[0]!;
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      visibility: 'private', viewer: 'self', revealed: [target.id, DECOYS[0]], awaitingPick: true,
    });
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: selected.uid,
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'self', audience: 'all', cardIds: [target.id], lifetime: 'presentation',
      origin: 'deck-selected-card', source: { cardId: 'B10068', abilityId: 'a2' },
    });
    expect(useGameStateStore.getState().pendingPublicHandReveal?.cardIds).not.toContain(DECOYS[0]);
    expect(current().players.self.hand).toContain(target.id);
    expect(current().players.self.remove).toContain(DECOYS[0]);
    expect(current().players.self.deck).toEqual([TAIL]);
    expect(current().turn).toMatchObject({ number: 7, player: 'opp', phase: 'main' });

    useGameStateStore.getState().setPendingDeckReveal(null);
    useGameStateStore.getState().setPendingPublicHandReveal(null);
    expectTerminalCleared(row);
  });

  it('B10068 keeps the CPU look off the human surface and publishes its selected card only', () => {
    const row = ROWS[10]!;
    const target = targetCard(row);
    register(target);
    const state = createEmptyGameState();
    state.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.deck = [target.id, DECOYS[0], TAIL];
    state.players.opp.scene = [
      makeChar({ cardId: 'B10068', uid: 'opp-source' }),
      makeChar({ cardId: FURUYA, uid: 'opp-furuya' }),
    ];
    install(state, 'qa-wave30-B10068-cpu-private-look');

    expect(dispatchEngineAction({ type: 'endTurn', player: 'opp' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingDeckReveal,
      'B10068 CPU: private deck window never reaches the human store').toBeNull();
    expect(_peekPendingDeckRevealSide(),
      'B10068 CPU: private deck window never reaches the human side channel').toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick,
      'B10068 CPU: AI selection does not expose a human choice').toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      owner: 'opp', audience: 'all', cardIds: [target.id], lifetime: 'presentation',
      origin: 'deck-selected-card', source: { cardId: 'B10068', abilityId: 'a2', uid: 'opp-source' },
    });
    expect(useGameStateStore.getState().pendingPublicHandReveal?.cardIds).not.toContain(DECOYS[0]);
    expect(current().players.opp.hand).toContain(target.id);
    expect(current().players.opp.remove).toContain(DECOYS[0]);
    expect(current().players.opp.deck).toEqual([TAIL]);
    expect(current().turn).toMatchObject({ number: 7, player: 'self', phase: 'main' });

    useGameStateStore.getState().setPendingPublicHandReveal(null);
    expectTerminalCleared(row);
  });
});

function zeroCandidateWindow(row: Row): string[] {
  return Array.from({ length: row.maxN }, (_, index) => DECOYS[index % DECOYS.length]!);
}

function proveZeroCandidate(row: Row): void {
  const looked = zeroCandidateWindow(row);
  const state = baseState(row, looked[0]!);
  state.players.self.deck = [...looked, TAIL];
  install(state, `qa-wave30-${row.cardId}-zero-candidate`);

  const authority = trigger(row);
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.atomVerb, `${row.cardId}: empty result still asks for confirmation`).toBe('deckRevealUntil');
  expect([pending?.nMin, pending?.nMax], `${row.cardId}: empty range clamps to zero`).toEqual([0, 0]);
  expect(pending?.candidates, `${row.cardId}: no eligible deck card`).toEqual([]);
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
  settlePublicTail();

  const result = current();
  expect(result.players.self.hand, `${row.cardId}: no card added`).toContain(SENTINEL);
  if (row.remainder === 'remove') {
    expect(result.players.self.remove, `${row.cardId}: every looked non-match removed`)
      .toEqual(expect.arrayContaining(looked));
    expect(result.players.self.deck, `${row.cardId}: unrevealed tail only`).toEqual([TAIL]);
  } else {
    expect(result.players.self.deck[0], `${row.cardId}: tail remains on top`).toBe(TAIL);
    expect(result.players.self.deck, `${row.cardId}: non-matches moved to bottom`)
      .toEqual(expect.arrayContaining(looked));
  }
  expectCardSpecificTail(row, authority.uid);
  expectTerminalCleared(row);
}

function provePromoSelection(row: Row): void {
  const target = targetCard(row);
  register(target);
  install(baseState(row, target.id), `qa-wave30-${row.cardId}-selected`);
  trigger(row);

  const deckPick = useGameStateStore.getState().pendingEffectPick;
  const selected = deckPick?.candidates.find(candidate => candidate.cardId === target.id);
  expect(selected, `${row.cardId}: eligible 高校生 candidate`).toBeDefined();
  expect(dispatchEngineAction(bindPendingDecision(deckPick!, {
    type: 'effectPickResolve', pickedUid: selected!.uid,
  }))).toEqual({ ok: true });

  settlePublicTail();

  expect(current().players.self.hand, `${row.cardId}: selected candidate reaches hand`).toContain(target.id);
  expect(current().players.self.hand, `${row.cardId}: unrelated hand card remains`).toContain(SENTINEL);
  expect(current().players.self.remove, `${row.cardId}: selected branch does not discard`).not.toContain(SENTINEL);
  expect(current().players.self.deck[0], `${row.cardId}: unrevealed tail remains first`).toBe(TAIL);
  expect(current().players.self.deck, `${row.cardId}: decoy returns to bottom`)
    .toEqual(expect.arrayContaining([DECOYS[0]]));
  expectTerminalCleared(row);
}

describe('official QA Wave 30: missing candidate and selected-tail regressions', () => {
  it.each(ROWS)('$cardId completes through a zero-candidate deck window', row => {
    proveZeroCandidate(row);
  });

  it.each([ROWS[12]!, ROWS[13]!])('$cardId completes its selected-card and deck-bottom branch', row => {
    provePromoSelection(row);
  });
});
