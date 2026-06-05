## タスク C: disguise-hook 解禁 — 変装ゲート条件評価 + 【変装時】(disguise:into) card-triggerable 化

**Round/Phase**: 2026-06-06 session — 推奨作業順 B→E→C→A→D の C 第4弾 (reasoning hook / look-top-N に続く中リスク群)。engine 拡張計画の "disguise hook" を 1 ユニットとして実装。

### engine 拡張 (additive, 2 点)

1. **`disguise:into` を TRIGGERED_HOOKS に追加** (`src/engine/listeners/triggered.ts`)。
   `flow.contact.disguise` が既に emit する `disguise:into` (source={player,uid}=変装で入れ替わったキャラ。
   uid 維持・cardId のみ変装カードへ差替) を card-triggerable 化。変装後キャラは scene に残り cardId が
   変装カードのものに変わるため、通常 in-play scan (handleHook) が変装カード def の【変装時】ability を発火。
   特別 handler 不要 (reasoning:end / leave:to-remove と同型)。rules/09: 変装は「登場」ではないため enter hook は
   不発、disguise:into のみ発火。既存カードに該当 hook 0 件 → 完全 additive。

2. **canDisguise に変装ゲート条件評価を追加** (`src/engine/flow/contact.ts`)。
   変装カードは【事件白】【FILE6】等の条件付き変装可否を持つ (TSV henso 列)。新 `disguiseAbility(cardId)` で
   icon-disguise ability を取得し、その `condition` を `evalCond` で評価 (owner=変装プレイヤー)。未達は
   rules/17 §条件アイコン Point に従い「変装を持っていない」=変装不可。UI (buildCutInDisguiseCandidates) /
   AI (action-resolution) / engine (disguise throw guard) は全て canDisguise 経由 → ゲートが単一述語で一貫
   (表示と実行のドリフト構造的に皆無)。旧 `hasAbilityType`/`isDisguiseCard` は削除。

### 対応カード batch #1 (3 枚, 全パターン網羅)

- **D06012 怪盗キッド** — 【変装】【事件白】【FILE5】 pure gating (変装時効果なし)。caseColor AND fileAtLeast。
- **B03129 ベルモット** — 【変装】【FILE6】 + 【変装時】カードを1枚引く (disguise:into → draw)。
- **B02045 怪盗キッド** — 【変装】【事件白】【FILE4】 + 【変装時】キャラを1枚まで選びターン終了時まで AP-2000
  (disguise:into → charModifyAP PA 短縮形 pick。CPU 経路は drainAiEffectPicks が解決、BUG-109 と同型)。

### 検証

- typecheck clean / 全 vitest **1815 pass / 1 skip / 0 fail** (+6、回帰 0) / lint errors=0。
- 新 unit test: contact.test.ts に変装ゲート (caseColor/fileAtLeast) 2 件 / tests/cards/disguise-hook-batch.ts 4 件
  (canDisguise 条件切替 + disguise:into draw + AP-2000 pick の AI drain)。
- 新 e2e `tests/e2e/disguise-hook-2026-06-06.spec.ts` 2 pass: ① 変装ゲート【FILE6】が FILE6/FILE5 で
  canDisguise 切替 (text-faithful) ② 実機 contact で B03129 に変装 → CID モーダルの「変装」候補選択 →
  【変装時】1ドロー発火 + 元キャラ (D08005) デッキ下 (rules/09) + console error 0。
- 回帰: reuse-cards e2e 9 pass。
- ALL_CARDS 935 → 938。

### 残課題 (disguise 残 10 枚)

- replaced-char binding 型 (B02047 工藤有希子「LP2以上の【白】と入れ替わった場合」/ B03050 世良真純名指し) —
  入れ替わった元キャラ参照機構が別途必要。
- opponent-optional 型 (B02086 ベルモット「相手は手札1枚リムーブしてもよい」) — 相手選択 hook 要。
- 【事件YAIBA】(B06017) — caseTrait gating だが data 上 caseTraits:[] で永久不発火 → DEFER。
- ビッグジュエル系 (B07033 怪盗キッド / PR263) — partner-area ビッグジュエル参照は恒久 DEFER。
