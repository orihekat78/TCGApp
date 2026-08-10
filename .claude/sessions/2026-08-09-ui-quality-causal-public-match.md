# UI品質・因果表示プログラム（2026-08-02〜09）

## 固定方針

- 初見プレイヤーの理解性、操作性、アクセシビリティを最優先にする。
- プレイマットの構造は維持し、横画面モバイルも同じ構成を縮尺して使う。
- HOMEからSETTINGSまで共通Headerと標準外観を使い、ゲーム開始だけを強調する。
- カード固有演出ではなく、発生源・対象・順序・結果を示す共通処理演出を先行する。
- 実利用者8名の形成的調査は技術実装完了後に実施し、実施前の改善率は主張しない。

## 画面実装

- HOMEは公式NEWS／最近の対戦と使用デッキstageを20/80で構成した。
- SETUPはPLAYER／CPUと中央設定列を維持し、デッキ選択を確定型dialogにした。
- CARDSは検索・sort・view・格納filterに限定し、print関係をindexed graphで表示する。
- DECKは双方向drag/drop、カード詳細、partner／case変更、cost／type集計を統合した。
- HISTORYは対戦時点の公開デッキsnapshotを保存し、PLAYER／CPU比較とcode copyを提供する。
- REPLAYは閲覧専用投影、RESULTは確定summary、TUTORIAL／SETTINGSは共通基盤へ移行した。
- 1440x900、1280x800、1024x768、851x393、720x393を独立viewportとして扱う。

## 因果・Replay境界

- legacy logとversion付きcausal eventを正規化し、ID・session・sequence・parentを一元化した。
- presentation queueはsession単位、上限64、hidden復帰summary、terminal 3秒排出を持つ。
- presentation pause／step／skipはAI設定と分離し、engine actionをdispatchしない。
- Replay artifactはlive resolver continuationを除く閲覧専用projectionとして記録する。
- Replay load／seekはqueueと一時runtimeを再構築し、live match driverを動かさない。
- 人間decision所有者とautonomous decision gateを共有化し、15種の未解決surfaceを止める。

## 水平修正

- Contact／CPU／spectator driverの個別pending判定を共有selectorへ統合した。
- hand-useは確認前後とswitch対象確定後にinteraction ownershipを再検証する。
- switch pickerは親effect pick／choiceを許可し、競合decisionだけで一時停止する。
- 小さいカード画像では詳細操作を画像外へ出し、disabled状態をsemanticにも公開する。
- Presentationの公開Skipをfull-match smokeでも使用し、private stateや直接dispatchを廃止した。
- 公開ターン表示から全体ターンを算出し、ランダム先攻時の30ターン偽陽性を除去した。
- 観戦時のhuman side `null`を`self`へ戻さず、非公開deck revealをfail closedにした。
- 720x393 HOMEも20/80 railを維持し、CARDSのprint識別文字を10pxへ引き上げた。

## 検証（最新）

- typecheck、lint、production build、meta buildは通過。
- Vitestは923 files／7552 tests通過、5 files／197 tests skipped、失敗0。
- 公開`#setup`起点human-vs-CPUはrepeat 2/2通過、console error 0。
- MATCH visual gateはdesktop／mobile-chromium合計12/12通過。
- Presentation Skipの独立再レビューはCritical／Important 0。
- HOME／CARDS関連E2E 23/23、隠し情報／因果／Replay関連173/173通過。

## 未完了

- 全コード対象の敵対的、engine、Visual Craft、UX、visual QA、test reviewを完了する。
- 手書き記録確定後に`npm run docs`、`npm run docs:check`、`git diff --check`を行う。
- 実利用者8名の調査は外部実施待ち。準備物は`formative-study-package.md`に置く。
- commit／push／mergeはユーザーの明示依頼まで行わない。
