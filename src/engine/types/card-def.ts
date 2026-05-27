// CardDef 型定義
// rules: 02-deck-construction.md, 06-card-types.md, 13-keywords.md, 19-special-rules.md
// spec: .claude/specs/engine-api-card-shape.md, engine-api-card-abilities.md

import type { GameState, SceneCharacter } from './game-state.js';
import type { Effect, Condition, Cost } from './effect.js';
import type { HookName } from './hooks.js';

// ---------- AbilityType ----------
// rules: 15-abilities-effects.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md

export type AbilityType =
  | 'continuous'      // 「〜の場合 〜限り、AP+X」 常時有効 (rules/24, 25)
  | 'triggered'       // 「〜したとき」 条件発動
  | 'declared'        // 【宣言】 宣言能力 (rules/21)
  | 'icon-cutin'      // カットイン (rules/09)
  | 'icon-disguise'   // 変装 (rules/09)
  | 'icon-misread';   // ミスリード (rules/13) — Phase 8 完全クローズ Commit 3b 追加
  // 2026-05-27 Option C: 'icon-flash' 廃止。ヒラメキは type:'triggered' + trigger:{hook:'evidence:remove-by-action', optional:true}
  // に統合 (src/engine/listeners/triggered.ts handleEvidenceRemovedHook が処理)。

// ---------- AbilityScope ----------

export type AbilityScope =
  | 'on-scene'           // 現場にいる間 (デフォルト)
  | 'on-partner-area'    // パートナーエリアでも (MR系 rules/18)
  | 'on-hand'            // 手札時 (例: 一部カットイン)
  | 'on-evidence'        // 証拠時 (ヒラメキ rules/10)
  | 'always';            // どこでも (デバッグ用)

// ---------- AbilityLimit ----------
// rules: 17-icons.md §【ターン①/②】, 24-qa-naming-stun.md

export type AbilityLimit =
  | { kind: 'turn'; n: 1 | 2 }
  | { kind: 'game'; n: number }
  | null;

// ---------- TriggerDef ----------
// rules: 15-abilities-effects.md, 22-qa-action-contact.md

export type TriggerDef = {
  hook: HookName;
  matcher?: (payload: unknown, state: GameState) => boolean;
  /**
   * matcher の declarative 版 (D11007 a3 等で payload 依存判定を inline 関数ではなく
   * Condition kind で表現するため)。listener は matcher / matcherCondition のどちらか
   * (あれば両方) を評価し、false なら trigger を skip する。
   * payload は ctx.triggerPayload に詰めて evalCond に渡す経路。
   */
  matcherCondition?: Condition;
  selfOnly?: boolean;                      // 自分のキャラに対する発火のみ
  ignoreCostInduced?: boolean;             // viaCost: true を無視 (rules/21, 25)
  /**
   * 2026-05-27 (Option C migration): 任意発動。true なら listener は effect を直接 queue せず、
   * pendingHirameki side-channel に push してプレイヤーの fire/skip 選択を待つ (rules/10 §ヒラメキ)。
   * 主に hook='evidence:remove-by-action' (ヒラメキ) で使用。false / 未指定なら従来の
   * 強制発動 (rules/15 §必須効果)。
   */
  optional?: boolean;
};

// ---------- ContinuousModifier ----------
// G23: 常時有効型の selector 計算
// engine.read.char.ap/lp/keywords 等が selector 経由で動的に合算する

export type ContinuousModifier = {
  apDelta?: (s: GameState, ctx: { uid: string }) => number;
  lpDelta?: (s: GameState, ctx: { uid: string }) => number;
  grantKeywords?: (s: GameState, ctx: { uid: string }) => string[];
  customSelectorPatch?: (s: GameState, uid: string, base: SceneCharacter) => Partial<SceneCharacter>;
};

// ---------- AbilityDef ----------
// spec: engine-api-card-abilities.md

export type AbilityDef = {
  id: string;                              // カード内一意 ("a1", "a2")
  name?: string;                           // 表示名
  type: AbilityType;                       // 6種
  condition?: Condition;                   // 条件アイコン (rules/17)
  cost?: Cost;                             // 宣言能力時のみ (rules/21)
  trigger?: TriggerDef;                    // type='triggered' 時
  scope?: AbilityScope;                    // 「いつ有効か」
  limit?: AbilityLimit;                    // 【ターン①】等
  effect?: Effect;                         // Descriptor (DSL) — continuous 以外
  continuousModifier?: ContinuousModifier; // type='continuous' 時のみ (G23)
  description: string;                     // 公式テキスト (エラッタ後)
  ruleRefs?: string[];
};

// ---------- CardDef ----------
// 単一型として保持 (kind 判別子で識別)。
// kind 別の必須フィールド整合は engine.cards.validate で検証する。

export type CardDef = {
  id: string;                              // 例: "B08004" / "D08003"
  no: string;                              // 例: "0001/B08004"
  kind: 'character' | 'event' | 'partner' | 'case';
  names: string[];                         // 複数名カードは複数 (rules/19)
  colors: string[];                        // 1〜2色 (rules/20)
  level?: number;                          // event/character (パートナー除く)
  ap?: number;                             // character のみ
  lp?: number;                             // character/partner
  traits: string[];                        // 特徴 (例: [警察], [少年探偵団])
  rarity: string;                          // R/SR/MR/PR ...
  isMR?: boolean;                          // MR フラグ (rules/18)
  flavor?: string;
  imageUrl: string;                        // ローカル運用 (rules: 法務スタンス)
  abilities: AbilityDef[];                 // 能力定義 (Phase 5 で TSV+merge)
  ruleRefs: string[];                      // 例: ["rules/11-reasoning.md §LP≤0"]

  // kind-specific optional fields
  caseLevel?: number;                      // kind:'case' — 事件レベル (rules/01)
  caseTraits?: string[];                   // kind:'case' — 例: ["古城", "婚活"]
  keywords?: string[];                     // kind:'character' — 迅速/突撃[X]等 (rules/13)
};
