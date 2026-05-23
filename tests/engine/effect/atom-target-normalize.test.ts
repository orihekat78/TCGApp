// BUG-074: evidenceToHand / handAddFromRemove の target が BUG-065 array 化と不整合で
// silent skip していた問題を修正。string / array / 未解決 (pick query object) の 3 形式に
// 対応していることを assert。

import { describe, it, expect, beforeEach } from 'vitest';
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

// BUG-076: tryRePickFromAtom が awaiting-pick 時に side-channel を再 set することの verify
describe('BUG-076: tryRePickFromAtom 経由で連続 pick (sequence の step 2 → step 3 modal flow)', () => {
  beforeEach(() => {
    (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide = null;
  });

  it('evidenceToHand で awaiting-pick 時、有効な query があれば side-channel が set される', () => {
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'init' } });
    s.players.self.evidence.push({ cardId: 'Y', faceUp: false, origin: { turn: 0, via: 'init' } });
    runAtom(
      s,
      'evidenceToHand',
      {
        player: 'self',
        target: {
          kind: 'pick',
          query: { area: 'evidence', side: 'self' },
          n: { min: 1, max: 1 },
        },
      },
      ctxSelf(),
    );
    // side-channel が set されている
    const side = (globalThis as { __pendingEffectPickSide?: { atomVerb: string; candidates: { cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(side).toBeTruthy();
    expect(side?.atomVerb).toBe('evidenceToHand');
    expect(side?.candidates.map((c) => c.cardId).sort()).toEqual(['X', 'Y']);
    // log entry は awaiting-pick
    expect(s.log[s.log.length - 1]?.action).toBe('effect:evidenceToHand:awaiting-pick');
  });

  it('side-channel が既に set 済みなら、tryRePickFromAtom は上書きしない (BUG-075 不変)', () => {
    // 既存 side-channel を set 状態にする
    (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide = {
      player: 'self',
      candidates: [{ uid: 'OLD-uid', cardId: 'OLD', player: 'self' }],
      atomVerb: 'discard',
      atomArgs: {},
      nMin: 1,
      nMax: 1,
      source: { cardId: '', abilityId: '' },
    };
    const s = createEmptyGameState();
    s.players.self.evidence.push({ cardId: 'X', faceUp: false, origin: { turn: 0, via: 'init' } });
    runAtom(
      s,
      'evidenceToHand',
      {
        player: 'self',
        target: {
          kind: 'pick',
          query: { area: 'evidence', side: 'self' },
          n: { min: 1, max: 1 },
        },
      },
      ctxSelf(),
    );
    // 既存 side-channel が上書きされていない
    const side = (globalThis as { __pendingEffectPickSide?: { atomVerb: string; candidates: { cardId: string }[] } | null }).__pendingEffectPickSide;
    expect(side?.atomVerb).toBe('discard');
    expect(side?.candidates[0]?.cardId).toBe('OLD');
  });
});
