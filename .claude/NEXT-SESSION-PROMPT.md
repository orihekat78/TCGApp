# 次セッション再開プロンプト (2026-06-06 時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
(ユーザーは `/goal` コマンドで依頼予定。希望順は E→B→C→A、ただし下記「推奨順」も参照)

---

```
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/auto/structure.md → .claude/sessions/2026-06-06.md を読んで状況を把握すること。

## 現在地 (2026-06-06 #4 時点)

- 最新コミット: 9a36b166 (BUG-124) / c15ad259 (disguise-hook)。origin/main 未 push (要 `git push`)
- ALL_CARDS: 938 枚 (C disguise-hook batch で +3: D06012/B03129/B02045。前回 prompt の "938/+5" は誤記、実際は 935→938)
- vitest: 1818 pass / 1 skip / 0 fail / e2e 含む / typecheck・lint errors=0 / docs:check 同期 / 回帰 0
- 未解決 BUG: BUG-064 (workflow図, doc) / BUG-111〜114 (DEFERRED, latent/非MVP)
  ※ BUG-083 (E) / BUG-122/123 (B) / BUG-124 (C review 水平展開) は修正済。

### 直近完了 (2026-06-06 #4)
- **C disguise-hook 1ユニット** (commit c15ad259): engine additive 2点 — `disguise:into` を TRIGGERED_HOOKS 追加
  (変装後キャラ in-play scan で【変装時】発火) + canDisguise に変装ゲート条件 (icon-disguise ability の condition
  = caseColor/fileAtLeast) を evalCond 評価。カード D06012/B03129/B02045。詳細: .claude/sessions/2026-06-06-4.md
- **BUG-124** (commit 9a36b166): disguise review 水平展開で検出。caseTrait condition が CardDef.traits を読み
  事件特徴 caseTraits を未参照 → 古城系【事件特徴】永久 false。caseTraits+traits union で修正 (latent, 回帰0)。

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
3. **C. engine 拡張 中リスク** (進行中): reasoning hook ✅(#1/#2)・look-top-N ✅(#3)。
   **残**:
   - **disguise hook(13枚)**: ①`disguise:into` を TRIGGERED_HOOKS 追加は clean・additive
     (emit source={player,uid}・disguiseInto で uid 維持→ in-play scan で 【変装時】selfOnly 発火可、
     contact.test.ts に disguise harness 有)。**ただし** 変装カード (例 B02045) は変装可否に
     【事件白】【FILE4】等の **条件付き** (TSV col14 henso) があり、`canDisguise`/`isDisguiseCard` は
     ability condition を見ない → **条件付き変装ゲーティングの engine 拡張も別途必要**。1 ユニットとして設計せよ。
   - **event→evidence(7枚)**: remove/hand→evidence verb 要。
   - **reasoning 残 ~11**: souza/発見・optional self-remove・multi-target・reasoner-binding 等の別機能ゲート。
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
