---
date: 2026-05-29
title: Phase 16 — チュートリアルを「ステップ→別画面 lesson viewer」化 (33 ステップ図解 + Workflow ルール監査)
type: feat
scope: meta-app
---

## ユーザー指示

> 説明の項目をクリックしたら別画面で説明が始まるようにしてほしい
> このチュートリアルについては他 TCG ゲームを参考に開発してほしい
> チュートリアルでのレイアウトはコナンカードゲーム公式ページに例が上がっているので Playwright で確認して参考に
> https://conan-tcg.commmune.com/view/knowledgebase/post/16862 こういったページ周辺も参考に

Phase 15 はステップクリックが「クリア記録」のみで、説明は常時右パネルに章単位表示だった。本 Phase で「クリック → 別画面で説明開始」へ刷新。

## 他 TCG 参考 (Playwright + Web)

- **Yu-Gi-Oh Master Duel**「遊び方」= 1 トピック 1 ページのページめくり式 → lesson viewer の基本形
- 公式「初めての方へ」(takaratomy) = 8 セクション 2 グループ構成を踏襲
- 公式ルールマニュアル Ver 2.4 (commmune P3-5) = カード annotated 表記 → `CardAnnotated` の番号注釈に反映
- カルーセル UX (NN/g, Smashing): 1 画面 1 概念 / 進捗ドット / 常時 skip 可

## 主要変更 (`meta-app/` のみ)

### A. データモデル分解 (16-A, `screens/tutorial/`)
- `tutorial/types.ts` 新規 — `TutorialStep` / `TutorialChapter` 型を切り出し (TutorialScreen ↔ viewer の循環依存回避)
- `illustrations.tsx` を **章単位 8 コンポーネント → ステップ単位 33 図解** へ分解、`STEP_ILLUSTRATIONS: Record<stepId, ReactNode>` レジストリを export
- 共通プリミティブ拡充: 既存 Panel/SectionLabel/TermRow/PointBox/WarnBox に加え Zone/PhaseBox/FlowStep/Token/MiniChar/CaseStateBox/TimingChip/CardAnnotated/CalloutPill/DeckPile/KeywordCard/AdvancedSection

### B. TutorialLessonViewer 新規 (16-B)
- フルスクリーン没入オーバーレイ (`position: fixed; inset: 0; z-index: 300`、backdrop blur) で AppTopBar も覆う (Master Duel 風)
- ヘッダ `CHAPTER 0X · {title} · ステップ N / M` + × / 本体 `STEP {num}` + title + `STEP_ILLUSTRATIONS[id]` + body / フッタ 進捗ドット (クリックでジャンプ) + 「← 前」「次へ →」(最終「章を完了 ✓」)
- 「次へ」= `onStepComplete(stepId)` (= markStepCleared) → 前進 / 最終は閉じる
- Esc / ← / → キーボード + backdrop / × で離脱 (skip 常時可)

### C. TutorialScreen ハブ再構成 (16-C)
- 右パネル常時 Illustration を撤廃、3 カラム (左 ChapterProgress+ChapterList / 中央 StepCardList「▸ 開く」/ 右 ChapterSummary「この章で学ぶこと」+ 進捗 + 「章を最初から学ぶ ▸」CTA) に
- `viewerState: { chapterNum, stepIndex } | null` でステップ別画面を開閉
- `TUTORIAL_CHAPTERS` は引き続き export (ResultScreen が step id 集計に使用)、Phase 15-E 練習試合連携 (ch5 自動クリア) 保持

### D. Workflow による章別 adversarial ルール監査 (16-review)
33 ステップ図解 vs `rules/01〜26` を 8 章 reviewer + refute-by-default verifier (計 24 agent) で照合、**確認 15 finding を反映**:
- **ch1-2**: 「場の 7 エリア」→ **8 エリア** (手札含む) / FILE「オート +2」→「毎ターン +2 (初手1)」
- **ch2-1**: 「AP はコンタクト (戦闘) で比較」→ **「アクション (攻撃) で比較」** (現行用語)
- **ch3-1** (high): 開幕に **「① 事件/パートナーを裏向き配置」** を追加 (公式 04 step1 欠落) / マリガンに **「デッキをシャッフル」**+先攻先決定を追記
- **ch3-2** (high): AUTO に **「アシスト中パートナーは戻す / スタンは代わりにスリープ / FILE は 1 枚ずつ最新が上」** + メイン制限 (手札 1 回・名乗り不可・割り込み不可) を追記
- **ch4-1**: 推理に **「名乗り/スリープは推理不可」** / **ch4-2** (high): アクション対象 **「スリープ/スタンの相手キャラ・証拠ある事件のみ、アクティブ相手・証拠0事件は不可」** / **ch4-3** (high): コンタクト **「AP 同値は非ターンプレイヤーが 1 番目」** / **ch4-4**: NH **「登場キャラは同ターン登場 (名乗り→推理不可)」**
- **ch6-1** (high): ヒラメキ **「アクション[事件]によるリムーブ時のみ発動 (カード効果では不発動)」**
- **ch7-1**: 疾風 **「能力・効果による登場でも発動」** / **ch7-4**: ブレット例を非公式「直接通る」→公式準拠「ガードを宣言できない」に

## 不変条件 (継続遵守)

- ✅ `src/` 配下 1 行も変更なし (`git status -- src/ vite.config.ts tsconfig.json tests/` = 0 件)
- ✅ Phase 11 統合経路保持 (`useGameStateStore` / `setGameState` / `customGameStart`)
- ✅ Phase 15 進捗 persist (`tutorialClearedStepIds`) / Phase 15-E 練習試合連携 維持
- ✅ カード画像非同梱・ローカル限定運用 (法務スタンス維持)

## 検証

- tsc (`meta-app/tsconfig.json`) green / build green
- meta-app e2e **25/25 全緑** (既存 19 + tutorial 6: ハブ 8 章 / ステップカードクリック→viewer / 次へ進行+persist / ch2 番号注釈 / ch7 KeywordCard / Esc クローズ)
- セルフレビュー実施済 / 水平展開 = 33 図解全件を rules 照合 (Workflow 8 章 fan-out)

## 仕様 / 記録

- `.claude/specs/meta-ui/15-tutorial-lesson-viewer.md` (76 行) + meta-ui/INDEX.md・specs/INDEX.md に entry 16 登録
- `.claude/changelog-entries/2026-05-29-06-phase-16-tutorial-lesson-viewer.md` (本ファイル)

## 持ち越し (Phase 17+)

- 動的 unlock (章チェーン) / 各ステップ末クイズ
- 練習試合中に src/ TutorialOverlay を active 化 (実盤面 highlight)
- 章別の練習シナリオ (ch4 コンタクト / ch6 カットイン 等)
- viewer のスワイプ操作 (タッチ) 対応 / バンドル分割
