// qa: card:PR099:2cca6007ab7f2137a43f145275f1d7dd6c33155f5c98d3179becb7d643a950fd
// Rules: 07-action-flow, 13-keywords, 15-abilities-effects, 16-card-set,
// 17-icons, 19-special-rules, 21-declared-ability-cost.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
import { evalCond } from '@/engine/cond/eval';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EffectCtx, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type Row = { cardId: 'PR099' | 'PR105' };
const ROWS: Row[] = [{ cardId: 'PR099' }, { cardId: 'PR105' }];
const SECRET = 'W77-SECRET';
const TAIL = 'W77-TAIL';
const FILE_CARD = 'W77-FILE';
const TARGET = 'W77-TARGET';
const EVIDENCE = 'W77-EVIDENCE';
const CASE = 'W77-CASE';
const ALLOWED_NAME = '毛利小五郎';
const EVENT_NAME = '黒の組織の事件';
const SPLIT_NAME = '江戸川コナン＆工藤新一';

function fixture(id: string, kind: CardDef['kind'], name: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind, names: [name], colors: ['白'], traits: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
    ...(kind === 'character' ? { level: 3, ap: 3000, lp: 1 } : {}),
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(SECRET, 'character', SECRET), fixture(TAIL, 'character', TAIL),
  fixture(FILE_CARD, 'character', FILE_CARD), fixture(TARGET, 'character', TARGET),
  fixture(EVIDENCE, 'character', EVIDENCE),
  fixture(CASE, 'case', CASE, { caseLevel: 7, caseTraits: [] }),
  fixture('ALLOWED', 'character', ALLOWED_NAME),
  fixture('MOURI_KOGORO', 'character', '毛利小五郎'),
  fixture('MOURI_RAN', 'character', '毛利蘭'),
  fixture('SPLIT', 'character', SPLIT_NAME, { names: [SPLIT_NAME, '江戸川コナン', '工藤新一'] }),
  fixture('EVENT', 'event', EVENT_NAME),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave77 state');
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function enterState(row: Row, owner: Player, deck: string[] = [SECRET, TAIL]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 11, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: CASE, colors: ['白'], status: '事件編',
  };
  state.players[owner].file = Array.from({ length: 7 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD,
  }));
  state.players[owner].hand = [row.cardId];
  state.players[owner].deck = [...deck];
  state.players[other(owner)].deck = [TAIL, TAIL, TAIL];
  state.players[other(owner)].case = {
    ...state.players[other(owner)].case, cardId: CASE, colors: ['白'], status: '事件編',
  };
  state.players[other(owner)].scene = [sceneChar(TARGET, `${other(owner)}-target`, { state: 'sleep' })];
  state.players[other(owner)].evidence = [{
    cardId: EVIDENCE, faceUp: false, origin: { turn: 1, via: 'effect' },
  }];
  return state;
}

function declaredState(row: Row, owner: Player): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 13, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].scene = [sceneChar(row.cardId, `${owner}-source`)];
  state.players[owner].deck = [TAIL, TAIL];
  state.players[other(owner)].deck = [TAIL, TAIL];
  return state;
}

function enterPublicly(row: Row, owner: Player): string {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: row.cardId }))
    .toEqual({ ok: true });
  const source = current().players[owner].scene.find(card => card.cardId === row.cardId);
  expect(source).toBeTruthy();
  return source!.uid;
}

function declareName(row: Row, owner: Player, name?: string) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: `${owner}-source`, abilId: 'a2',
    abilityOrigin: 'printed', abilityIndex: 1,
    ...(name === undefined ? {} : { costParams: { declaredName: name } }),
  });
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
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

// Card-bound physical sources: PR099 Wave77 target and PR105 matched control.
describe('official QA Wave77: PR099 optional name replacement stays public and bounded', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner publicly enters, sets one hidden card, and gains Assault[character]',
    ({ owner, ...row }) => {
      install(enterState(row, owner), `${row.cardId}:wave77-enter-${owner}`, owner);
      const uid = enterPublicly(row, owner);
      const source = current().players[owner].scene.find(card => card.uid === uid)!;
      expect(source.setCards).toEqual([expect.objectContaining({ cardId: SECRET, faceUp: false })]);
      expect(current().players[owner].deck).toEqual([TAIL]);
      expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(true);
      expect(JSON.stringify(current().log)).not.toContain(SECRET);
      expect(dispatchEngineAction({
        type: 'actionDeclareChar', byUid: uid, targetUid: `${other(owner)}-target`,
      })).toEqual({ ok: true });
    },
  );

  it.each(ROWS)('$cardId empty deck and remove causes deck-out before the later keyword grant', row => {
    install(enterState(row, 'self', []), `${row.cardId}:wave77-empty-deck`, 'self');
    const uid = enterPublicly(row, 'self');
    const source = current().players.self.scene.find(card => card.uid === uid)!;
    expect(source.setCards).toEqual([]);
    expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(false);
    expect(current().gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
  });

  it.each(ROWS)('$cardId legally exhausts its sole deck card into a hidden set before deck-out stops the keyword grant', row => {
    install(enterState(row, 'self', [SECRET]), `${row.cardId}:wave77-exact-deck-out`, 'self');
    const beforeOppEvidence = [...current().players.opp.evidence];
    const uid = enterPublicly(row, 'self');
    const source = current().players.self.scene.find(card => card.uid === uid)!;
    expect(source.setCards).toEqual([expect.objectContaining({ cardId: SECRET, faceUp: false })]);
    expect(current().players.self.deck).toEqual([]);
    expect(current().players.self.remove).toEqual([]);
    expect(current().refreshCount.self).toBe(0);
    expect(current().players.opp.evidence).toEqual(beforeOppEvidence);
    expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(false);
    expect(current().gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    expect(JSON.stringify(current().log)).not.toContain(SECRET);
  });
  // PR099 target and PR105 control public optional-name assertions.
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner publicly applies AP and a registered full name',
    ({ owner, ...row }) => {
      install(declaredState(row, owner), `${row.cardId}:wave77-name-${owner}`, owner);
      expect(declareName(row, owner, ALLOWED_NAME)).toEqual({ ok: true });
      expect(readChar.ap(current(), `${owner}-source`)).toBe(6000);
      expect(readChar.names(current(), `${owner}-source`)).toEqual([ALLOWED_NAME]);
      expect(readChar.declaredUseCount(current(), `${owner}-source`, 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toBe(1);
      expect(current().players[other(owner)].scene).toEqual([]);
    },
  );

  it.each(ROWS)('$cardId optional skip retains AP+1000 without a name override', row => {
    install(declaredState(row, 'self'), `${row.cardId}:wave77-skip`, 'self');
    expect(declareName(row, 'self')).toEqual({ ok: true });
    expect(readChar.ap(current(), 'self-source')).toBe(6000);
    expect(readChar.names(current(), 'self-source')).toEqual(['工藤有希子']);
    expect(current().players.self.scene[0]?.turnEffects.nameOverride).toBeUndefined();
  });

  it('PR099 canonicalizes a unique abbreviation through the public dispatcher', () => {
    const row: Row = { cardId: 'PR099' };
    install(declaredState(row, 'self'), 'PR099:wave77-abbreviation', 'self');
    expect(declareName(row, 'self', '  小五郎  ')).toEqual({ ok: true });
    expect(readChar.names(current(), 'self-source')).toEqual([ALLOWED_NAME]);
  });

  it.each([
    { label: 'event', invalidName: EVENT_NAME },
    { label: 'unregistered', invalidName: '未登録の名前' },
    { label: 'ambiguous', invalidName: '毛利' },
  ])(
    'PR099 rejects $label public name atomically',
    ({ label, invalidName }) => {
      const row: Row = { cardId: 'PR099' };
      install(declaredState(row, 'self'), `PR099:wave77-invalid-${label}`, 'self');
      const before = current();
      const beforeJson = JSON.stringify(before);
      expect(declareName(row, 'self', invalidName)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
      expect(JSON.stringify(current())).toBe(beforeJson);
      expect(readChar.ap(current(), 'self-source')).toBe(5000);
      expect(readChar.declaredUseCount(current(), 'self-source', 'a2', {
        abilityOrigin: 'printed', abilityIndex: 1,
      })).toBe(0);
    },
  );

  it('PR099 full split-name replacement supports components and excludes its printed name', () => {
    const row: Row = { cardId: 'PR099' };
    install(declaredState(row, 'self'), 'PR099:wave77-split', 'self');
    expect(declareName(row, 'self', SPLIT_NAME)).toEqual({ ok: true });
    expect(readChar.names(current(), 'self-source')).toEqual([SPLIT_NAME]);
    const ctx = {
      source: { player: 'self', cardId: row.cardId, uid: 'self-source', abilityId: 'a2', area: 'scene' },
      bindings: {},
    } as EffectCtx;
    expect(evalCond(current(), { kind: 'bond', cardName: '工藤新一' }, ctx)).toBe(true);
    expect(evalCond(current(), { kind: 'bond', cardName: '工藤有希子' }, ctx)).toBe(false);
  });

  it('PR099 public turn end removes AP, keyword, and name effects while preserving the hidden set', () => {
    const row: Row = { cardId: 'PR099' };
    install(enterState(row, 'self'), 'PR099:wave77-expiry', 'self');
    const uid = enterPublicly(row, 'self');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid, abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { declaredName: ALLOWED_NAME },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(readChar.ap(current(), uid)).toBe(5000);
    expect(readChar.names(current(), uid)).toEqual(['工藤有希子']);
    expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(false);
    expect(current().players.self.scene.find(card => card.uid === uid)?.setCards)
      .toEqual([expect.objectContaining({ cardId: SECRET, faceUp: false })]);
  });

  it('PR099 committed set, keyword, AP, and name survive save hydration before cleanup', () => {
    const row: Row = { cardId: 'PR099' };
    install(enterState(row, 'self'), 'PR099:wave77-save', 'self');
    const uid = enterPublicly(row, 'self');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid, abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { declaredName: ALLOWED_NAME },
    })).toEqual({ ok: true });
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expect(readChar.ap(current(), uid)).toBe(6000);
    expect(readChar.names(current(), uid)).toEqual([ALLOWED_NAME]);
    expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(true);
    expect(current().players.self.scene.find(card => card.uid === uid)?.setCards)
      .toEqual([expect.objectContaining({ cardId: SECRET, faceUp: false })]);
  });

  it('PR099 CPU declared path takes the optional skip and retains AP only', () => {
    const row: Row = { cardId: 'PR099' };
    const state = declaredState(row, 'opp');
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'declaredAbility' && candidate.uid === 'opp-source' && candidate.abilityId === 'a2'
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
    });
    expect(readChar.ap(after, 'opp-source')).toBe(6000);
    expect(readChar.names(after, 'opp-source')).toEqual(['工藤有希子']);
    expect(after.players.opp.scene[0]?.turnEffects.nameOverride).toBeUndefined();
  });
});
