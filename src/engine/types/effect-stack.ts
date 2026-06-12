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
  /**
   * BUG-132 GAP-2 (2026-06-12): effect:declared の emit 1 回ごとの batch 連番。
   * 同一 emit で queue された entry 群 (イベント自効果 + 第三者反応) を結ぶ。
   * rules/15 §未解決 — 反応は「現在の行動 (自効果) 完了後」に解決するための gate キー。
   */
  declaredBatch?: number;
  /**
   * BUG-132 GAP-2: 第三者反応マーカー (own = trigger.selfOnly===true 以外に付与)。
   * - stack.next(): 同 batch の own entry が pending の間は選択不可 (pairwise gate。
   *   他 entry との所有者任意順 rules/15 §未解決 は不変 — 敵対レビュー rules lens 反映)
   * - stack.runOne(): pick/dyn 候補を解決時に substitute (rules/15 §解決時参照。
   *   queue 時確定だとイベント解決前盤面で候補が固定される — B07016/B08020 a2 公式Q&A)
   * abilityId は遅延 substitute の resolveCtx 再構築用。
   */
  declaredReaction?: { abilityId: string };
};
