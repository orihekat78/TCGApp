# CPU 行動可視化 — 解決案候補 (BUG-059 / user_request 20260522_01 #15)

## ユーザー指摘

> #15: 人間vsCPUの時もCPU側の処理が早くてわかりずらい。何かしら行動するたびに、
> 「何とかのカードが何とかを行いました」みたいなポップを表示させたほうがいいの
> かな？それはそれでうざったいよな、、、ほかのカードゲームアプリではどのように
> しているのかな？しらべてみて、今回の課題解決案をいくつか出してほしい

## 現状の実装

| 仕組み | 配置 | 状態 |
|--------|------|------|
| **OppTurnOverlay** (`src/ui/components/OppTurnOverlay.tsx`) | 画面中央オーバーレイ | BUG-046 で attacker / target / phase を具体表示済。ただし「アクション解決中」というフェーズ表示のみで、個別 move (推理 / アシスト / 手札使用) は反映されない |
| **RecentActionToast** (`src/ui/components/RecentActionToast.tsx`) | 画面上部トースト | log の最新エントリを 2.2 秒表示。actionLabel + target 名 |
| **LogPanel** (`src/ui/components/LogPanel.tsx`) | LOG ボタンで開く | アクション履歴一覧、過去確認用 |
| **CutInDisguisePickerModal / GuardPickerModal** | contact 中 modal | BUG-046/055 で attacker name 等を表示 |
| **SpectatorHUD** (`src/ui/components/SpectatorHUD.tsx`) | 観戦専用 | speed slider + pause/step、BUG-047/058 |

## 業界他社の方式 (検討メモ)

> 注: ユーザー指摘の「他のカードゲームアプリではどのようにしているか」へのリサーチ。
> Anthropic 学習データ知識ベース (2026年1月時点) と公式公開情報からの一般化記述。

### A. Hearthstone (Blizzard)
- **ターン中央バナー**: 自/相手ターン開始時に「相手のターン」テキスト + ライン演出
- **行動アニメーション**: カードが手札からプレイされる時、カードが場へ「投げ込まれる」物理ベース演出 (0.5-1.0 秒)
- **エンドターンタイマー**: 相手の砂時計が回って残り時間可視化
- **History panel**: 右側に直近 5-6 件のミニカード表示で「相手が何を出したか」即座に把握可能
- **重大な action** (例: ヒロイック発動) は **対戦相手も含めた全画面演出** (1.5-3 秒)

### B. Shadowverse (Cygames)
- **相手ターン時のカード使用アニメーション**: 約 0.8 秒の演出 + voice (任意 mute 可)
- **イベント発動演出**: カード絵柄を中央拡大表示で 1 秒
- **エフェクト履歴**: 画面右側に直前 3 件のエフェクトをミニカード化
- **「相手考え中…」** のテキスト + 砂時計アイコン (短い思考時)

### C. MTG Arena (Wizards of the Coast)
- **Phase 表示**: 画面左に現在 phase の「歯車」UI 常時表示。相手 phase は赤く強調
- **Stack 表示**: 効果スタック (mana cost / target) を画面中央に visual 蓄積
- **History sidebar**: 右側「Game History」で全 turn の summary 表示
- **Stop on each step** オプション: ユーザー設定で「相手の各 phase で待機」可能 (上級プレイヤー用)

### D. ポケモン TCG Live
- **キャラクターアニメ**: ポケモン登場 / リムーブ時の絵柄演出 (1 秒)
- **ターンタイマーバー**: 上部画面に sliderで残り時間を可視化
- **チャット定型句**: 「相手の番です」「考え中です」を相手に送る emote 機能

### E. UNO (Mattel) / 軽量カードゲーム
- **シンプル直視**: アニメ最小、テキストポップ「Player 2 が UNO!」のみ
- **音声トリガー**: 行動音 (カードめくり音 / 効果音) で即座フィードバック

## 解決案 (案 1〜4)

### 案 1: **MoveActionToast** 強化 (RecentActionToast 拡張)
- **概要**: 既存 RecentActionToast を「CPU の各 move (推理 / アシスト / 手札使用 / etc)」ごとに 1.5-2.0 秒表示。`onTurn` hook で per-move enumeration し dispatch
- **長所**: 既存インフラ流用、最小工数
- **短所**: 「動作直後トースト」は既に存在するため重複感ある
- **規模**: S (50-100 行)

### 案 2: **CPU 行動 step pause** (オプション)
- **概要**: ユーザー設定で「CPU 各 move 後に X 秒 wait」を追加。SpectatorHUD slider を人間 vs CPU でも展開
- **長所**: ユーザーが速度を任意調整、観察可能性向上
- **短所**: ユーザー体感が遅くなる (任意 ON で回避)
- **規模**: M (100-150 行) — store + ActionsPanel / OppTurnOverlay 統合

### 案 3: **GameHistorySidebar** 右側パネル (MTG Arena 風)
- **概要**: 画面右側に「直近 5-10 件の move 履歴」を常時表示 (LogPanel の縮小版常設)。各 entry に turn / player / action / target
- **長所**: 「相手が何をしたか」一目で把握、リプレイ感覚
- **短所**: 画面領域消費、Playmat レイアウト見直し必要
- **規模**: L (200-300 行) — 新 component + Playmat grid 改修

### 案 4: **行動カードアニメ** (Hearthstone 風、カード移動演出)
- **概要**: CPU が手札からカードを使用するとき、カードが手札 → 中央 → 該当エリアへ 0.5 秒で物理的に移動するアニメ
- **長所**: 視覚直感性最高、「何が起きたか」即座にわかる
- **短所**: 実装重量大、CardArt 移動アニメの管理が複雑
- **規模**: XL (500+ 行) — 新 animation 層 + 状態 sync ロジック

## 推奨

**Phase 1 (即時、本 BUG セッション)**: 案 2 + 案 3 のミニ版 (LogPanel を上部に「直近 3 件」プレビュー化) が ROI 高い

**Phase 2 (将来)**: 案 4 アニメは別 BUG として scope 分離

## 次フェーズ実装プロモート選択

ユーザーの選択を待つ:
- [ ] 案 1 MoveActionToast 強化
- [ ] 案 2 CPU 行動 step pause
- [ ] 案 3 GameHistorySidebar
- [ ] 案 4 行動カードアニメ
- [ ] 複数組み合わせ (要詳細指定)

## 関連

- user_request 20260522_01 #15
- BUG-046 (OppTurnOverlay attacker/target 表示)
- BUG-055 (cutin actor 名表示)
- plan: `C:\Users\arumi\.claude\plans\3-user-request-glowing-porcupine.md`
