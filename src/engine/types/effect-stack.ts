// EffectStackEntry 型定義
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 22-qa-action-contact.md, 25-qa-effects-resolution.md
//
// 設計メモ:
//   - GameState.pendingEffects は EffectStackEntry[] として管理する
//   - 単なる Effect ではなく、発火元・発火タイミング・状態を含むラッパー
//   - resolveGuard は解決時に再評価される ('〜の場合' / '〜してもよい' の対応)
//   - ownerChosenOrder は同所有者の全未解決効果間の解決順 (UI で選択)
//
// triggeredBy.hook は HookName | string union だが、カスタムトリガー (例:
// resolver 由来のサブ効果) を許容するため string で受ける。

import type { Effect, Condition } from './effect.js';
import type { CausalEffectTrace, EffectResolutionKind } from './effect-ctx.js';

export type EffectStackEntrySource = {
  uid?: string;
  cardId?: string;
  abilityId?: string;
  description?: string;
  player: 'self' | 'opp';
  /** Older saved entries have no area and are interpreted as scene sources. */
  area?: 'scene' | 'partner-area' | 'hand' | 'evidence' | 'file' | 'remove' | 'case';
  /** Explicit source-card lifecycle; preserved across the JSON stack boundary. */
  resolutionKind?: EffectResolutionKind;
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

/** @internal Engine-only continuation identity; never a card DSL descriptor. */
export type ReasoningContinuation = {
  token: number;
  uid: string;
  player: 'self' | 'opp';
};

export type EffectStackEntry = {
  id: string;
  source: EffectStackEntrySource;
  triggeredBy: EffectStackEntryTrigger;
  triggeredAt: EffectStackEntryTimestamp;
  effect: Effect;
  resolveGuard?: Condition;
  ownerChosenOrder?: number;
  /**
   * Entries created by one hook emission share this provenance id. Ordering
   * itself spans every unresolved effect owned by the priority player.
   */
  triggerBatch?: number;
  ownerOrderConfirmed?: boolean;
  /**
   * This entry resumes the effect that was already resolving before a human
   * decision paused it. It must finish before newly triggered unresolved
   * effects and is not part of the owner's unresolved-effect order choice.
   */
  resumesCurrentEffect?: boolean;
  /** @internal Reasoning continuation gated behind after-sleep reactions. */
  reasoningContinuation?: ReasoningContinuation;
  /** Human target pre-walk is deferred until this entry actually resolves. */
  deferredPicks?: boolean;
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
   * engine additive wave (2026-06-29d): queue 時点の ctx.costPaid を保持し entryToCtx で復元する。
   * bindings (BUG-082) と同型の queue-boundary 永続化。宣言能力の effect が conditional{if:costRemovedMatches}
   * を持つ場合、`if` は STABLE 扱い (conditionIfIsStable) で runtime resolver が再評価するが、entryToCtx は
   * 従来 costPaid を復元しなかったため再評価が常に false 化していた (cost 解決時にしか costPaid が無い)。
   * 本フィールドで cost の除去カード snapshot を runtime まで運ぶ。$cost.* dyn は pre-walk inline 済ゆえ非依存。
   * ⚠ 適用範囲: useDeclaredAbility (キャラ/事件の宣言能力) の effect のみ。partner-ability の effect:declared
   *   → triggered listener queue 経路は costPaid 未伝播 (現需要 0 — costRemovedMatches を要する 3 枚
   *   B03003/B04077/B06078 は全てキャラ宣言能力)。パートナー版が出た際は triggered.ts queue にも要伝播。
   */
  costPaid?: Record<string, unknown>;
  /**
   * BUG-171 (2026-07-04, step12 batch2): queue 時点の ctx.dyn を保持し entryToCtx で復元する。
   * costPaid (2026-06-29d) と同型の queue-boundary 永続化。宣言能力の declaredName 供給チャネル
   * (AbilityCostParams.declaredName → costParamsToDyn → ctx.dyn) は W6 step1 で設計されたが、
   * useDeclaredAbility → event.queue が dyn を entry に載せず、runtime の atomDeclareName /
   * resolveBindRef('$dyn.*') が常に未供給扱いになっていた (first-consumer B09108/B09003/PR105 の
   * probe が検出。W6 probe は runAtom 直駆動で queue 境界を踏んでいなかった)。
   */
  dyn?: Record<string, unknown>;
  /** Scoped hand-reveal cause restored only for this resumed entry. */
  publicHandRevealToken?: string;
  /** Public causal lineage restored when a paused decision resumes. */
  causalTrace?: CausalEffectTrace;
  /** Immediate parent effect root captured for a newly triggered effect. */
  causalCorrelationEventId?: string;
  /**
   * BUG-132 GAP-2 (2026-06-12): effect:declared の emit 1 回ごとの batch 連番。
   * 同一 emit で queue された entry 群 (イベント自効果 + 第三者反応) を結ぶ。
   * rules/15 §未解決 — 反応は「現在の行動 (自効果) 完了後」に解決するための gate キー。
   */
  declaredBatch?: number | string;
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
