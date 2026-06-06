# 次セッション再開プロンプト (2026-06-06 #7 末)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
**次セッションの方針: ユーザーは「A — engine変更0 の大量バッチ」へ着手したい (B→E→C 完了済)。**

---

```
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/auto/structure.md → .claude/sessions/2026-06-06-7.md を読んで状況を把握すること。

## 🎯 次セッションの最優先タスク = A (engine変更0 の大量カードバッチ)

ユーザー希望: B→E→C が完了したので **A (engine を一切触らずに既存機能で忠実実装できるカードの刈り取り)** に着手する。
C で engine 機能が大幅に増えた (reasoning/アクション反応・「そのキャラ」参照・set-card 除去・「〜してもよい」
optional・「証拠を得ない」・deck-look-N・bounce・level/AP/LP 修正・leave hook・変装 hook・event→evidence 等) ため、
**以前より「engine変更0 で実装可能なカード」が大量に増えている**はず。

### A の進め方 (推奨)
1. **再サーベイ (最初の一手)**: 残カタログ (約700枚) を多エージェント workflow で全数分類 —
   🟢 engine変更0 で実装可 / 🟡 新機能要 (→D) / ⚫ データ・構造で恒久 DEFER。
   ⚠ **実データ/実コードで裏取りすること** (今 session で B09047 を stale コメント鵜呑みで誤判定した反省。
   tsv-loader.ts:9「単色」は誤り=2色MR は実在。`engine-extension-plan.md`/`card-impl-engine-gates.md` も
   2026-06-04 時点の古い記述があるので、実 candidates.ts/atom-handlers.ts で確認する)。
2. 🟢 を **均質なバッチ** (色違い再録・同型カード群) で一気に実装 → 各バッチで full vitest + e2e で回帰0 確認。
3. ALL_CARDS を着実に積み上げる。touched files は cards/ + _reuse/index.ts のみ (engine 不変) を維持。

## 現在地 (2026-06-06 #7 時点)

- 最新コミット: evidence 抑制 + B03038 (43971c51)。origin/main 未 push (要 `git push`、22+ commit 未push)
- ALL_CARDS: **967 枚** (reasoning new-feature シリーズ ①〜④ で +9)
- vitest: **1851 pass** / 1 skip / 0 fail / typecheck・変更ファイル lint errors=0 / docs:check 同期 / 回帰 0
- reasoning 残 new-feature 全実装完了 (お勧め順 ①〜④):
  - ① **triggerChar→target** (`$trigger.uid/gained` を resolveBindRef で解決、B05080)
  - ② **multi-hook 共有【ターン1】** (TriggerDef.hooks[] + action:declare payload uid/player、D03007/B04039/B02004系)
  - ③ **set-card 除去 verb** (charRemoveSetCard、B08034/P)
  - ④ **evidence 抑制** (evidenceToDeck + optional triggerPayload 引継ぎ、B03038)
  - ⑤ B09047 のみ DEFER (理由: engine 構造。**2色MR は実在する**が isMR/色数 filter 述語が無く、かつ
    パートナーエリアの MR キャラを列挙する GameState 枠が無い = ビッグジュエル B07045 と同型の高リスク構造問題)。
- 既存 engine 機構: pendingEffectOptional (「〜してもよい」surface) / pendingEffectChoice (BUG-121) /
  pendingEffectPick。optional は top-level のみ / AI は常に skip。
- 未解決 BUG: BUG-064 (workflow図, doc) / BUG-111〜114 (DEFERRED, latent/非MVP)
  ※ BUG-083 (E) / BUG-122/123 (B) / BUG-124 (C review 水平展開) は修正済。
- 既知 (本件無関係): src/engine/effect/validate.ts:68 に pre-existing eslint no-fallthrough (walk switch)。

### 直近完了 (2026-06-06 #4-5) — C タスク
- **disguise-hook** (c15ad259): `disguise:into` TRIGGERED_HOOKS 追加 + canDisguise 変装ゲート条件評価。
  カード D06012/B03129/B02045。詳細: sessions/2026-06-06-4.md
- **BUG-124** (9a36b166): caseTrait が caseTraits 未参照の field-drop を union 修正。
- **event→evidence** (f8526b97 + 8ba5fa28): 新 verb `selfToEvidence` (イベント自身を remove→evidence 表向き化)。
  B0401x 5色 + PR再録12枚 = 全17枚。詳細: sessions/2026-06-06-5.md

## 直近セッションで完了 (2026-06-06 #2/#3 — タスク B/E/C)

- **B 完了**: text-faithfulness 監査 横展開 (engine フィルタ経路 全数突合 + 7並列エージェントで 358枚)。
  BUG-122 (filter.keyword がアイコン能力未検出 / engine read.keyword.defHasKeyword 新設) +
  BUG-123 (remove/hand pick で kind:'character' 欠落 / B01094・B09044) 検出・修正。教訓 26。
- **E 完了**: BUG-083 は 2026-06-04 switch-on-effect-enter で throw 解消済を確認・修正済化。
- **C 進行中** (engine-extension-plan の中リスク群):
  - #1 reasoning hook: reasoning:end を TRIGGERED_HOOKS 追加 (selfOnly)。B01017/B01074。
  - #2 triggerCharMatches condition: 非 selfOnly「自分の現場のキャラが推理したとき」。B03102/B05011。
  - #3 look-top-N: sceneEnter enterSleep:true (スリープ登場)。D01012。

## 作業順 (B → E → C → A → D)

1. ~~**B. text-faithfulness 監査**~~ → ✅ 完了 (BUG-122/123)。
2. ~~**E. BUG-083**~~ → ✅ 完了 (throw 解消済確認)。
3. ~~**C. engine 拡張 中リスク**~~ → ✅ **完了**。reasoning hook / look-top-N / disguise hook / event→evidence /
   reasoning 残全分類 + batch#3 (B05039/B03096) / optional 配線 (B05019) / triggerChar→target (B05080) /
   multi-hook 共有【ターン1】(D03007/B04039/B02004系) / set-card 除去 (B08034/P) / evidence 抑制 (B03038)。
   詳細: sessions/2026-06-06-3〜7.md。**B09047 のみ DEFER** (engine 構造: isMR/色数 filter 無 + partner-area
   MR 列挙の GameState 枠無 = D 行き / ビッグジュエル B07045 同型。※「データ無」は誤り、2色MR は実在)。
4. ▶ **A. engine 変更0 カードバッチ** (← 次セッション着手、上記「🎯 最優先タスク」参照)。
   候補: deck-look-N 残 約50枚 (B03007/B03036/B05016/B07010 等 同型) + bounce/level-modify/set-card/multi-target 残 +
   C で解禁した reasoning反応/推理かアクション/optional/charRemoveSetCard 系の **同型再録カード** + 素のバニラカード。
   ※ まず再サーベイで「engine変更0 で実装可」を全数洗い出してからバッチ化する (実データ裏取り必須)。
5. **D. engine 拡張 高リスク** (最後): continuous aura(13枚) / untargetable(6枚) / partner ability rewrite(10枚) /
   **partner-area 構造拡張** (B07045 ビッグジュエル / B09047 の MR 列挙)。全カードに波及 → テスト網が最厚の最終段で慎重に。

### A/C/D いずれにも入らない恒久 defer (別途データ/構造対応)
イベントの「特徴」参照 (全イベント traits:[]) / partner-area 特殊カード (ビッグジュエル B07045) /
登場手段の source レベル参照 等。card-impl-engine-gates.md 参照。

## 重要な参照ファイル

- 拡張計画: .claude/specs/engine-extension-plan.md / ゲート表: card-impl-engine-gates.md
- 監査手法: .claude/sessions/2026-06-05-2.md (workflow) / DEFERRED: DEFERRED-INDEX.md
- 教訓: .claude/bugs/LESSONS-LEARNED.md (+ -2/-3) / BUG 一覧: .claude/bugs/index.base
- choice 機構: memory「複数択 choice の surface 経路」/ filter 評価: memory「engine 評価経路の field-drop」

## 注意事項

- pre-commit hook が SKIP 不要で clean に通過する状態を維持 (docs:check 含む)
- カード追加・engine 変更時は CLAUDE.md §セルフレビュー (特に新規の text-faithfulness Playwright 検査)
  と card-addition-checklist を必ず通す
- 骨格凍結原則: engine 編集はバグ修正/ルール変更時のみ。カード対応は cards/_shared/ 共通クラス経由
- **A は engine 変更0 が大原則**。実装中に「engine を触らないと無理」と判明したら、そのカードは A から外して D 候補へ送る
- **commit 時 `git add -A` を使わない** (今 session で無関係な `meta-app/` の別作業未コミット変更を巻き込む事故があった)。
  自分が触ったファイルを明示的に `git add <path>` すること。
- **未push 25+ commit** あり (push は arumi さんの手動運用)。`meta-app/` に別作業の未コミット変更が在れば混在に注意
- DEFER 判定は **stale なコメント/古い spec を鵜呑みにせず実データ・実コードで裏取り** (B09047 の教訓)

最初に何をすべきかを宣言してから着手してください。
```
