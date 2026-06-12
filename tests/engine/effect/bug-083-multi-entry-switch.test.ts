// BUG-083 characterization: 効果で複数キャラを同時登場させ現場上限 (5) を超える場合の挙動。
//
// rules/20 §スイッチ 条件2: 「キャラを2枚以上同時に登場させる際に現場の上限を超える場合」スイッチ可。
//
// BUG-083 起票時 (2026-05-28) の実動作「2 体目 sceneEnter が mutate.scene.enter で throw」は、
// 2026-06-04 switch-on-effect-enter (atom-handlers sceneEnter の満杯ガード) で **解消済**:
//   - 満杯 + switchRemoveUid 無し → skip (rules/15「可能な限り」、AI/未指定経路)
//   - 満杯 + switchRemoveUid 有り → switchEnter (既存1枚退場 + 登場 = 条件2の結果に到達)
// よって multi-entry でも crash しない。専用の sceneMultiEnter (一括同時 switch) は該当カード0のため未実装。
//
// 本テストは「2 step sequence の sceneEnter で 4→5→(満杯)」が throw せず legal scene (≤5) を保つことと、
// overflow step に switchRemoveUid を与えれば switchEnter で条件2 の結果 (両方登場) が到達可能なことを固定する。

import { describe, it, expect, beforeAll } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { EffectCtx, GameState } from '@/engine/types';
import { sceneChar } from '../../helpers/fixtures';


function ctx(): EffectCtx {
  return { source: { player: 'self', cardId: 'D08001', uid: 'src', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
}

function resolveAndRun(effect: unknown, s: GameState): void {
  const c = ctx();
  const resolved = resolveEffectPicks(s, effect as never, c, {
    byPlayer: 'self', humanChooser: false, source: { cardId: 'D08001', abilityId: 'a1' },
  });
  runEffect(s, resolved as never, c);
}

describe('BUG-083: 複数同時登場で現場上限超過 (rules/20 条件2)', () => {
  beforeAll(() => registerAll());

  it('現場4枚 + 2体 sequence 登場 → throw せず scene ≤5 (overflow は switchRemoveUid 無しで skip)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = Array.from({ length: 4 }, (_, i) => sceneChar('D08005', `o${i}`));
    const effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'D08013', viaEffect: true } },
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'D08014', viaEffect: true } },
      ],
    };
    expect(() => resolveAndRun(effect, s)).not.toThrow();
    expect(s.players.self.scene.length, '上限を超えず 5 枚に収まる').toBe(5);
    const ids = s.players.self.scene.map((c) => c.cardId);
    expect(ids, '1 体目 (D08013) は登場').toContain('D08013');
    expect(ids, '2 体目 (D08014) は overflow で skip (switchRemoveUid 未指定)').not.toContain('D08014');
  });

  it('overflow step に switchRemoveUid を与えると switchEnter で条件2の結果 (両方登場) が到達可能', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = Array.from({ length: 4 }, (_, i) => sceneChar('D08005', `o${i}`));
    const effect = {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'D08013', viaEffect: true } },
        // 既存 o0 を退場させて 2 体目を登場 (switchEnter)
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'D08014', viaEffect: true, switchRemoveUid: 'o0' } },
      ],
    };
    expect(() => resolveAndRun(effect, s)).not.toThrow();
    expect(s.players.self.scene.length, 'switch で 5 枚維持').toBe(5);
    const ids = s.players.self.scene.map((c) => c.cardId);
    expect(ids, '1 体目 D08013 登場').toContain('D08013');
    expect(ids, '2 体目 D08014 も登場 (条件2 の結果)').toContain('D08014');
    expect(s.players.self.scene.some((c) => c.uid === 'o0'), '退場指定した o0 はリムーブされた').toBe(false);
  });
});
