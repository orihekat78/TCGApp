# C — 画面 ↔ エンジン API 接続マップ

各 UI 画面が呼び出す engine 関数を整理。`conan/src/engine/index.ts` の public namespace を基準。

エンジン namespace 一覧:
`read` / `mutate` / `invariant` / `event` / `effect` / `dyn` / `target` / `cost` / `cond` / `resolve` / `flow` / `cards`

---

## 1. HOME (ホーム画面)

| UI 要素 | エンジン呼び出し |
|---|---|
| RECENT 戦績 | localStorage(`match-history`) のみ。エンジン非依存 |
| マイデッキパネル | `engine.cards.validateDeck(deck)` — 各デッキの合法性チェック |
| CASES 章進捗 | localStorage(`campaign-progress`)。エンジン非依存 |
| **推理開始 →** | `engine.flow.setup.createMatch(p1, p2)` で初期 state 生成し SETUP へ |

---

## 2. SETUP (対戦準備)

| UI 要素 | エンジン呼び出し |
|---|---|
| デッキ選択 | `engine.cards.validateDeck` で再検証 |
| パートナー表示 | `engine.read.partner(state, side)` |
| READY · 推理開始 | `engine.flow.setup.startMatch(state)` → `engine.flow.turn.begin(state)` → MATCH へ遷移 |
| 戻る | state を破棄 |

---

## 3. MATCH (対戦) — エンジン依存が最も濃い

### 状態読み取り
- `engine.read.hand(state, side)` — 手札
- `engine.read.scene(state, side)` — 現場のキャラ
- `engine.read.case(state, side)` — 事件カード
- `engine.read.evidence(state, side)` — 証拠スタック
- `engine.read.file(state, side)` — FILE エリア
- `engine.read.remove(state)` — リムーブエリア
- `engine.read.deck(state, side)` — デッキ残数
- `engine.read.activePlayer(state)` / `phase(state)` — ターン情報
- `engine.read.gameResult(state)` — 勝敗判定

### 手番進行
- `engine.flow.turn.begin/end(state)` — ターン境界
- `engine.flow.auto-phase.run(state)` — 自動フェーズ(リフレッシュ・ドロー)
- `engine.flow.main.*` — メインフェーズアクション処理

### プレイヤーアクション
- **キャラ召喚**: `engine.mutate.scene.add(state, char)` + `engine.cost.pay(state, cost)`
- **推理(リーズニング)**: `engine.flow.action.reasoning(state, char)` — スリープ + 証拠 +LP
- **アクション[事件]**: `engine.flow.action-case.attack(state, char, target)` — ガード判定含む
- **コンタクト**: `engine.flow.contact.declare(state, attacker, defender)` + `engine.flow.contact.resolve(state)`
- **ガード**: `engine.flow.guard.declare(state, guardCard)`
- **カットイン**: `engine.effect.run(state, cutInCard)`
- **手札の使用 (色一致)**: `engine.cond.colorMatch(state, card)` 判定

### イベント / 効果スタック
- `engine.event.dispatch(state, event)` — 効果発火
- `engine.resolve.next(state)` — 効果スタックの次の解決
- **ヒラメキ**: 自動 listener (`registerHiramekiListener`)が `engine.event.on('cardRemoved')` を購読
- **ミスリード**: 自動 listener (`registerMisreadListener`)
- `engine._drainPendingHirameki(state)` — UI でモーダル表示後の処理

### 妥当性検証
- `engine.invariant.checkAll(state)` — 不変条件チェック(デバッグ用)
- `engine.target.valid(state, source, target)` — ターゲット指定の妥当性
- `engine.cost.canPay(state, cost)` — コスト支払可能か

### 勝敗判定
- `engine.read.gameResult(state)` — 'p1win' / 'p2win' / 'draw' / 'ongoing'
- → 'ongoing' 以外なら RESULT へ遷移

---

## 4. RESULT (対戦結果)

| UI 要素 | エンジン呼び出し |
|---|---|
| 勝敗 | `engine.read.gameResult(state)` |
| MVP カード | UI ロジック(エンジン非依存)— ログから集計 |
| 統計サマリ | `engine.event.history(state)` から集計 |
| 進捗反映 | localStorage 更新(campaign / win rate) |
| 次の対戦 → | state 破棄 → SETUP へ |

---

## 5. DECK (デッキ編集)

| UI 要素 | エンジン呼び出し |
|---|---|
| カードリスト | `engine.cards.all()` — 全 47 枚のメタ |
| カード追加 | UI 状態のみ。保存時に `engine.cards.validateDeck(deck)` |
| 検証バナー | `engine.cards.validateDeck(deck)` — 40枚 / ID3枚 / 色 / etc. |
| テスト対戦 | `engine.flow.setup.createMatch` + dummy P2 → MATCH |
| 保存 | localStorage 永続化 |

---

## 6. CARDS (カードリスト / コレクション)

| UI 要素 | エンジン呼び出し |
|---|---|
| カードグリッド | `engine.cards.all()` |
| カード詳細 | `engine.cards.byNum(num)` |
| キーワード抽出 | カードメタの `keywords` |
| 採用デッキ | localStorage の保存デッキを走査 |

---

## 7. HISTORY (対戦履歴)

| UI 要素 | エンジン呼び出し |
|---|---|
| マッチリスト | localStorage(`match-history`) |
| 勝率集計 | UI 集計のみ |
| マッチアップヒートマップ | 履歴から計算 |
| 詳細 → REPLAY | 履歴エントリの `replayLog` を渡す |

---

## 8. REPLAY (リプレイ)

| UI 要素 | エンジン呼び出し |
|---|---|
| 盤面再生 | `engine.event.replay(state, log)` — ログを順次適用 |
| スクラバー | 任意位置までの `engine.event.applyUntil(state, log, t)` |
| ログ表示 | `engine.event.format(event)` |

---

## 9. TUTORIAL (チュートリアル)

| UI 要素 | エンジン呼び出し |
|---|---|
| 章本文 | エンジン非依存(.claude/rules/ 由来) |
| 練習試合 | `engine.flow.setup.createTutorialMatch(scenarioId)` — 事前定義シナリオ |
| ヒラメキ流れ図 | 静的説明 |

---

## 10. SETTINGS (設定)

エンジン依存なし。localStorage / 表示設定のみ。`engine.read` の `version()` を SYSTEM パネルに表示する程度。

---

## モーダル 16 種(`03-modal-catalog.html` 参照)

UI モーダル → エンジン関数の対応:

| モーダル | エンジン関数 |
|---|---|
| GameSetupModal | `engine.flow.setup.createMatch` |
| MulliganModal | `engine.mutate.hand.swap` + `engine.mutate.deck.shuffle` |
| ConfirmModal (汎用) | UI のみ |
| HiramekiPickerModal | `engine._drainPendingHirameki` → `engine.target.valid` → `engine.effect.run` |
| MisreadPickerModal | `engine._drainPendingMisread` → `engine.effect.run` |
| GuardPickerModal | `engine.flow.guard.declare` |
| CutInDisguisePickerModal | `engine.effect.run(cutInCard)` |
| SceneSwitchPickerModal | `engine.mutate.scene.swap` |
| SouzaReorderModal | `engine.mutate.deck.reorder` |
| EffectStackPanel | `engine.resolve.peek(state)` |
| VictoryOverlay | `engine.read.gameResult` |
| RefreshOverlay | `engine.flow.auto-phase.refresh` |
| OppTurnOverlay | `engine.read.activePlayer` |
| ContactFlash | `engine.event.on('contactResolved')` |
| RecentActionToast | `engine.event.history(state).slice(-1)` |
| TutorialOverlay | エンジン非依存 |

---

## まとめ: 依存度マトリックス

| 画面 | engine 依存度 | リアルタイム性 | 主な namespace |
|---|---|---|---|
| HOME | ★ | low | cards |
| SETUP | ★★ | low | flow.setup, cards |
| **MATCH** | **★★★★★** | high | **すべて** |
| RESULT | ★★ | low | read |
| DECK | ★★ | low | cards |
| CARDS | ★ | low | cards |
| HISTORY | ☆ | none | (localStorage) |
| REPLAY | ★★★ | medium | event, resolve |
| TUTORIAL | ★ | low | flow.setup (練習試合のみ) |
| SETTINGS | ☆ | none | (なし) |

**MATCH 画面のみが engine の全 12 namespace をフル活用** する。他の画面は `cards` と localStorage 中心で、エンジン本体への依存は薄い。

→ プロトタイプとしては、MATCH 以外は engine 抜きでもほぼ完全に動作可能。MATCH の実装は `conan/src/ui/components/Playmat.tsx` 系で完結している。
