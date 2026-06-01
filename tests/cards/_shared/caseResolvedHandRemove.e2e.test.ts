// BUG-089 e2e: 事件カードが解決編になったとき a1 (caseResolvedHandRemove) の discard が実際に発火するか
//
// rules: 01-victory-conditions.md (解決編移行), 15-abilities-effects.md (条件発動)
//
// 旧バグ: caseResolvedHandRemove は trigger.hook='case:to-resolved' を待つが、実プレイの解決編移行
//   (partnerAssist atom / FILE>=7 自動) は case.status を直接代入し case:to-resolved hook を emit
//   していなかった (hook を出すのは未使用の caseToResolved atom のみ)。→ a1 が永遠に発火しなかった。
//   既存 unit test は descriptor のシェイプしか見ていないため検出できなかった。

import { describe, it, expect, beforeAll } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { file as fileMutate } from '@/engine/mutate/file';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'case' }, bindings: {} };
}

describe('case:to-resolved trigger e2e — 解決編移行で a1 の discard が発火する', () => {
  beforeAll(() => {
    registerAll();
  });

  it('partnerAssist で FILE 7 → 解決編 → D08026 a1 の discard が pendingEffects に queue される', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    s.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    // FILE 6 枚 → partnerAssist で partner +1 = 7 → 解決編
    const fb = { type: 'card-back' as const, cardId: 'D08017' };
    s.players.self.file = [fb, fb, fb, fb, fb, fb];
    s.players.self.hand = ['D08017', 'D08017'];

    runAtom(s, 'partnerAssist', { player: 'self' }, ctxSelf());

    expect(s.players.self.case.status, 'FILE7 で解決編へ移行').toBe('解決編');
    const hasDiscard = s.pendingEffects.some((e) => JSON.stringify(e.effect).includes('"discard"'));
    expect(hasDiscard, '解決編移行で a1(caseResolvedHandRemove) の discard が queue される').toBe(true);
  });

  it('FILE>=7 自動移行 (addFromDeckTop) でも a1 の discard が発火する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'auto', isFirstPlayerFirstTurn: false };
    s.players.self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    s.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    const fb = { type: 'card-back' as const, cardId: 'D08017' };
    s.players.self.file = [fb, fb, fb, fb, fb, fb]; // 6
    s.players.self.deck = ['D08017', 'D08017', 'D08017'];
    s.players.self.hand = ['D08017'];

    // auto-phase の FILE 追加経由 (mutate.file.addFromDeckTop) で 6 → 8 → 解決編
    fileMutate.addFromDeckTop(s, 'self', 2);

    expect(s.players.self.case.status, 'FILE>=7 自動移行で解決編').toBe('解決編');
    const hasDiscard = s.pendingEffects.some((e) => JSON.stringify(e.effect).includes('"discard"'));
    expect(hasDiscard, 'FILE自動移行でも a1 の discard が queue される').toBe(true);
  });

  // matcher 正確性: 解決編移行は「そのカード所有者の a1」だけを発火させる (selfOnly)。
  function isDiscard(e: { effect: unknown }): boolean {
    return JSON.stringify(e.effect).includes('"discard"');
  }

  it('opp の事件が解決編 → opp の a1 discard が発火する (opp 帰属)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    s.players.opp.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    const fb = { type: 'card-back' as const, cardId: 'D08017' };
    s.players.opp.file = [fb, fb, fb, fb, fb, fb];
    s.players.opp.hand = ['D08017', 'D08017'];

    // partnerAssist の player は ctx.source.player 相対。opp を assist するには owner='opp' + a.player='self'。
    runAtom(s, 'partnerAssist', { player: 'self' }, { source: { player: 'opp', area: 'case' }, bindings: {} });

    expect(s.players.opp.case.status).toBe('解決編');
    const discards = s.pendingEffects.filter(isDiscard);
    expect(discards.length, 'opp の a1 discard が 1 件 queue').toBe(1);
    expect(discards[0]?.source.player, 'discard は opp 帰属').toBe('opp');
  });

  it('self の解決編で発火するのは self の a1 のみ (両者が事件カードを持っていても opp の a1 は発火しない)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
    s.players.opp.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 6, colors: ['黄'], declaredUseCount: {} };
    s.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
    const fb = { type: 'card-back' as const, cardId: 'D08017' };
    s.players.self.file = [fb, fb, fb, fb, fb, fb];
    s.players.self.hand = ['D08017', 'D08017'];

    runAtom(s, 'partnerAssist', { player: 'self' }, ctxSelf());

    expect(s.players.self.case.status).toBe('解決編');
    const discards = s.pendingEffects.filter(isDiscard);
    expect(discards.length, 'self の a1 のみ (opp の a1 は発火しない) → discard 1 件').toBe(1);
    expect(discards[0]?.source.player, 'discard は self 帰属').toBe('self');
  });
});
