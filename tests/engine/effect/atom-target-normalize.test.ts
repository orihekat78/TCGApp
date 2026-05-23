// BUG-074: evidenceToHand / handAddFromRemove の target が BUG-065 array 化と不整合で
// silent skip していた問題を修正。string / array / 未解決 (pick query object) の 3 形式に
// 対応していることを assert。

import { describe, it, expect } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import type { EffectCtx } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'scene' }, bindings: {} };
}

describe('BUG-074: evidenceToHand target normalize', () => {
  it('target が string (旧形式) → 証拠から手札へ移動', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'init' } });
    runAtom(s, 'evidenceToHand', { player: 'self', target: 'X' }, ctxSelf());
    expect(s.players.self.hand).toEqual(['X']);
    expect(s.players.self.evidence.length).toBe(0);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:evidenceToHand');
  });

  it('target が array (BUG-065 resolve-picks 経由) → 証拠から手札へ移動', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'init' } });
    runAtom(s, 'evidenceToHand', { player: 'self', target: ['X'] }, ctxSelf());
    expect(s.players.self.hand).toEqual(['X']);
    expect(s.players.self.evidence.length).toBe(0);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:evidenceToHand');
  });

  it('target が pick query object (未解決) → awaiting-pick log + skip', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'init' } });
    runAtom(s, 'evidenceToHand', { player: 'self', target: { kind: 'pick' } }, ctxSelf());
    expect(s.players.self.hand.length).toBe(0);
    expect(s.players.self.evidence.length).toBe(1);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:evidenceToHand:awaiting-pick');
  });
});

describe('BUG-074: handAddFromRemove target normalize', () => {
  it('target が string (旧形式) → リムーブから手札へ移動', () => {
    const s = createEmptyGameState();
    s.players.self.remove.push('Y');
    runAtom(s, 'handAddFromRemove', { player: 'self', target: 'Y' }, ctxSelf());
    expect(s.players.self.hand).toEqual(['Y']);
    expect(s.players.self.remove.length).toBe(0);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:handAddFromRemove');
  });

  it('target が array (BUG-065 resolve-picks 経由) → リムーブから手札へ移動', () => {
    const s = createEmptyGameState();
    s.players.self.remove.push('Y');
    runAtom(s, 'handAddFromRemove', { player: 'self', target: ['Y'] }, ctxSelf());
    expect(s.players.self.hand).toEqual(['Y']);
    expect(s.players.self.remove.length).toBe(0);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:handAddFromRemove');
  });

  it('target が pick query object (未解決) → awaiting-pick log + skip', () => {
    const s = createEmptyGameState();
    s.players.self.remove.push('Y');
    runAtom(s, 'handAddFromRemove', { player: 'self', target: { kind: 'pick' } }, ctxSelf());
    expect(s.players.self.hand.length).toBe(0);
    expect(s.players.self.remove.length).toBe(1);
    expect(s.log[s.log.length - 1]?.action).toBe('effect:handAddFromRemove:awaiting-pick');
  });
});
