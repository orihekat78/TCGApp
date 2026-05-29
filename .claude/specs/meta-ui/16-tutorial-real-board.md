# 16 — Phase 17: チュートリアル実対戦フォーマット流用 + ガイド付き実戦

## 背景

Phase 16 の lesson viewer は模式ボックス図 + 縦固定カードだった。ユーザー要望 4 点:

1. 実際の対戦フォーマット (本物の盤面・実カード) を流用
2. 事件カードは横カード (旧実装は縦固定で歪み)
3. テキスト + カードを拡大、解説がどの箇所を指すかハイライト
4. step3 以降は実際のプレイを交えながら

確定方針: Q1=実 Playmat 静的埋め込み / Q2=章ごとガイド付き実戦 / Q3=ワイド2ペイン。

## 不変条件

- `src/` は 1 行も変更しない (import only、git diff = 0 で確認)
- Phase 11 統合経路保持。カード画像非同梱・ローカル限定

## アーキテクチャ

```
TutorialLessonViewer (ワイド2ペイン, min(1040px,96vw))
  左ペイン: step 種別で出し分け
    - card  (ch2-*) → AnnotatedCard (実 CardArt 拡大 + region 強調 + 横/縦)
    - board (ch1-2/ch3/ch4/ch5-1..4) → TutorialBoardSnapshot (実 Playmat 縮小)
    - illustration (ch1-1/ch6/ch7/ch8) → 既存 STEP_ILLUSTRATIONS
  右ペイン: STEP + 拡大本文(15px) + パーツ/ゾーン一覧(hover連動) + ナビ
  フッタ: ドット + 前/次へ + (ch3+)「▶ この章を実戦で試す」
        ↓ guided 起動
  RealMatchView (#match) ＝ 実対戦 + src TutorialOverlay (該当 step から)
```

## ファイル (meta-app のみ)

| ファイル | 役割 |
|---|---|
| `screens/tutorial/TutorialLessonViewer.tsx` | 2ペイン化 + 左ペイン出し分け + hover 連動 activeKey + 実戦 CTA |
| `screens/tutorial/AnnotatedCard.tsx` (新) | 実 CardArt 拡大描画 + `CARD_REGIONS` 正規化矩形 region 強調 + `STEP_CARD_ANNOTATIONS` (ch2-1..2-4)。事件は landscape (116:84) |
| `screens/tutorial/TutorialBoardSnapshot.tsx` (新) | FitScaleBox (実測フィット縮小) で実 `<Playmat gameState={createSampleGameState()}>` を読み取り専用描画 + scoped zone highlight |
| `screens/tutorial/boardHints.ts` (新) | `STEP_BOARD_ZONES`: 各 board step の強調ゾーン (.scene-area.side-self 等) + ラベル |
| `util/tutorialResolvers.ts` (新) | resolveCard/Case/HandCard を共有 (RealMatchView も同 import に差替、挙動不変) |
| `screens/RealMatchView.tsx` | resolver 共有 import 差替のみ (挙動不変) |
| `screens/TutorialScreen.tsx` | `CHAPTER_TO_SRC_STEP` (meta章→src TUTORIAL_STEPS index) + `startGuided` (tutorialStore.setState + customGameStart) + CTA 配線 |
| `screens/SetupScreen.tsx` | 通常対戦起動時に `useTutorialStore.exit()` (overlay 漏れ防止) |

## 該当箇所強調 (region/zone hover 連動)

- 右ペイン一覧 hover ↔ 左の region/zone を共有 `activeKey` で pulse 強調 (該当=gold glow / 他=dim)
- card: `CARD_REGIONS[type]` の正規化 % 矩形 (公式レイアウト基準、Playwright 実画像で微調整)
- board: snapshot root 内 `querySelector(selector).getBoundingClientRect()` を outer 相対へ変換し box 描画

## ガイド付き実戦 (overlay 制御)

- 起動: `useTutorialStore.setState({currentStep: CHAPTER_TO_SRC_STEP[ch]})` → customGameStart → #match。RealMatchView 既存 `<TutorialOverlay/>` が該当 step を表示
- リセットは **非ガイド起動側で決定的に** 行う (startPractice / SetupScreen.handleReady で `exit()`)。
  ※ unmount cleanup での exit は React StrictMode の mount→cleanup→remount で currentStep を消すため不可 (検証で判明)

## 検証

- tsc green / e2e **29/29** (既存 25 + 追加 4: 盤面スナップショット / 横事件 / region 注釈 / ガイド実戦起動+overlay)
- Playwright 実機: 横事件カード (440×319) / region が AP「6000」LP「1」等に正対応 / hover で該当 region gold pulse / ch3 CTA→実戦+overlay「3フェイズで進む」/ console error 0
- `src/` git diff = 0

## 持ち越し (Phase 18+)

- 操作の正誤判定/ゲーティング (現状 overlay は手動 next) / 章別シナリオ盤面 / viewer スワイプ / バンドル分割

## 関連
- 前: [15-tutorial-lesson-viewer.md](15-tutorial-lesson-viewer.md)
- 実装: `meta-app/src/screens/tutorial/{TutorialLessonViewer,AnnotatedCard,TutorialBoardSnapshot,boardHints}.tsx` + `util/tutorialResolvers.ts`
