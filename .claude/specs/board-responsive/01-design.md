# 対戦盤面フルード化（白画面/レターボックス解消）設計

> 状態: ドラフト / 2026-06-16 / branch `worktree-ui+board-responsive-fill`
> 関連: [BUG-150](../../bugs/BUG-150.md) / 検証=Playwright実機 / エンジン・deck-builder 不変

## 1. 背景・問題

対戦盤面 (`src/ui/`) は **1920×1080 固定 `.stage`** を `.scaler` の
`transform: scale(min(vw/1920, vh/1080, 1))` で縮小表示する「contain（レターボックス）」方式。

- `html/body/#root` に背景色が無く、盤面外に**ブラウザ既定の白**が透ける
- `.scaler` が `transform-origin: top left` で左上固定 → 余白が**右に偏って白帯**化
- `scale` 上限 1.0 のため大画面でも盤面が design サイズ止まり
- 既知不具合: `position:fixed` モーダルが transform 親内にあり viewport 基準にならない

ユーザー要望: **固定設計を撤廃し、横長ウィンドウいっぱいに帯ゼロで充填**。

## 2. ゴール / 非ゴール

- ゴール: ローカルPC横長ウィンドウ（〜16:9前後）で **白ゼロ・ダーク帯ゼロ・全ゾーン表示・モーダル正常**。
- 非ゴール: 超ワイド/縦長/モバイルの完全最適化（**崩れず表示する graceful のみ**保証）。本アプリは
  ローカルPC専用（CLAUDE.md 法務スタンス）のため YAGNI。
- 不変: ゲームロジック / エンジン / deck-builder / JSX のゾーン構造。

## 3. 現状の鍵（調査結果）

盤面内部は既に大部分が **fr グリッド**で流動的:
`.play-area`(`36px 1fr 1fr`) / `.mat`(`150px 1fr 120px`) / 各 col(`1.4fr 1fr` 等)。
「固定設計」の実体は (a) `.stage` 固定px+`transform:scale`, (b) 端の絶対オフセット
(`.play-area right:232` / `.hand-zone` / `.narrator-msg` / `.actions-panel width:200`),
(c) カードタイル固定px(約150箇所、多くは tokens.css/ゾーンvar 経由), (d) モーダル position:fixed。

## 4. 設計（Approach 1 → 実装: zoom フィル方式、touched 4 ファイル）

> 当初想定は「マクロ grid 化 + カードサイズ `calc(*--ui-scale)`」だったが、実装では
> **既存の absolute/fr レイアウトを保ったまま `zoom` で一括充填**する方式を採用。ゾーン CSS・
> 固定 px は一切不変で、touched は 4 ファイルのみ（最小 touched / 挙動不変に最適）。

1. **ルートダーク化**: `html, body, #root { margin:0; width:100%; height:100%; background:var(--bg-deep); }`、
   `#root { overflow:hidden }`（[tokens.css]）。
2. **stage 全面化**: `.stage` の固定 1920×1080 と `.scaler` transform を撤去 → `width/height:100%`。
   - 副次効果: `position:fixed` が viewport 基準に戻り**モーダル位置不具合も解消**。
3. **board-content 層 + zoom フィル**: 盤面コンテンツ（bg/topbar/play-area/hand-zone/ActionsPanel）を
   `.board-content` でラップし、Playmat.tsx の inline `style={{ zoom: useStageScale() }}` を適用。
   CSS は `width/height:100%` 固定（**zoom が % 基準を W/s に拡大するため 100% で丁度 viewport 充填**。
   `100/s%` は s 二重割り=`W/s²` で右下が overflow し ActionsPanel/ターン終了が見切れるため不可）。
   既存 absolute/fr と固定 px は不変のまま zoom が比率維持で一括スケール。
   - modal/overlay は `.board-content` の外（`.stage` 直下・非 zoom）に置き viewport 基準を維持。
4. **useStageScale**: `min(vw/1920, vh/1080)` を `clamp(0.2, …, 1.6)`（MAX=soft-cap でカード画像ボケ回避）。
   transform は出力せず、戻り値を board-content の `zoom` に使用。

## 5. 実装フェーズ（段階・各フェーズ実機検証）

- **A**: ルートダーク化 + stage全面化 + マクロgrid化 + transform撤去 + `--ui-scale`駆動。「埋まる/モーダル正常/全ゾーン可視」。
- **B**: `--ui-scale` の floor/ceiling・フォント・ActionsPanel 内部微調整、各ビューポートの見栄え。
- **C**: エッジ（超ワイド/狭幅で非破壊・hand展開・opp mat 180°・sleep/stun回転・SpectatorHUD重なり）。

## 6. 検証（必須）

Playwright で CPU対戦(観戦)展開し **現行 / 1366×768 / 1920×1080 / 1920×1200 / 2560×1440 / 3440×1440 / 狭幅**
でスクショ。確認: 白0・帯0(極端比はダーク graceful)・全ゾーン・モーダル中央・hand展開・**console error 0**。
加えて人間vsCPU 1試合通し（CLAUDE.md セルフレビュー）。

## 7. リスク / ルール網羅性

- 最大リスク: absolute→grid のマクロ改修（中）。ゾーン単位フォールバック可（問題ゾーンは充填stage内 absolute 維持）。
- ルール網羅性: 本変更は**視覚レイヤのみ**。rules/01〜30 はゲーム進行規則であり **out of scope（ロジック不変）**。
- 状態完備性: GameState→UI の対応関係は不変（描画位置のみ変更）。
- 分離: worktree ブランチ隔離 / smoke・CI green 確認 / BUG-150 登録。
