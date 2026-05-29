# 06 — 主要対戦経路 (HOME / SETUP / RESULT)

## HomeScreen

### Props / 状態
- props: なし
- 読み取り: `useDecksStore.decks`, `useHistoryStore.list()`, `useMetaStore.settings`
- 副作用: なし

### レイアウト (`design-mockups_v2/06-home.jsx` 準拠)
- 上部: `<AppTopBar route='home' />` (64px)
- メイン:
  - 左レーン: ニュース / アップデート情報 (静的)
  - 中央: 戦績サマリ (winRate 表示) + 「推理開始」CTA (`SetupReadyButton`)
  - 右レーン: マイデッキパネル (decksStore リスト, 最大 3 件 + 「もっと見る」)
- 下部: 5 つの CTA タイル (DECK / CARDS / HISTORY / TUTORIAL / SETTINGS)

### 注釈
- 「これはデザインプロトタイプです」 footer を必ず表示 (実機ではないことを示す)
- 通貨表示 (GEM/COIN/ENERGY) は **削除** (`design-mockups_v2/memory.md` 命名規則準拠)

---

## SetupScreen

### Props / 状態
- props: なし
- 内部 state: `selfDeckId` / `oppDeckId` / `mode` ('solo' | 'observe')
- 読み取り: `useDecksStore.decks` + 固定 SAMPLE_DECK
- 書き出し: なし (READY 押下時に `engineStub.flow.simulateMatch` 呼び出し → MATCH へ遷移)

### レイアウト (`design-mockups_v2/08-setup.jsx` 準拠)
- 上部: TopBar + 戻るボタン
- 中央: モード選択 (SOLO INVESTIGATION / OBSERVE MODE)
- 中央下: デッキ選択 2 ペイン (自分 / 相手 or AI vs AI)
- 下部: `<SetupReadyButton>` (シェブロン形)

### 命名規則 (`design-mockups_v2/memory.md` 準拠)
- 人間 vs CPU → **SOLO INVESTIGATION (単独捜査)**
- CPU vs CPU → **OBSERVE MODE (観察ルーム)**
- HUMAN / CPU バッジ → DETECTIVE / AI

### 遷移
- READY → URL `#match` + simulateMatch 開始 (画面側で loading 表示 → 即 `#result` へ)

---

## ResultScreen

### Props / 状態
- props: なし
- 内部 state: 直前の `MatchRecord` (sessionStorage 経由で MATCH→RESULT 受け渡し、または historyStore.byId 直前 ID)
- 読み取り: MatchRecord 詳細
- 書き出し: なし (記録は MATCH 経路で完了済み)

### レイアウト (`design-mockups_v2/08-result.jsx` 準拠)
- バナー: 真相解明 (勝利) / 迷宮入り (敗北)
- 中央: MVP カード + 統計 (turns / contacts / hirameki / misread / evidGot / evidLost / p1Target / p2Target)
- CTA: 「次の対戦」(setup) / 「このデッキで再戦」(match 再実行) / 「盤面を見直す」(replay) / 「ホームへ」(home)

### F-rule-audit 反映
- `targetEv` を `p1Target` / `p2Target` 表示に変更 (固定 4 ではなく実値 7/6)
- 「証拠 N/{target}」表記、target は match record 由来

### MVP 算出ロジック (UI のみ、engine 非依存)
- contacts / hirameki / misread の合計を「貢献度」として算出、最高値カードを MVP
- なければ「MVP なし」表示

## 共通スタイル
- 全画面 `<MetaBg theme='noir' scene={route}>` でシーン別背景
- ボタンは `meta-btn-*` CSS クラス + `Button.tsx` の 5 種
- ホバー: `meta-card-hover` (4px 浮 + 拡大 1.03 + 金グロー)

## 関連
- 前: [05-engine-stub.md](05-engine-stub.md)
- 次: [07-screens-library.md](07-screens-library.md)
- 原典: `design-mockups_v2/06-home.jsx` + `08-setup.jsx` + `08-result.jsx`
