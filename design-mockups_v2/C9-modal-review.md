# C-9 — モーダルカタログ レビュー

`conan/design-mockups/03-modal-catalog.jsx` の **15 モーダル**(README は「16 種」表記ですがコード上は 15)をカテゴリ別に整理。各モーダルの目的・トリガー・データ依存・エンジン関数の対応をまとめる。

---

## カテゴリ 1: Confirm / Decision — 意思決定の確認

| # | モーダル | トリガー | 主要データ | エンジン関数 |
|---|---|---|---|---|
| **01** | **推理宣言** ConfirmModal | プレイヤーが推理ボタン押下 | パートナー / 対象事件 / 現在証拠 / +LP / ミスリード警告 | UIのみ(確認後 `engine.flow.action.reasoning`) |
| **02** | **捜査結果(Top-N 振り分け)** | カード効果でデッキ上 N 枚を公開 | 公開カード / 手札⇄底⇄除外 の3-way選択 | `engine.mutate.deck.peek` + `engine.mutate.hand.add` / `engine.mutate.deck.toBottom` |
| **03** | **マリガン** | ゲーム開始時の初期手札交換 | 5枚の初期手札 / 選択枚数 / 引き直し | `engine.mutate.hand.swap` + `engine.mutate.deck.shuffle` |
| **04** | **ターン終了確認** | 自分のターン終了ボタン | 使用アクション / 獲得証拠 / 手札数 / FILE進捗 / 未使用警告 | UIのみ(確定で `engine.flow.turn.end`) |

**設計パターン**: 4 つとも `m-panel` 共通レイアウト + JP/EN タイトル + 統計サマリ + プライマリ/ゴーストボタンの 2 択。

---

## カテゴリ 2: Reveal / Cinematic — 演出を伴う情報公開

| # | モーダル | トリガー | エンジン関数 |
|---|---|---|---|
| **05** | **コンタクト VS** | コンタクト判定発動時 | `engine.flow.contact.resolve` + 演出は `engine.event.on('contactResolved')` |
| **06** | **ヒラメキ** | カードが証拠からリムーブ + ヒラメキ効果あり | `engine._drainPendingHirameki` + `engine.effect.run` |
| **07** | **解決編スタンプ** | FILE が 7 枚揃った瞬間 | `engine.event.on('fileFull')` → `engine.mutate.case.toResolve` |
| **08** | **FILE 詳細** | FILE アイコン押下 | `engine.read.file(state, side)` |
| **09** | **リフレッシュ通知** | 自分の番のドロー前にデッキ≤3 | `engine.flow.auto-phase.refresh` |

**設計パターン**: 中央配置の cinematic ステージ。半透明背景 + 中央のバナー文字 + サブテキスト。BGM/SE の切替を想定したタイミング。

---

## カテゴリ 3: Conflict / Negative — 失敗・ペナルティ

| # | モーダル | トリガー | エンジン関数 |
|---|---|---|---|
| **10** | **ミスリード公開** | 推理宣言時、相手がミスリード保持 | `engine._drainPendingMisread` |
| **11** | **ブレット(射撃ダメージ)** | 銃撃キャラがアクション宣言 | `engine.effect.run(bulletCard)` + `engine.mutate.char.damage` |
| **12** | **ダメージ/KO** | LP ≤ 0 になった瞬間 | `engine.event.on('charKO')` → `engine.mutate.remove.add` |

**設計パターン**: 赤系のトーン。失敗/敗北の重みを演出。アニメーション(画面シェイク・赤フラッシュ)推奨。

---

## カテゴリ 4: Special / Interrupt — 割り込み・終局

| # | モーダル | トリガー | エンジン関数 |
|---|---|---|---|
| **13** | **変装解除** | 変装キャラがコンタクトされた | `engine.cond.disguiseTrigger` + `engine.mutate.char.reveal` |
| **14** | **カットイン割り込み** | 相手効果解決前にカットイン使用 | `engine.resolve.interrupt` + `engine.effect.run(cutInCard)` |
| **15** | **勝利 / Game Over** | `engine.read.gameResult ≠ 'ongoing'` | UIのみ → RESULT 画面へ遷移 |

**設計パターン**: 紫系(変装) / 金系(カットイン) / 金系大バナー(勝利)。

---

## 不足モーダルの提案

現状の 15 にプラスして、以下が必要そう:

| 提案 | 理由 | エンジン関数 |
|---|---|---|
| **16. 敗北画面** | 勝利と対になる「迷宮入り」モーダル(05 演出には既存) | `engine.read.gameResult === 'p2win'` |
| **17. ガード宣言モーダル** | 防御側がガードカードを選ぶ UI | `engine.flow.guard.declare` |
| **18. 名乗り解除確認** | 名乗り状態のキャラが行動する時の確認 | `engine.cond.namedRestriction` |
| **19. ネクストヒント** | 事件解決後、次の事件を選ぶ | `engine.flow.case.next` |
| **20. 観戦モード切替** | CPU vs CPU 時の速度/視点切替 | UI のみ |

→ **20 種にすれば一通り網羅** できる印象。

---

## 一貫性チェック

✓ 統一されている要素:
- ▼ + JP/EN 二段タイトル
- m-panel コンテナ + 角丸 + 金色アクセント
- m-btn-primary / m-btn-ghost / m-btn-blue の 3 種ボタン
- 統計表示は `lbl` + `val` のキー値ペア

⚠ 一貫性に課題:
- バナー文字のフォントサイズが個別最適化(統一基準なし)
- 「OK / 戻る」「キャンセル / 確定」の語順が混在
- VS 演出のサイズが「05 コンタクト VS」と 05 (effect-animations.html) の **Contact A/B** で別物

---

## メタゲーム側への取り込み判断

| カテゴリ | メタゲーム取込 |
|---|---|
| Confirm 系 | **取込推奨** — デッキ保存確認・ゲーム終了確認に流用可 |
| Reveal 系 | **取込不要** — 対戦専用 |
| Conflict 系 | **取込不要** — 対戦専用 |
| Special 系 | **15 のみ取込済** — RESULT 画面がこれを継承 |

→ メタゲームには `m-panel` / `m-btn-primary` のスタイルだけ移植すれば足りる(`06-shared.jsx` の SmallButton/SetupButton と統合可)。

---

## 推奨アクション

1. **共通モーダルコンポーネント** を 06-shared.jsx に追加(MetaModal + MetaModalActions)— 現状はモーダル不在
2. **デッキ削除確認** / **設定リセット確認** など、メタ側にも Confirm モーダルが必要
3. **ガード宣言モーダル(17)** を 03-modal-catalog に追加(ルール上必須なのに不在)
