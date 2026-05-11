# 00. 動画解析計画書（次セッションで実行）

## 目的

公式チュートリアル動画 + 対戦動画から、ルール理解の補強と
UX/AI可視化の設計素材を抽出する。

## 対象動画（計14本）

### A. 公式ルール解説シリーズ（11本・チュートリアル設計の参考）

再生リスト: <https://www.youtube.com/playlist?list=PLxqqusNOt-vFX6Npd8Km3I38TPHpirqxu>

1. JY5Ltx7fP-M — 【ゲスト ふくらP】スペシャル配信
2. FIbGuJWdwNw — 【初心者必見】ルール・遊び方
3. jIvnx9qREyM — パートナーカードの使い方
4. c1dkGthgkNY — フェイズ説明
5. LfO30cmnPDI — 推理とアクション
6. lVyM4mIvwxE — コンタクト
7. Li8D1trbVV4 — ガード
8. q_qyWva7WlE — ネクストヒント
9. XtQa2HsOQxY — カードショップでの買い方
10. 16sMT4hrDFk — 公認店のイベント参加
11. z4s612h-4K0 — 超簡単ルール解説

→ 出力先: `.claude/research/tutorial/` （チュートリアル設計の素材）

### B. 直近の対戦動画（3本・UX/AI可視化の参考）

1. 15ljHQuh7Hk — 【ASOVIVA】チャレンジ戦1回戦（30分）
2. 2-tc_vfFhQQ
3. L_1DIgUH2uc

→ 出力先: `.claude/research/ux/` （UX・AI可視化）

## 取得仕様

- 解像度: **1920x1080**（ブラウザビューポート）
- 動画モード: **シアターモード or フルスクリーン**（`t` キーまたは `f` キー）
- スクリーンショット間隔: **30秒**
- 形式: PNG
- 一時保存先: `.tmp/video-frames/<videoId>/<sec>.png`

## 字幕取得仕様

- 自動生成字幕（日本語）を取得
- 取得方法:
  1. ページHTMLから `captionTracks` を含む `ytInitialPlayerResponse` を抽出
  2. `baseUrl` から timedtext を fetch
  3. XML/JSON をパースしてテキスト化
- 出力: `.tmp/video-captions/<videoId>.txt`（タイムスタンプ付き）

## 解析の観点

### A シリーズ（ルール解説・チュートリアル設計用）

- 各概念をどの順序で導入しているか
- 図解・アニメーションの使い方
- 説明の長さ（短い章 = 何秒くらいか）
- 例示の多さ
- 視聴者への問いかけ・確認方法

### B シリーズ（対戦動画・UX用）

- 1ターンあたりの平均時間
- 思考時間の長短パターン
- カード配置の物理的な動作
- 効果発動時の確認動作
- ルール疑問発生時の解決フロー
- 観戦者向け解説のタイミング（あれば）

## 出力ファイル

- `.claude/research/tutorial/01-curriculum-design.md`（A群: 学習段階構成）
- `.claude/research/tutorial/02-step-by-step-flow.md`（A群: 公式の説明順）
- `.claude/research/tutorial/03-visual-conventions.md`（A群: 図解・アニメ慣例）
- `.claude/research/ux/01-match-rhythm.md`（B群: テンポ）
- `.claude/research/ux/02-physical-to-digital.md`（物理マットのデジタル化指針）
- `.claude/research/ux/03-confirmation-points.md`（確認動作）

## トークン見積もりと分割実行

A群 11本×~20枚 + B群 3本×~60枚 = 計 ~400枚 × ~2000トークン = ~80万トークン。
**4セッションに分割推奨**: A群前半5本 / A群後半6本 / B群1本目 / B群2-3本目。

## 字幕先取りの推奨

字幕は画像より軽量（〜数千文字/動画）。先に全14本の字幕を取得し、内容把握後に「重要箇所だけスクショ」する適応的アプローチも検討。

## 関連

- [../../CLAUDE.md](../../CLAUDE.md)
- [../arch/10-ai-playback-visualization.md](../arch/10-ai-playback-visualization.md)
