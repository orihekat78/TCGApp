// engine additive (2026-06-29) — gainCard idx===-1 guard (B06026)
//
// 検証: 「このカードを表向きのまま証拠として得る」(selfToEvidence) の解決時、対象 cardId が
//   既にリムーブエリアを離れていた (idx===-1) 場合は証拠化しない (B06026 Q&A / rules/14)。
//   イベント自身経路 (handUseCard→remove→同期解決, idx!==-1) は挙動不変 = 別途
//   tests/cards/event-to-evidence-batch.test.ts が回帰担保する。

import { describe, it, expect } from 'vitest';
import { produce } from 'immer';
import { evidence } from '@/engine/mutate/evidence';
import { createEmptyGameState } from '@/engine/state-factory';
import type { EvidenceOrigin } from '@/engine/types';

const ORIGIN: EvidenceOrigin = { turn: 1, via: 'effect', sourceCardId: 'X' };

describe('mutate.evidence.gainCard idx===-1 guard (B06026)', () => {
  it('GATE: fromArea remove + source absent (idx===-1) → no evidence gain, remove unchanged', () => {
    const base = createEmptyGameState(); // self.remove = [] (source 不在)
    const next = produce(base, d => { evidence.gainCard(d, 'self', 'X', true, ORIGIN); });
    expect(next.players.self.evidence).toHaveLength(0); // 証拠化されない
    expect(next.players.self.remove).toEqual([]);       // remove も触らない
  });

  it('DECOY: fromArea remove + source present (idx!==-1) → gains + splices (proves gate is presence-conditioned, not blanket-suppress)', () => {
    let base = createEmptyGameState();
    base = { ...base, players: { ...base.players, self: { ...base.players.self, remove: ['A', 'X', 'B'] } } };
    const next = produce(base, d => { evidence.gainCard(d, 'self', 'X', true, ORIGIN); });
    expect(next.players.self.evidence).toHaveLength(1);
    expect(next.players.self.evidence[0]).toMatchObject({ cardId: 'X', faceUp: true });
    expect(next.players.self.remove).toEqual(['A', 'B']); // X spliced (most-recent occurrence)
  });

  it("HAND-PATH DECOY: fromArea 'none' + remove empty → STILL gains (guard must not leak into 'none' path)", () => {
    const base = createEmptyGameState();
    const next = produce(base, d => { evidence.gainCard(d, 'self', 'Y', false, ORIGIN, 'none'); });
    // false-green guard: an impl that returned early on idx===-1 OUTSIDE the fromArea block would fail here
    expect(next.players.self.evidence).toHaveLength(1);
    expect(next.players.self.evidence[0]).toMatchObject({ cardId: 'Y', faceUp: false });
  });
});
