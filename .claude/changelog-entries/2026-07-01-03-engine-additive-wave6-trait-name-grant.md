# engine additive wave-6 (P37) — 継続 trait/name grant (grantTraits / grantNames)

**Round/Phase**: 2026-07-01 engine-first フェーズ E1 wave-6 (engine/p37-trait-name-aura)。engine-extension-plan-2026-06-30 の
**P37 (continuous trait/name grant aura)** を origin/main (2099dda1) 実 grep で genuine-absent 確認後に出荷。TSV では pure-additive だが
「filter 核心 (matchOneFilter) の trait/name 読みに継続付与を差す」ため wave-5 から分離し **単独隔離 + opus 4-lens review** に回した item。
本 wave は engine 足場 + 専用 unit test のみ (engine-only、カード自身は別 card phase)。

## grounding: sole=7 の実採寸 → clean 3 のみ

`.tmp/_fulltext.cjs` で P37 全候補を精査した結果、**継続 self-scope 付与**で clean に解禁できるのは **3 枚**:
- **B05012 恩田遼平**「現場にいるこのキャラは〚カード名［毛利小五郎］〛としても扱い、〚特徴［探偵］〛を持つ」(self trait+name)
- **B07053 ロボット黒羽快斗**「現場にいるこのキャラは〚カード名［怪盗キッド］〛としても扱う」(self name)
- **B08063 黒田兵衛**「現場にいるこのキャラは〚特徴［長野県警］〛を持つ」(self trait、自身の end-turn 条件を **自己計数**)

いずれも公式 Q&A で「現場にいなければ有効でない (デッキ/リムーブで参照不可)」= **board char (uid 既知) 限定**、
「変装で引き継がれない (元の能力)」= 印字 continuous ability であることを確認。

**DEFER** (別 primitive、DEFERRED-INDEX 記録):
- **B06095 榎本梓誘拐事件**: 【宣言】「ターン終了時まで、自分のすべての(8)エリアにあるキャラは〚特徴［喫茶ポアロ］〛を持つ」=
  全 8 エリア (非現場含む) + turn-scoped + declared。非現場カードに per-uid 付与できず別機構。
- **B05101 毛利小五郎**: 「〚特徴［警察］〛と〚［警視庁］〛を失い、〚特徴［探偵］〛を持つ (ターン終了時に切れない)」=
  **permanent applied** な trait 変更 (remove+grant) + 変装引継 → mutate verb + 永続 per-char store 要 (ContinuousModifier ではない)。
  ゆえに `removeTraits` は本 wave では **意図的に未追加**。

## engine 拡張: 純 additive (新 optional field + 新 late-bind、既存カード未宣言 → grantWalk 空 → 挙動不変)

1. **`grantTraits` / `grantNames` ContinuousModifier field** — [card-def.ts](../../src/engine/types/card-def.ts)。
   `grantKeywords` と完全対称の self-scope continuous 経路。
2. **`grantWalk` board reader** — [read/char.ts](../../src/engine/read/char.ts)。自身の `type:'continuous'` ability の
   `continuousModifier.grantTraits/grantNames` を、`ability.condition` 成立 + inPA gate (PA-MR は scope on-partner-area/always のみ) の下で集める
   (keywords() の `fromContinuous` walk と同経路)。`traits()`/`names()` が **印字 ∪ granted** を返す。
3. **`traitNameGrantSafe` late-bind + `_inTraitNameGrant` 再帰 guard** — [candidates.ts](../../src/engine/target/candidates.ts)。
   `continuousDeltaSafe`/`auraDeltaSafe` と同 posture (再入時 `[]` = 印字のみで depth-2 終端)。
   `matchOneFilter` の **`.trait` / `.cardName` / `.cardNameNot`** が board char (`c?.uid` 既知) のみ effective 集合を honor。
   `c===null` (hand/deck/remove/bound=cardId) は印字のまま (公式 Q&A「現場にいなければ有効でない」と 1 対 1)。`effectiveNameComponents` を export。
4. **`bond` 条件の name honor** — [cond/eval.ts](../../src/engine/cond/eval.ts)。granted 名 (「〚カード名[X]〛としても扱う」) が絆を満たす
   (`effectiveNameComponents` で matchOneFilter と同一 name 解決 = BUG-117 一貫性)。

honor site 完備性 (BUG-117): board-char で trait/name を読む site は上記 5 箇所 (matchOneFilter trait/cardName/cardNameNot +
read.char.traits/names + bond)。`dyn/eval` の trait カウンタは read.char.traits 経由で自動追従。
`removeTraitAtLeast`/`removeNameAtLeast`/`boundMatchesFilter`/`_shared` targetFilterToPredicate は **bare cardId (uid 無)** を扱うため
印字のまま (matchOneFilter 自身の c===null→印字 と consistent、divergence なし)。

## 検証 (セルフレビュー + 水平展開 + opus 4-lens 敵対 review)

- tsc 0 (both tsconfig) / vitest **3504 → 3522 pass** +1 skip (新規 18: self trait read+filter / 印字 union / deck-copy NOT granted /
  cardName / cardNameNot / 分割名展開 / bond honor+decoy / B08063 self-count +/− / condition-gated grant +/− [再帰 guard 実走] /
  opp-side grant (side-agnostic) / B05012 同一 ability trait+name / 複数 ability stacking / 印字==granted dedup)。
  ※ 末尾 4 件は opus 4-lens edge-test lens の指摘 (opp-side / co-grant / stacking) を出荷前に追加。
- smoke:1000 **winsA=498・winsB=502・avgTurns=11.0・timeouts/exceptions 0** = baseline 完全一致 (= 既存カードのパス不変の実証 = 純 additive)。
- 8 lint errors=0。engine-only (card consumer 無) ⇒ playwright N/A (0629d/wave2-5 同方針)。
