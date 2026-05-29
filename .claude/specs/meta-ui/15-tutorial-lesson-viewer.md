# 15 — Phase 16: チュートリアル lesson viewer (ステップ → 別画面)

## 背景

Phase 15 はステップクリックが「クリア記録」のみで、説明は常時右パネルに章単位表示だった。ユーザー要望「説明項目クリックで別画面で説明が始まる / 他 TCG 参考」を実装。

## 他 TCG 参考 (Playwright + Web)
- **Yu-Gi-Oh Master Duel**「遊び方」= 1 トピック 1 ページのページめくり式 → 本 Phase の lesson viewer の基本形
- 公式「初めての方へ」(takaratomy) = 8 セクション 2 グループ (初心者 4 + 詳しく 4)
- 公式ルールマニュアル Ver 2.4 (commmune) P3-5 = カード annotated 表記 → `CardAnnotated` の番号注釈に反映
- カルーセル UX (NN/g, Smashing): 1 画面 1 概念 / 進捗ドット / 常時 skip 可

## ユーザー確定方針
1. 別画面 = **フルスクリーン lesson viewer** (3 カラムを覆う没入オーバーレイ)
2. 図解 = **ステップごとに専用図解** (33 図)
3. 進行 = **ページめくり + ドット + 「次へ」で完了マーク**
4. 動的 unlock は除外 (開発中、Phase 17+)

## アーキテクチャ

```
TutorialScreen (ハブ)
  左:  ChapterProgress (rank) + ChapterList (8 章, 2 グループ)
  中央: StepCardList — 各ステップ「▸ 開く」カード (状態アイコン付)
  右:  ChapterSummary — この章で学ぶこと + 進捗 + 「章を最初から学ぶ」CTA
        ↓ ステップカード / CTA クリック → viewerState 設定
  TutorialLessonViewer (fixed inset 0, z 300)  ← 別画面
```

## ファイル

| ファイル | 役割 |
|---|---|
| `meta-app/src/screens/tutorial/types.ts` (新) | TutorialStep / TutorialChapter 型 (循環依存回避) |
| `meta-app/src/screens/tutorial/illustrations.tsx` | 章単位 8 → **ステップ単位 33 図解** + `STEP_ILLUSTRATIONS: Record<stepId, ReactNode>` export |
| `meta-app/src/screens/tutorial/TutorialLessonViewer.tsx` (新) | フルスクリーン viewer (ヘッダ + STEP_ILLUSTRATIONS[id] + body + ドット + prev/next) |
| `meta-app/src/screens/TutorialScreen.tsx` | ハブ再構成 (StepCardList + ChapterSummary + viewerState 配線)。TUTORIAL_CHAPTERS は引き続き export (ResultScreen が step id 集計に使用) |
| `meta-app/tests/e2e/tutorial.spec.ts` | viewer 経由 6 テスト |

## TutorialLessonViewer 仕様

- props: `chapter` / `stepIndex` / `onStepChange` / `onStepComplete(stepId)` / `onClose`
- ヘッダ: `CHAPTER 0X · {title} · ステップ N / M` + × (Esc)
- ボディ: `STEP {num}` + step.title (大) + `STEP_ILLUSTRATIONS[step.id]` + step.body
- フッタ: 進捗ドット (クリックでジャンプ) + 「← 前」/「次へ →」(最終は「章を完了 ✓」)
- 「次へ」= `onStepComplete(currentStepId)` (= markStepCleared) → 前進 / 最終は閉じる
- Esc / ← / → キーボード操作対応、backdrop / × で離脱
- z-index 300 で AppTopBar も覆う没入オーバーレイ

## STEP_ILLUSTRATIONS (33 図解)

共通プリミティブ: Panel / SectionLabel / TermRow / PointBox / WarnBox / Arrow / Zone / PhaseBox / FlowStep / Token / MiniChar / CaseStateBox / TimingChip / CardAnnotated / CalloutPill / DeckPile / KeywordCard / AdvancedSection。
- ch1: デッキ構成 (42 枚) / 8 エリア
- ch2: キャラ・イベント・事件・パートナー の CardAnnotated (番号注釈)
- ch3: 開幕 6 ステップ / 3 フェイズ
- ch4: 推理 / アクション+ガード / コンタクト AP比較 / NH / リフレッシュ+敗北
- ch5: 事件編→解決編 / 必要証拠 7・6 / 事件解決 / アシスト勝利不可 / 練習試合 CTA
- ch6: アイコン 4 種 / 宣言能力構文 / タイミング / 解決順
- ch7: 疾風 / 突撃 / 迅速 / ブレット / 捜査 / 痕跡 の KeywordCard
- ch8: MR / 色制限+スイッチ / スタン / 数値修正 / セット の AdvancedSection

## 検証

- tsc + build green (bundle ~600KB)
- e2e **25/25 緑** (既存 19 + tutorial 6: ハブ 8 章 / カードクリック→viewer / 次へ進行+persist / ch2 番号注釈 / ch7 KeywordCard / Esc クローズ)
- 既存 `src/` git diff = 0 (Phase 10-15 継続)
- Phase 15-E 練習試合連携 (ch5 自動クリア) 維持
- **Workflow による章別 adversarial ルール監査** (8 章 × 図解 vs rules/01-26、反証検証) で確認 finding を反映

## 持ち越し (Phase 17+)
- 動的 unlock / 各ステップ末クイズ / 練習試合中 TutorialOverlay active 化 / viewer スワイプ操作 / バンドル分割

## 関連
- 前: [14-tutorial-complete.md](14-tutorial-complete.md)
- 実装: `meta-app/src/screens/tutorial/{types,illustrations,TutorialLessonViewer}.tsx` + `TutorialScreen.tsx`
- 参照: 公式「初めての方へ」+ ルールマニュアル Ver 2.4 (commmune P3-5)
