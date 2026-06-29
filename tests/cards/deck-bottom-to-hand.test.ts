// engine additive (2026-06-29) — handAddFromDeckBottom verb (B03051 怪盗キッド)
//
// 検証 (非MVP = smoke では踏めない → 実 engine 駆動の専用テスト):
//   §1 デッキ「下から」(末尾) 1枚を手札へ。上 (先頭) は取らない (DECOY: top-take 実装なら fail)。
//   §2 残1枚を取りデッキ0 → 即リフレッシュ (remove>0): opp 証拠+1 (penalty)、痕跡 発見済、deck 復元。
//   §3 残1枚 + remove0 → リフレッシュ失敗 → deck-out 敗北 (winner=opp)。
//   §4 事前0 + remove>0 → 先にリフレッシュしてから下から取得。
//   §5 ★additivity★ 既存 handAddFromDeck (上から/bind) は不変 (positional ではなく indexOf)。
// rules: 14-refresh.md, 26-qa-deck-refresh.md (B03051 Q&A 残1→手札→リフレッシュ)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { EffectCtx } from '@/engine/types';

const ctx = (): EffectCtx => ({ source: { player: 'self', area: 'scene', cardId: 'B03051', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
});

describe('handAddFromDeckBottom verb — runAtom 直接駆動', () => {
  it('§1 takes the BOTTOM (last) card, not the top — top order preserved', () => {
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['TOP', 'MID', 'BOT']; });
    const after = produce(s0, (d) => { runAtom(d, 'handAddFromDeckBottom', { player: 'self' }, ctx()); });
    expect(after.players.self.hand).toContain('BOT');          // 下から取得
    expect(after.players.self.hand).not.toContain('TOP');      // DECOY: top-take なら fail
    expect(after.players.self.deck).toEqual(['TOP', 'MID']);   // 残りの上順は不変
  });

  it('§2 single-card deck → take empties deck → immediate refresh (remove>0)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['ONLY'];
      d.players.self.remove = ['R1', 'R2'];
    });
    const after = produce(s0, (d) => { runAtom(d, 'handAddFromDeckBottom', { player: 'self' }, ctx()); });
    expect(after.players.self.hand).toContain('ONLY');
    expect(after.players.self.deck.length).toBe(2);            // R1,R2 reshuffled into deck
    expect(after.players.self.remove).toEqual([]);             // remove drained by refresh
    expect(after.players.opp.evidence.length).toBe(1);         // refresh penalty: opp +1 証拠
    expect(after.scratchTrace.opp).toBe('発見済');             // rules/13 痕跡
    expect(after.gameResult).toBeUndefined();                  // not a loss
  });

  it('§3 single-card deck + empty remove → refresh fails → deck-out loss (winner=opp)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = ['ONLY'];
      d.players.self.remove = [];
    });
    const after = produce(s0, (d) => { runAtom(d, 'handAddFromDeckBottom', { player: 'self' }, ctx()); });
    expect(after.players.self.hand).toContain('ONLY');         // 取得自体は成立
    expect(after.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
  });

  it('§4 pre-empty deck + remove≥2 → refresh first, then bottom-take leaves ≥1 (no double-refresh loss)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = [];
      d.players.self.remove = ['R1', 'R2'];
    });
    const after = produce(s0, (d) => { runAtom(d, 'handAddFromDeckBottom', { player: 'self' }, ctx()); });
    expect(after.players.self.hand.length).toBe(1);            // one reshuffled card taken
    expect(['R1', 'R2']).toContain(after.players.self.hand[0]); // (shuffle order non-deterministic)
    expect(after.players.self.deck.length).toBe(1);            // the other remains → no post-take refresh
    expect(after.gameResult).toBeUndefined();
  });

  it('§4b pre-empty deck with only 1 total card (remove=[R1]) → take then deck empties → deck-out (rules/14)', () => {
    // 防御エッジ: 山+リムーブ合計1枚は維持不能 → 取得後の即リフレッシュで敗北 (literal rules/14)
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.deck = [];
      d.players.self.remove = ['R1'];
    });
    const after = produce(s0, (d) => { runAtom(d, 'handAddFromDeckBottom', { player: 'self' }, ctx()); });
    expect(after.players.self.hand).toContain('R1');
    expect(after.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
  });

  it('§5 additivity: existing handAddFromDeck (top, bind/indexOf) is unchanged', () => {
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.deck = ['A', 'B']; });
    const after = produce(s0, (d) => { runAtom(d, 'handAddFromDeck', { player: 'self', cardId: 'B' }, ctx()); });
    expect(after.players.self.hand).toEqual(['B']);            // indexOf-removed, not positional
    expect(after.players.self.deck).toEqual(['A']);
  });
});
