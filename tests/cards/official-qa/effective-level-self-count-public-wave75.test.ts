// qa: card:PR270:04195ab037741d2c4584dcf9e92a0a91822cf9490ff78ec9c83f83e52282be4a
// Rules: 07-action-flow, 11-reasoning, 13-keywords, 15-abilities-effects,
// 17-icons, 19-special-rules.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove } from '@/ai/policy';
import { registerAll } from '@/cards';
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
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

type Row = { cardId: 'PR264' | 'PR270' };
const ROWS: Row[] = [{ cardId: 'PR264' }, { cardId: 'PR270' }];
const L7_A = 'W75-L7-A';
const L7_B = 'W75-L7-B';
const L7_C = 'W75-L7-C';
const L8 = 'W75-L8';
const TARGET = 'W75-TARGET';
const EVIDENCE = 'W75-EVIDENCE';
const FILE_CARD = 'W75-FILE';
const TAIL = 'W75-TAIL';
const CASE = 'W75-CASE';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  const kind = options.kind ?? 'character';
  return {
    id, no: id, kind, names: [id], colors: ['赤'], level: 3,
    ap: kind === 'character' ? 3000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

const FIXTURES: CardDef[] = [
  fixture(L7_A, { level: 7 }), fixture(L7_B, { level: 7 }), fixture(L7_C, { level: 7 }),
  fixture(L8, { level: 8 }), fixture(TARGET, { level: 3 }), fixture(EVIDENCE),
  fixture(FILE_CARD), fixture(TAIL), fixture(CASE, { kind: 'case', caseLevel: 7, caseTraits: [] }),
];

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave75 state');
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

function stateFor(
  row: Row,
  owner: Player,
  status: '事件編' | '解決編',
  levelIds: string[],
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 9, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case, cardId: CASE, colors: ['赤'], status,
  };
  state.players[owner].file = Array.from({ length: 5 }, () => ({
    type: 'card-back' as const, cardId: FILE_CARD,
  }));
  state.players[owner].hand = [row.cardId];
  state.players[owner].scene = levelIds.map((cardId, index) => sceneChar(cardId, `${owner}-level-${index}`));
  state.players[owner].deck = [TAIL, TAIL, TAIL];
  state.players[other(owner)].deck = [TAIL, TAIL, TAIL];
  state.players[other(owner)].case = {
    ...state.players[other(owner)].case, cardId: CASE, colors: ['赤'], status: '事件編',
  };
  state.players[other(owner)].scene = [sceneChar(TARGET, `${other(owner)}-target`, { state: 'sleep' })];
  state.players[other(owner)].evidence = [{
    cardId: EVIDENCE, faceUp: false, origin: { turn: 1, via: 'effect' },
  }];
  return state;
}

function enterPublicly(row: Row, owner: Player): string {
  expect(dispatchEngineAction({ type: 'handUseCard', player: owner, cardId: row.cardId }))
    .toEqual({ ok: true });
  const source = current().players[owner].scene.find(card => card.cardId === row.cardId);
  expect(source).toBeTruthy();
  return source!.uid;
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

// Card-bound physical sources: PR264 matched control and PR270 Wave75 target.
describe('official QA Wave75: resolved-case effective level includes the entering source', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ ...row, owner }))))(
    '$cardId owner $owner counts itself as the third effective level-7 character',
    ({ owner, ...row }) => {
      install(stateFor(row, owner, '解決編', [L7_A, L7_B]), `${row.cardId}:wave75-valid-${owner}`, owner);
      const uid = enterPublicly(row, owner);
      expect(readChar.level(current(), uid)).toBe(7);
      expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(true);
      expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(true);
      expect(current().players[other(owner)].scene).toEqual([
        expect.objectContaining({ cardId: TARGET, state: 'sleep' }),
      ]);
    },
  );

  it.each(ROWS)('$cardId does not grant at only two total effective level-7 characters', row => {
    install(stateFor(row, 'self', '解決編', [L7_A]), `${row.cardId}:wave75-two`, 'self');
    const uid = enterPublicly(row, 'self');
    expect(readChar.level(current(), uid)).toBe(7);
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(false);
  });

  it.each(ROWS)('$cardId excludes a level-8 decoy from the exact level-7 count', row => {
    install(stateFor(row, 'self', '解決編', [L7_A, L8]), `${row.cardId}:wave75-level8`, 'self');
    const uid = enterPublicly(row, 'self');
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(false);
  });

  it.each(ROWS)('$cardId in incident-side status needs three other level-7 characters', row => {
    install(stateFor(row, 'self', '事件編', [L7_A, L7_B]), `${row.cardId}:wave75-incident-two`, 'self');
    let uid = enterPublicly(row, 'self');
    expect(readChar.level(current(), uid)).toBe(5);
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(false);

    install(stateFor(row, 'self', '事件編', [L7_A, L7_B, L7_C]), `${row.cardId}:wave75-incident-three`, 'self');
    uid = enterPublicly(row, 'self');
    expect(readChar.level(current(), uid)).toBe(5);
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(true);
  });

  it.each(ROWS)('$cardId ignores three opponent level-7 characters for its owner-relative gate', row => {
    const state = stateFor(row, 'self', '解決編', [L7_A]);
    state.players.opp.scene = [
      sceneChar(L7_A, 'opp-level-a'), sceneChar(L7_B, 'opp-level-b'), sceneChar(L7_C, 'opp-level-c'),
    ];
    install(state, `${row.cardId}:wave75-opponent-decoy`, 'self');
    const uid = enterPublicly(row, 'self');
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(false);
  });

  it('PR270 keeps printed Assault[character] but loses granted Assault[incident] at turn end', () => {
    const row: Row = { cardId: 'PR270' };
    install(stateFor(row, 'self', '解決編', [L7_A, L7_B]), 'PR270:wave75-expiry', 'self');
    const uid = enterPublicly(row, 'self');
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(readChar.level(current(), uid)).toBe(7);
    expect(readChar.hasKeyword(current(), uid, '突撃[キャラ]')).toBe(true);
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(false);
  });

  it('PR270 granted Assault[incident] makes its named source publicly case-actionable', () => {
    const row: Row = { cardId: 'PR270' };
    install(stateFor(row, 'self', '解決編', [L7_A, L7_B]), 'PR270:wave75-case-action', 'self');
    const uid = enterPublicly(row, 'self');
    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: uid, targetPlayer: 'opp',
    })).toEqual({ ok: true });
  });

  it('PR270 without Assault[incident] rejects a case action but permits a character action', () => {
    const row: Row = { cardId: 'PR270' };
    install(stateFor(row, 'self', '解決編', [L7_A]), 'PR270:wave75-no-case-action', 'self');
    let uid = enterPublicly(row, 'self');
    expect(dispatchEngineAction({
      type: 'actionDeclareCase', byUid: uid, targetPlayer: 'opp',
    })).toEqual({ ok: false, reason: 'not-allowed' });

    install(stateFor(row, 'self', '解決編', [L7_A]), 'PR270:wave75-char-action', 'self');
    uid = enterPublicly(row, 'self');
    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: uid, targetUid: 'opp-target',
    })).toEqual({ ok: true });
  });

  it('PR270 CPU owner enters through its hand-use move and resolves self-count', () => {
    const row: Row = { cardId: 'PR270' };
    const state = stateFor(row, 'opp', '解決編', [L7_A, L7_B]);
    const move = enumerateMoves(state, 'opp').find(candidate => (
      candidate.kind === 'handUseCard' && candidate.cardId === row.cardId
    ));
    expect(move).toBeTruthy();
    const after = produce(state, draft => {
      applyMove(draft, move!, 'opp');
      runAllUntilEmpty(draft);
    });
    const source = after.players.opp.scene.find(card => card.cardId === row.cardId)!;
    expect(source).toBeTruthy();
    expect(readChar.level(after, source.uid)).toBe(7);
    expect(readChar.hasKeyword(after, source.uid, '突撃[事件]')).toBe(true);
    expect(after.players.self.scene).toEqual([
      expect.objectContaining({ cardId: TARGET, state: 'sleep' }),
    ]);
  });

  it('PR270 does not gain Assault[incident] merely because its case later becomes resolved', () => {
    const row: Row = { cardId: 'PR270' };
    install(stateFor(row, 'self', '事件編', [L7_A, L7_B]), 'PR270:wave75-enter-only', 'self');
    const uid = enterPublicly(row, 'self');
    const next = structuredClone(current()) as GameState;
    next.players.self.case.status = '解決編';
    expect(useGameStateStore.getState().setGameState(next)).toBe(true);
    expect(readChar.level(current(), uid)).toBe(7);
    expect(readChar.hasKeyword(current(), uid, '突撃[事件]')).toBe(false);
  });
});
