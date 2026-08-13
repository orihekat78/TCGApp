// Task 8.4b: performGameStart integration test
//
// rules: 04-game-setup.md (初期化手順 / 先攻 1 ターン目 FILE=1 例外)

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { performGameStart } from '@/ui/services/gameStarter';
import { BUG_274_GAME_START_AUTHORITY } from '@/ui/services/gameStarter';
import { BUG_274_PARTNER } from '@/ui/fixtures/bug274PartnerFixture';
import { beginMatchSession, commitMatchSession, isCurrentLiveMatchSession, matchSessionId, resetMatchSession, retainMatchSessionCard } from '@/ui/services/matchSession';
import { createEmptyGameState } from '@/engine/state-factory';
import { useMulliganStore } from '@/ui/hooks/useMulligan';

function deferred(): { promise: Promise<void>; release: () => void } {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

beforeEach(() => {
  resetMatchSession();
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
});

// Round 2 改修: performGameStart は async (マリガン UI await)。
// テストでは mulliganProvider を skip 用 ([] を返す関数) に注入。
const skipMulligan = async (): Promise<ReadonlyArray<string>> => [];

describe('performGameStart', () => {
  it('does not start setup after terminal cleanup settles a pending mulligan', async () => {
    const session = beginMatchSession('self');
    const pending = performGameStart(undefined, undefined, {
      sessionId: matchSessionId(session),
      isSessionCurrent: () => isCurrentLiveMatchSession(session),
    });
    await Promise.resolve();
    expect(useMulliganStore.getState().current).not.toBeNull();
    const terminal = createEmptyGameState();
    terminal.gameResult = { winner: 'opp', reason: 'concede' };
    expect(commitMatchSession(session, terminal)).toBe(true);
    const started = await pending;
    expect(started.turn.phase).not.toBe('main');
    expect(commitMatchSession(session, started)).toBe(false);
    resetMatchSession();
  });
  it('returns turn-1 state: 先攻は手札 6 (5+auto draw)、後攻は手札 5', async () => {
    const s = await performGameStart(skipMulligan, undefined, { sessionId: 'starter-turn-1' });
    expect(s.turn.number).toBe(1);
    expect(['self', 'opp']).toContain(s.turn.player);
    const first = s.turn.player;
    const second = first === 'self' ? 'opp' : 'self';
    expect(s.players[first].hand.length).toBe(6); // 5 + auto-phase draw 1
    expect(s.players[second].hand.length).toBe(5);
  });

  it('先攻プレイヤーの FILE は 1 枚 (rules/04 例外、通常は 2 枚)', async () => {
    const s = await performGameStart(skipMulligan, undefined, { sessionId: 'starter-file' });
    const first = s.turn.player;
    expect(s.players[first].file.length).toBe(1);
  });

  it('Round 2: mulliganProvider 経由でカード戻し→引き直しが engine 側に反映される', async () => {
    // 両プレイヤーともマリガン権を消費する provider (空配列 = skip でも mulliganUsed=true)
    const provider = async (
      _player: 'self' | 'opp',
      _hand: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<string>> => [];
    const s = await performGameStart(provider, undefined, { sessionId: 'starter-mulligan' });
    // mulliganUsed フラグが両プレイヤー true (rules/04 §5 — 0枚返却も権利消費)
    expect(s.players.self.mulliganUsed).toBe(true);
    expect(s.players.opp.mulliganUsed).toBe(true);
  });

  it('starts the public BUG-274 validation deck with its multiple-ability partner', async () => {
    const s = await performGameStart(skipMulligan, {
      selfDeckId: 'TEST-BUG-274',
      oppDeckId: 'CT-D11',
    }, { sessionId: 'starter-bug-274', bug274Authority: BUG_274_GAME_START_AUTHORITY });

    expect(s.players.self.partner.cardId).toBe('TEST-BUG-274-PARTNER');
    expect(engine.cards.get('TEST-BUG-274-PARTNER')).toBeUndefined();
  });

  it('rejects a BUG-274 DeckId without the non-serializable fixture authority', async () => {
    await expect(performGameStart(skipMulligan, {
      selfDeckId: 'TEST-BUG-274', oppDeckId: 'CT-D11',
    }, { sessionId: 'starter-bug-274-forged' })).rejects.toThrow();
    expect(engine.cards.get('TEST-BUG-274-PARTNER')).toBeUndefined();
  });

  it('restores a prior registry entry when a fixture session is reset or replaced', () => {
    const prior = { ...BUG_274_PARTNER, names: ['prior card'] };
    engine.cards.register(prior);
    const first = beginMatchSession('self');
    expect(retainMatchSessionCard(first, BUG_274_PARTNER)).toBe(true);
    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(BUG_274_PARTNER);

    resetMatchSession();
    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(prior);

    const second = beginMatchSession('self');
    expect(retainMatchSessionCard(second, BUG_274_PARTNER)).toBe(true);
    beginMatchSession('self');
    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(prior);
  });

  it('does not reintroduce a stale setup overlay after its session has ended and a new one begins', async () => {
    const prior = { ...BUG_274_PARTNER, names: ['prior card'] };
    engine.cards.register(prior);
    const staleDone = deferred();
    const stale = engine.cards.withTemporary(BUG_274_PARTNER, async () => staleDone.promise);
    const first = beginMatchSession('self');
    expect(retainMatchSessionCard(first, BUG_274_PARTNER)).toBe(true);

    resetMatchSession();
    beginMatchSession('self');
    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(BUG_274_PARTNER);
    staleDone.release();
    await stale;

    expect(engine.cards.get(BUG_274_PARTNER.id)).toBe(prior);
  });

  it('initializes the caller-owned causal session before setup runs', async () => {
    const s = await performGameStart(skipMulligan, undefined, {
      sessionId: 'standalone-session-42',
    });

    expect(s.causalLog).toEqual({
      schemaVersion: 1,
      sessionId: 'standalone-session-42',
      nextSequence: 3,
    });
    expect(s.log.slice(0, 2)).toEqual([
      expect.objectContaining({ eventId: 'standalone-session-42:1', sequence: 1 }),
      expect.objectContaining({ eventId: 'standalone-session-42:2', sequence: 2 }),
    ]);
  });
});
