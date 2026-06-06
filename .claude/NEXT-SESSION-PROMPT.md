# 次セッション再開プロンプト (2026-06-06 時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
(ユーザーは `/goal` コマンドで依頼予定。希望順は E→B→C→A、ただし下記「推奨順」も参照)

---

```
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/auto/structure.md → .claude/sessions/2026-06-06.md を読んで状況を把握すること。

## 現在地 (2026-06-06 #6 時点)

- 最新コミット: optional 決定の配線 + B05019。origin/main 未 push (要 `git push`、17+ commit 未push)
- ALL_CARDS: **958 枚** (reasoning-hook batch #3 +2 / optional B05019 +1)
- vitest: **1834 pass** / 1 skip / 0 fail / e2e 含む / typecheck・変更ファイル lint errors=0 / docs:check 同期 / 回帰 0
- 新 engine 機構: **pendingEffectOptional** (「〜してもよい」を human に「する/しない」surface、pendingEffectChoice 同型)。
  optional は top-level のみ対応 / AI は常に skip (policy hook で将来 enhance 可)。
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

## 推奨される作業順 (B → E → C → A → D)

1. ~~**B. text-faithfulness 監査**~~ → ✅ 完了 (BUG-122/123)。
2. ~~**E. BUG-083**~~ → ✅ 完了 (throw 解消済確認)。
3. **C. engine 拡張 中リスク**: reasoning hook ✅(#1/#2)・look-top-N ✅(#3)・disguise hook ✅・event→evidence ✅。
   **残**:
   - ~~**disguise hook**~~ → ✅ 完了 (c15ad259, D06012/B03129/B02045)。残 disguise 10枚 (replaced-char binding /
     opponent-optional / 事件YAIBA DEFER / ビッグジュエル DEFER) は別機能ゲート。
   - ~~**event→evidence (selfToEvidence)**~~ → ✅ 完了 (f8526b97+8ba5fa28, 全17枚)。残 hand→evidence(裏向き,
     B06033等) / 相手証拠操作(B05103) / 証拠flip+ヒラメキ(B06034) は別 verb DEFER。
   - ~~**reasoning 残 全数分類 + batch #3**~~ → ✅ 完了 (#6)。10並列 workflow で全 13 枚を engine 突合分類。
     既存 hook 2 枚 (**B05039** multi-target charModifyAP / **B03096** 捜査1=deckRevealUntil(opp) 代替) を実装。
     残 11 = partial 3 (B08034/B02004+D10023+PR173/B05080) + new-feature: **B05019**(optional配線) /
     B03038(evidence抑制) / B04039・D03007(multi-hook共有limit) / B09047(MR2色+データ無)。詳細: sessions/2026-06-06-6.md
   - ~~**optional 決定の配線**~~ → ✅ 完了。`pendingEffectOptional` 機構 (resolve-picks/apply-pick +
     store/dispatch/EffectOptionalModalHost、pendingEffectChoice 同型) を新設し **B05019** を実装。
     「〜してもよい」を human に「する/しない」surface。top-level optional のみ対応 / AI は常に skip。
   - **次の engine 機能候補** (残 reasoning):
     - multi-hook 共有 limit (D03007/B04039/B02004 の「推理かアクション」+【ターン1】を reasoning:end +
       action:declare 2hook で 1 回に縛る) — 加えて B04039 は action:declare の triggerChar gate も要。
     - triggerChar→target binding (B05080「そのキャラ(=推理者)」を effect target に) — reasoning:end payload.uid を
       resolveCtx.bindings['$reasoner'] へ。小さい additive。
     - set-card 除去 verb (B08034 推理反応。【登場時】部分は既存で partial 実装可)。
     - evidence 抑制 (B03038、reasoning:before-add の card-triggerable 化が要、高難度) / MR2色 condition (B09047、データ無で DEFER)。
   - 既存 `triggerCharMatches` condition は他の payload-char 反応 (action/leave 等) にも再利用可。
4. **A. engine 変更0 カードバッチ** (大量・低リスク): deck-look-N 残 約50枚 (B03007/B03036/B05016
   /B07010 等 同型) + bounce/level-modify/set-card/multi-target 残 + 素のバニラカード。
5. **D. engine 拡張 高リスク** (最後): continuous aura(13枚) / untargetable(6枚) /
   partner ability rewrite(10枚)。全カードに波及 → テスト網が最厚の最終段で慎重に。

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

最初に何をすべきかを宣言してから着手してください。
```
