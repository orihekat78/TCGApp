// BUG-074: evidenceToHand / handAddFromRemove の target が BUG-065 array 化と不整合で
// silent skip していた問題を修正。string / array / 未解決 (pick query object) の 3 形式に
// 対応していることを assert。

import { describe, it, expect, beforeEach } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { _clearPendingEffectPickQueue, _pushPendingEffectPickSideForTest, _peekPendingEffectPickQueueLength, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
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
    _clearPendingEffectPickQueue();
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

  it('BUG-078 queue 化後: side-channel に既存 entry があるとき tryRePickFromAtom は queue 末尾に push (旧 BUG-075 不変は queue 化で置換)', () => {
    // 既存 side-channel を queue に push しておく
    _pushPendingEffectPickSideForTest({
      player: 'self',
      candidates: [{ uid: 'OLD-uid', cardId: 'OLD', player: 'self' }],
      atomVerb: 'discard',
      atomArgs: {},
      nMin: 1,
      nMax: 1,
      source: { cardId: '', abilityId: '' },
    });
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
    // queue 化により BUG-075 の「上書きしない」不変は「末尾 push」に変わる
    expect(_peekPendingEffectPickQueueLength(), 'queue に 2 件 (既存 discard + 新規 evidenceToHand)').toBe(2);
    const head = _drainPendingEffectPickSide();
    expect(head?.atomVerb, 'queue 先頭は既存の discard (順序保証)').toBe('discard');
    expect(head?.candidates[0]?.cardId).toBe('OLD');
    const next = _drainPendingEffectPickSide();
    expect(next?.atomVerb, 'queue 末尾は新規 evidenceToHand').toBe('evidenceToHand');
    expect(next?.candidates[0]?.cardId).toBe('X');
  });
});
