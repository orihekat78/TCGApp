# 次セッション再開プロンプト (2026-06-06 時点)

このファイルを次セッションの最初のメッセージとして **そのままコピペ** してください。
(ユーザーは `/goal` コマンドで依頼予定。希望順は E→B→C→A、ただし下記「推奨順」も参照)

---

```
名探偵コナンTCG MVP の作業を継続してください。まず CLAUDE.md → CHANGELOG.md →
.claude/auto/structure.md → .claude/sessions/2026-06-06.md を読んで状況を把握すること。

## 現在地 (2026-06-06)

- 最新コミット: cc18a10f (origin/main 同期済)
- ALL_CARDS: 933 枚 (未実装 約 720 枚 = データ延べ 1653 − 933)
- vitest: 1788 pass / 1 skip / 0 fail (bug-077 flaky は testTimeout 20s で解消済)
- e2e: 96 pass / typecheck・lint (side-channel/listener/bugs/eslint) errors=0 / 回帰 0
- 未解決 BUG: BUG-064 (workflow図, doc) / BUG-083 (rules/20 同時スイッチ未実装) /
  BUG-111〜114 (DEFERRED, latent/非MVP)

## 直近セッションで完了 (2026-06-05〜06)

- **engine バグ 5 系統 検出・修正** (Playwright 実機検証 × 多エージェント監査で発見):
  - BUG-117 deckRevealUntil の ap/lp filter 黙殺 / BUG-118 matchOneFilter の kind 黙殺 /
    BUG-119 charModifyLevel の lvlMod を clearTurnEffects が消さず永続化 /
    BUG-120 charSetCard 短縮形の chooser 取り違え / BUG-121 enter 複数択 choice が surface されず
- **BUG-121 を案B (engine pause) で汎用実装** — pendingEffectChoice 機構 (pick と同型)。
  sequence 内 choice も holder 方式で対応 (pre-step 二重実行なし)
- **残課題ゼロ化**: bug-077 flaky 解消 / 監査 suspect 6 件全検証 (engine 候補フィルタ + B03091 UI)
- **規約化**: card-addition-checklist §7 + CLAUDE.md に「Playwright で画面処理=カードテキスト文言」検査追加
- **教訓**: LESSONS-LEARNED-3.md (教訓 23〜25) + 教訓ファイル更新運用を明文化 (自動更新は無い)

## 推奨される作業順 (前 session で議論: B → E → C → A → D)

未実装カードを実装するのは A/C/D のみ。B=既存実装の品質監査、E=バグ。全実装には A+C+D が必須。

1. **B. text-faithfulness 監査 横展開** (最高レバレッジ・低リスク): BUG-117〜121 を見つけた
   「Playwright × 多エージェント監査」を catalog-reuse(284枚)/ct-p01〜09 の既存実装に拡大。
   隠れ engine バグを除去しつつ回帰テスト網を厚くする → 以降の全作業の土台。**A より必ず先**。
2. **E. BUG-083** (rules/20「2つ以上同時登場で現場上限超過時のスイッチ」未実装) — 孤立した engine 正当性。
3. **C. engine 拡張 中リスク**: reasoning hook(15枚) / disguise hook(13枚) / event→evidence(7枚) /
   look-top-N(1枚)。additive・risk 順で D より先。解禁カードもこの段で実装。
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
