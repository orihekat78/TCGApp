// use-restriction — next-hint ban (setNextHintBan / turnState.nextHintBanned) を実 engine 経路で駆動する挙動テスト。
// (engine拡張 wave use-restrict, 2026-06-30)。B06104/P・B09019/P・B09105/P「このターン中、自分はネクストヒントできない」。
// setEventUseBan (cluster6) の turn-scoped flag verb を mirror。eventUseBanned が event のみ・step2 のみ gate なのに対し、
// nextHintBanned は ネクストヒント全体 (step1 FILE→手札 含む) を canStartNextHint で不可にする (= 「ネクストヒントできない」)。
// rules: 12 (ネクストヒント) / 05 (メインフェイズ行動) / 15 (「〜できない」継続制限)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { run as runEffect } from '@/engine/effect/resolver';
import { canStartNextHint, runNextHint } from '@/engine/flow/main/next-hint';
import { flag } from '@/engine/mutate/flag';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import type { GameState, EffectCtx } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

function turnSelfMain(s: GameState): void {
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
}
function aiCtx(cardId: string, abilityId: string): EffectCtx {
  return { source: { player: 'self', cardId, uid: 'src', abilityId, area: 'hand' }, bindings: {} } as unknown as EffectCtx;
}

describe('use-restriction — next-hint ban (setNextHintBan / turnState.nextHintBanned)', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetCardDefRegistry();
  });

  it('canStartNextHint: ban 中は false (FILE があっても) / ban 無しは true', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.file = [FB, FB]; // 非アシスト FILE ≥ 1
    expect(canStartNextHint(s, 'self'), 'ban 無し + FILE ≥ 1 → 可').toBe(true);

    (s.turnState.self as { nextHintBanned?: boolean }).nextHintBanned = true;
    expect(canStartNextHint(s, 'self'), 'ban 中は FILE があっても不可').toBe(false);
  });

  it('per-player: 相手の ban は自分のネクストヒントに影響しない', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.file = [FB, FB];
    (s.turnState.opp as { nextHintBanned?: boolean }).nextHintBanned = true;
    expect(canStartNextHint(s, 'self'), '相手の ban は無関係').toBe(true);
  });

  it('setNextHintBan verb が flag をセット / 相手側は不変 / resetTurnFlags で解除', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    expect((s.turnState.self as { nextHintBanned?: boolean }).nextHintBanned ?? false, '初期は ban 無し').toBe(false);

    runEffect(s, { kind: 'atom', verb: 'setNextHintBan', args: { player: 'self' } } as never, aiCtx('B06104', 'a1'));
    expect((s.turnState.self as { nextHintBanned?: boolean }).nextHintBanned, 'verb 実行で ban=true').toBe(true);
    expect((s.turnState.opp as { nextHintBanned?: boolean }).nextHintBanned ?? false, '相手側は影響なし').toBe(false);

    flag.resetTurnFlags(s, 'self');
    expect((s.turnState.self as { nextHintBanned?: boolean }).nextHintBanned, 'resetTurnFlags で ban 解除').toBe(false);
  });

  it('runNextHint: ban 中は throw (canStartNextHint=false 経由)', () => {
    const s = createEmptyGameState();
    turnSelfMain(s);
    s.players.self.file = [FB, FB];
    (s.turnState.self as { nextHintBanned?: boolean }).nextHintBanned = true;
    expect(() => produce(s, (d) => { runNextHint(d, 'self'); }), 'ban 中の runNextHint は throw').toThrow(/not startable/);
  });
});
