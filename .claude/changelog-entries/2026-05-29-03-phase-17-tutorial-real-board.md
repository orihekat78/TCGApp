---
date: 2026-05-29
title: Phase 17 — チュートリアルに実対戦フォーマット流用 + 横向き事件カード + ワイド2ペイン + 章ごとガイド付き実戦
type: feat
scope: meta-app
---

## ユーザー指示

> 実際の対戦フォーマットを流用するようにしてください
> 事件カードについては横カードなのだから対応してください
> 出てくるテキストボックスが小さいので大きくしてほしい。カードの表示も大きくして、説明文がどの箇所を指しているのか該当箇所を強調してほしい
> step3 からは実際のプレイを交えながら行っていったほうがいいかもしれませんね
> 質問やモックでの確認もしてくれて構いません

確定方針 (AskUserQuestion + モック提示): Q1=実 Playmat 静的埋め込み / Q2=章ごとガイド付き実戦 / Q3=ワイド2ペイン。

## 主要変更 (`meta-app/` のみ、`src/` は import only で git diff = 0)

### A. ワイド2ペイン viewer + 拡大 (Q3)
- `TutorialLessonViewer` を `min(1040px,96vw)` の 2 ペインに再構成
- 左ペイン = step 種別で出し分け (card / board / illustration)、右ペイン = STEP + **拡大本文 (15px/lineHeight1.85)** + パーツ/ゾーン一覧 + ナビ

### B. 実カード拡大 + 横向き事件 + 該当箇所強調 (Q1, #2, #3)
- `AnnotatedCard` 新規: 実 `CardArt` を拡大描画 (縦 ~300px / 事件は **116:84 横向き ~440px**)。旧 `MetaCard w=140` 縦固定による歪みを解消
- `CARD_REGIONS` 正規化矩形でカード各パーツ (種類/色/名前/AP/LP/効果/No/事件レベル) に発光ボックス + 番号。公式実画像を Playwright 目視確認して座標確定 (AP「6000」LP「1」事件レベル「先7/後6」等に正対応)
- 右ペイン一覧 hover ↔ 左の region を共有 `activeKey` で gold pulse 強調、他は dim (該当箇所強調)

### C. 実 Playmat 盤面スナップショット (Q1, #1)
- `TutorialBoardSnapshot` 新規: `FitScaleBox` (実測フィット縮小) で実 `<Playmat gameState={createSampleGameState()}>` を読み取り専用描画 (pointer-events none)
- `boardHints.ts` の `STEP_BOARD_ZONES` で各 step の強調ゾーン (.scene-area.side-self 等) を定義 → snapshot root 内 querySelector で box 描画 + 右ペイン一覧 hover 連動
- 左ペイン出し分け: ch1-2/ch3/ch4/ch5-1..4 = 盤面、ch1-1/ch6/ch7/ch8 = 既存模式図、ch2-* = 実カード
- `util/tutorialResolvers.ts` に resolver を共有抽出 (RealMatchView も同 import に差替、挙動不変)

### D. 章ごとガイド付き実戦 (Q2, #4)
- viewer フッタ (ch3+) 「▶ この章を実戦で試す」→ `useTutorialStore.setState({currentStep: CHAPTER_TO_SRC_STEP[ch]})` + customGameStart + #match。RealMatchView 既存 `<TutorialOverlay/>` が実盤面で該当 step のガイド + ゾーンハイライトを表示 (実際に推理/アクションを操作しながら学べる)
- `CHAPTER_TO_SRC_STEP`: meta 章 → src `TUTORIAL_STEPS` index (ch3→L3-1「3フェイズ」, ch4→L4-1「推理」, ch5→L5-1「アシスト」, ch6→L9-1「カットイン」, ch7→L6-1「アクション」, ch8→L13-1「MR」)
- overlay リセットは **非ガイド起動側で決定的に** (startPractice / SetupScreen.handleReady で `exit()`)。unmount cleanup での exit は React StrictMode が currentStep を消すため不可と検証で判明 → 採用しない

## 検証

- tsc green / e2e **29/29 全緑** (既存 25 + 追加 4: 盤面スナップショット `.case-area` / 横事件 width>height / region 注釈 + パーツ一覧 / ガイド実戦起動→#match + `.tutorial-overlay`)
- Playwright 実機: 横事件 (440×319)・region 正対応・hover で該当 region gold pulse・ch3 CTA→実戦+overlay「3フェイズで進む(8/33)」+highlight・console error 0
- `src/` git diff = 0 (`src/ vite.config.ts tsconfig.json tests/` = 0 件)

## 仕様 / 記録

- `.claude/specs/meta-ui/16-tutorial-real-board.md` 新規 + meta-ui/INDEX・specs/INDEX に entry 17
- 本エントリ `2026-05-29-03-phase-17-tutorial-real-board.md`

## 持ち越し (Phase 18+)

- 操作の正誤判定 / ゲーティング (現状 overlay は手動 next)
- 章別シナリオ盤面 (専用 deck/手札固定) / viewer スワイプ / バンドル分割
