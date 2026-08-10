// engine E3 (2026-07-02) — opponentLoses verb「相手はゲームに敗北する」(alt-lose 勝利ルート)
//
// P10/P53 family (B03135/B06105/B05118/B09107) の共通コア。パートナー【事件解決】固定ルートとは別に、
// カード効果から「相手はゲームに敗北する」で決着させる alt-lose verb。winner = 効果所有者 (args.player)。
//
// 検証 (engine-only、consumer カードは card phase):
//   §1 opponentLoses(player='self') → gameResult={winner:'self', reason:'alt-lose'} (相手 opp が敗北→self 勝者)。
//   §2 ★first-writer guard★ 既に gameResult がある場合は no-op (deck-out 等の先着結果を上書きしない)。
//   §3 player='opp' → winner='opp' (対称、resolvePlayer 経由)。
//   §4 ★additivity★ 既存 partnerSolveCase は reason:'evidence' で不変。
// rules: 01-victory-conditions.md (勝敗), 15-abilities-effects.md (即時解決「相手はゲームに敗北する」)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { startCausalSession } from '@/engine/log/causal';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { AtomVerb, EffectCtx } from '@/engine/types';

const ctx = (player: 'self' | 'opp' = 'self'): EffectCtx =>
  ({ source: { player, area: 'scene', cardId: 'TEST', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
});

describe('opponentLoses verb — alt-lose 勝利ルート (runAtom 直接駆動)', () => {
  it('§1 player=self → gameResult={winner:self, reason:alt-lose}', () => {
    const s0 = createEmptyGameState();
    const after = produce(s0, (d) => { runAtom(d, 'opponentLoses' as AtomVerb, { player: 'self' }, ctx('self')); });
    expect(after.gameResult).toEqual({ winner: 'self', reason: 'alt-lose' });
  });

  it('§2 first-writer guard: 既存 gameResult は上書きしない', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.gameResult = { winner: 'opp', reason: 'deck-out' };
    });
    const after = produce(s0, (d) => { runAtom(d, 'opponentLoses' as AtomVerb, { player: 'self' }, ctx('self')); });
    expect(after.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' }); // 不変
  });

  it('§3 winner = resolvePlayer(args.player, ctx) (対称、絶対解決)', () => {
    // source=self, args.player='opp' → resolvePlayer で絶対 opp。winner が args.player で駆動されることを確認。
    const s0 = createEmptyGameState();
    const after = produce(s0, (d) => { runAtom(d, 'opponentLoses' as AtomVerb, { player: 'opp' }, ctx('self')); });
    expect(after.gameResult).toEqual({ winner: 'opp', reason: 'alt-lose' });
  });

  it('§4 additivity: 既存 partnerSolveCase は reason:evidence で不変', () => {
    const s0 = createEmptyGameState();
    const after = produce(s0, (d) => { runAtom(d, 'partnerSolveCase', { player: 'self' }, ctx('self')); });
    expect(after.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
  });

  it('effect summary precedes the terminal causal event', () => {
    const s0 = createEmptyGameState();
    startCausalSession(s0, 'alt-lose-order');

    const after = produce(s0, (d) => {
      runAtom(d, 'opponentLoses' as AtomVerb, { player: 'self' }, ctx('self'));
    });

    expect(after.log.map((entry) => ('kind' in entry ? entry.kind : 'legacy'))).toEqual([
      'summary',
      'game-result',
    ]);
  });
});
