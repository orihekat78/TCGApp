// EffectStackEntry 型定義
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 22-qa-action-contact.md, 25-qa-effects-resolution.md
//
// 設計メモ:
//   - GameState.pendingEffects は EffectStackEntry[] として管理する
//   - 単なる Effect ではなく、発火元・発火タイミング・状態を含むラッパー
//   - resolveGuard は解決時に再評価される ('〜の場合' / '〜してもよい' の対応)
//   - ownerChosenOrder は同タイミング・同所有者間の解決順 (UI で選択)
//
// triggeredBy.hook は HookName | string union だが、カスタムトリガー (例:
// resolver 由来のサブ効果) を許容するため string で受ける。

import type { Effect, Condition } from './effect.js';

export type EffectStackEntrySource = {
  uid?: string;
  cardId?: string;
  player: 'self' | 'opp';
};

export type EffectStackEntryTrigger = {
  hook: string;
  payload?: unknown;
};

export type EffectStackEntryTimestamp = {
  turn: number;
  phase: string;
  nano: number;
};

export type EffectStackEntryState = 'pending' | 'resolving' | 'resolved' | 'cancelled';

export type EffectStackEntry = {
  id: string;
  source: EffectStackEntrySource;
  triggeredBy: EffectStackEntryTrigger;
  triggeredAt: EffectStackEntryTimestamp;
  effect: Effect;
  resolveGuard?: Condition;
  ownerChosenOrder?: number;
  state: EffectStackEntryState;
  /**
   * 2026-05-27 (Option C follow-up): queue 時点の bindings を保持。
   * resolveBindRef は `$<key>.<field>` を ctx.bindings から解決するが、ctx は
   * runAllUntilEmpty 時に entry から再構築されるため、queue 時の bindings が
   * 失われる。本フィールドで entry に永続化し entryToCtx で復元する。
   *
   * 主な利用箇所: カットイン (`$contact.byUid` 等)。flow.contact.cutIn() が emit する
   * source.bindings を triggered listener が拾い、本フィールド経由で effect 実行時に
   * 復元する。
   */
  bindings?: Record<string, unknown[]>;
};
