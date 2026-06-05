# 次セッション再開プロンプト (2026-06-06 時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
(ユーザーは `/goal` コマンドで依頼予定。希望順は E→B→C→A、ただし下記「推奨順」も参照)

---

```
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/auto/structure.md → .claude/sessions/2026-06-06.md を読んで状況を把握すること。

## 現在地 (2026-06-06 #3 時点)

- 最新コミット: 042036fc (origin/main 未 push — 要 `git push`)
- ALL_CARDS: 938 枚 (B/E/C で +5: B01017/B01074/B03102/B05011/D01012)
- vitest: 1809 pass / 1 skip / 0 fail / e2e 含む / typecheck・lint errors=0 / 回帰 0
- 未解決 BUG: BUG-064 (workflow図, doc) / BUG-111〜114 (DEFERRED, latent/非MVP)
  ※ BUG-083 は throw 解消済を確認・修正済 (E)。BUG-122/123 は B で修正済。

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
   **残**: disguise hook(13枚) ← **次の clean な一手**: `disguise:into` を TRIGGERED_HOOKS に追加
   (reasoning:into と同型・disguiseInto で uid 維持→ in-play scan で 【変装時】発火可能と確認済) /
   event→evidence(7枚, remove/hand→evidence verb 要) / reasoning 残 ~11 (souza/発見・optional
   self-remove・multi-target・reasoner-binding 等の別機能ゲート)。
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
