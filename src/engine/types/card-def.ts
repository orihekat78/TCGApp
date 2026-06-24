// CardDef 型定義
// rules: 02-deck-construction.md, 06-card-types.md, 13-keywords.md, 19-special-rules.md
// spec: .claude/specs/engine-api-card-shape.md, engine-api-card-abilities.md

import type { GameState, SceneCharacter } from './game-state.js';
import type { Effect, Condition, Cost, TargetFilter } from './effect.js';
import type { HookName } from './hooks.js';

// ---------- AbilityType ----------
// rules: 15-abilities-effects.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md

export type AbilityType =
  | 'continuous'      // 「〜の場合 〜限り、AP+X」 常時有効 (rules/24, 25)
  | 'triggered'       // 「〜したとき」 条件発動
  | 'declared'        // 【宣言】 宣言能力 (rules/21)
  | 'icon-disguise'   // 変装 (rules/09)
  | 'icon-misread';   // ミスリード (rules/13) — Phase 8 完全クローズ Commit 3b 追加
  // 2026-05-27 Option C: 'icon-flash' 廃止。ヒラメキは type:'triggered' + trigger:{hook:'evidence:remove-by-action', optional:true}
  // に統合 (src/engine/listeners/triggered.ts handleEvidenceRemovedHook が処理)。
  // 2026-05-27 Option C: 'icon-cutin' 廃止。カットインは type:'triggered' + scope:'on-hand'
  // + trigger:{hook:'effect:declared', optional:true} に統合 (flow.contact.cutIn() が
  // emit→discard 順で発火し、triggered listener が hand-area scope で effect を queue)。

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
  /**
   * 2026-06-06 タスクC: 追加 hook (multi-hook trigger)。`hook` に加えてここに列挙した hook の
   * いずれでも発火する。limit:{kind:'turn'} は ability.id 単位の declaredUseCount で数えるため、
   * 複数 hook を跨いだ **共有【ターンN】** が自動的に成立する (例: D03007「推理かアクションしたとき」
   * 【ターン1】= reasoning:end と action:declare のどちらか 1 回)。selfOnly / matcherCondition は
   * 全 hook に共通適用される (action:declare payload も uid/player を持つよう拡張済)。
   */
  hooks?: HookName[];
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

// 常時有効型の AP/LP 修正値 (rules/24 §常時有効型: read 時に毎回再計算)。
// dyn 式 {dyn:'...'} (宣言形・推奨) / 定数 / closure (後方互換・最終手段) の3形を許容。
// engine.read.char.ap/lp が走査・合算する (grantKeywords と同じ continuous 経路)。
export type ContinuousDelta =
  | number
  | { dyn: string }
  | ((s: GameState, ctx: { uid: string }) => number);

export type ContinuousModifier = {
  apDelta?: ContinuousDelta;
  lpDelta?: ContinuousDelta;
  // engine additive wave (2026-06-24): 条件付き継続レベル修正 (「【自分ターン中】レベル+1」B08059 /
  // 「【解決編】レベル+3」B08050)。apDelta/lpDelta と完全対称に read.char.level +
  // candidates.matchOneFilter の2 site が continuousDelta(which:'lvlDelta') で honor する
  // (BUG-117: filter-level==combat-level)。不在時 +0 (既存カードは未宣言 → 回帰0)。
  // self-only (aura 版 lvlDeltaAura は未導入 = YAGNI、対象カードは全て self-buff)。
  lvlDelta?: ContinuousDelta;
  grantKeywords?: (s: GameState, ctx: { uid: string }) => string[];
  customSelectorPatch?: (s: GameState, uid: string, base: SceneCharacter) => Partial<SceneCharacter>;
  // engine拡張 wave#2 cluster5 (2026-06-14): 相手への使用制限 aura (rules/09 §カットイン/変装, rules/24 §常時有効型)。
  //   'cutin'          = 「相手は【カットイン】を使用できない」(B02063/B04034/B09017)。
  //                      flow.contact.canCutIn が cut-in する側の相手盤面を read.char.restrictsOpponent で走査。
  //   'disguiseTrigger'= 「相手のキャラの【変装時】は発動しない」(B04034)。
  //                      flow.contact.disguise が disguise:into emit を抑止 (変装 swap 自体は成立)。
  // ability.condition と併用し条件成立中のみ aura 有効。不在時 no-op (既存カードは未宣言 → restrictsOpponent=false)。
  opponentRestrict?: ('cutin' | 'disguiseTrigger')[];
  // engine拡張 wave#2 cluster13 (2026-06-15): 他キャラへの AP/LP buff aura (rules/15, 17 §【自分ターン中】, 24 §常時有効型)。
  // 「【自分ターン中】自分の現場にいる [auraFilter] のキャラを AP±N」型。bearer の **同一 side の現場**の各キャラに対し、
  //   auraFilter (matchOneFilter で 有効値=turnEffects 反映レベル を判定) が一致すれば apDeltaAura/lpDeltaAura を加算する。
  //   auraExcludeSelf=true で「このキャラ以外」(bearer 自身を除外)。ability.condition (【自分ターン中】等) 成立中のみ有効。
  // engine.read.char.ap/lp + candidates.matchOneFilter が auraDeltaSafe (再帰 guard 経由) で合算する
  //   (filter-AP と combat-AP を一致させる — BUG-117 原則)。不在時 no-op (既存カードは未宣言 → auraDelta=0、smoke baseline 不変)。
  apDeltaAura?: number;
  lpDeltaAura?: number;
  auraFilter?: TargetFilter;
  auraExcludeSelf?: boolean;
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
