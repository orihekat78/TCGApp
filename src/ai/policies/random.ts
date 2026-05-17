// ai.policies.random — 候補からランダムに 1 手を選ぶ AIPolicy 実装 (Phase 6 Group B Task 6.3)
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
// rules: 05-turn-phases.md (メインフェイズ内のどの行動も合法ならば等確率で選ぶ)
//
// 設計メモ:
//   - seed 文字列を渡せば mulberry32 ベースで決定論的に再現可能
//   - rng 関数を直接渡すことも可能 (テスト用の任意 RNG を差し込める)
//   - 何も指定がない場合は Math.random を使う

import type { AIPolicy } from '../policy.js';
import type { Move } from '../move-enumerator.js';
import type { GameState } from '@/engine/types';
import { createRng } from '@/engine/rng';

type Player = 'self' | 'opp';

export interface RandomPolicyOptions {
  seed?: string;
  rng?: () => number;
}

export class RandomPolicy implements AIPolicy {
  readonly name = 'random';
  private readonly rng: () => number;

  constructor(opts?: RandomPolicyOptions) {
    if (opts?.rng) {
      this.rng = opts.rng;
    } else if (opts?.seed !== undefined) {
      const r = createRng(opts.seed);
      this.rng = () => r.next();
    } else {
      this.rng = Math.random;
    }
  }

  choose(_state: GameState, candidates: Move[], _byPlayer: Player): Move | null {
    if (candidates.length === 0) return null;
    const idx = Math.floor(this.rng() * candidates.length);
    // idx は [0, candidates.length) に収まるが、rng() が 1 を返す挙動を考慮して clamp
    const safeIdx = Math.min(idx, candidates.length - 1);
    return candidates[safeIdx];
  }

  /**
   * Phase 5 advance: ヒラメキ発動判定 (rules/10)。
   * RandomPolicy は 50/50 で fire/skip を選ぶ (1000戦 smoke での経路カバレッジ確保)。
   */
  chooseHiramekiTrigger(
    _state: GameState,
    _pending: { cardId: string; abilityId: string },
  ): boolean {
    return this.rng() < 0.5;
  }
}
