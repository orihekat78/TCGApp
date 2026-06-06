// engine-extension event→evidence batch (2026-06-06 タスクC) — 実カード経由 sanity test
//
// 検証: 「このカードを表向きのまま証拠として得る」イベント (selfToEvidence verb)。
//   handUseCard でイベント使用 → effect:declared listener が effect を queue →
//   runAllUntilEmpty で selfToEvidence が当該カードを remove→evidence (表向き) へ移す。
//   - B04015 (青) を代表に full path 検証 + 5 色全カードの verb 配線を構造検証。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { B04015 } from '@/cards/ct-p04/B04015';
import { B04028 } from '@/cards/ct-p04/B04028';
import { B04041 } from '@/cards/ct-p04/B04041';
import { B04062 } from '@/cards/ct-p04/B04062';
import { B04086 } from '@/cards/ct-p04/B04086';
import type { GameState } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

describe('engine-extension event→evidence batch (2026-06-06)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('card defs: selfToEvidence verb / event kind / 全5色', () => {
    for (const c of [B04015, B04028, B04041, B04062, B04086]) {
      expect(c.kind).toBe('event');
      const a1 = c.abilities[0];
      expect(a1.trigger).toMatchObject({ hook: 'effect:declared', selfOnly: true });
      expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'selfToEvidence' });
    }
    expect([B04015, B04028, B04041, B04062, B04086].map((c) => c.colors[0])).toEqual(['青', '緑', '白', '赤', '黄']);
  });

  it('B04015: イベント使用 → 自身が表向きで証拠エリアへ (remove 経由しない最終状態)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B04015'];
    s.players.self.case.colors = ['青']; // B04015=青 (色制限 rules/20)
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7 (handUseCard 可)
    s.players.self.evidence = [];
    s.players.self.remove = [];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04015');
      runAllUntilEmpty(d);
    });
    // 証拠に表向きで追加
    const ev = s.players.self.evidence.find((e) => e.cardId === 'B04015');
    expect(ev, 'B04015 が証拠エリアに').toBeTruthy();
    expect(ev?.faceUp, '表向き').toBe(true);
    expect(s.players.self.evidence.length, '証拠 +1').toBe(1);
    // 手札・リムーブには残らない
    expect(s.players.self.hand, '手札から消費').not.toContain('B04015');
    expect(s.players.self.remove, 'リムーブには残らない (remove→evidence)').not.toContain('B04015');
  });

  it('B04086 (黄): 同型で証拠化 (色制限を黄事件で通す)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B04086'];
    s.players.self.case.colors = ['黄'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    s.players.self.evidence = [];
    s.players.self.remove = [];
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04086');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.evidence.map((e) => e.cardId)).toContain('B04086');
    expect(s.players.self.remove).not.toContain('B04086');
  });

  it('既存リムーブに同 cardId があっても二重計上しない (lastIndexOf で1枚のみ移動)', () => {
    // 先に B04015 が remove に 1 枚ある状態で、別の B04015 を使用 → evidence +1, remove は元の1枚維持。
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B04015'];
    s.players.self.case.colors = ['青'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB];
    s.players.self.evidence = [];
    s.players.self.remove = ['B04015']; // 既存の使用済 1 枚
    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04015');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.evidence.filter((e) => e.cardId === 'B04015').length, '証拠は新規1枚のみ').toBe(1);
    expect(s.players.self.remove.filter((id) => id === 'B04015').length, 'remove は既存1枚維持').toBe(1);
  });
});
