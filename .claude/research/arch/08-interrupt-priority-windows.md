# 08. 割り込み処理と優先権ウィンドウ

## 結論

**Priority Window（優先権ウィンドウ）モデル** を採用。
boardgame.io の `setActivePlayers` を土台に、各ウィンドウで「応答候補・タイムアウト・パス処理」を明示する。

## コナンTCG での割り込み発生箇所

- 相手のアクション宣言後 → **ガード**（防御側）
- 相手の事件アクション後 → **ヒラメキ**（防御側／証拠所有者）
- コンタクト中 → **カットイン / 変装**（両者・APNAP順）
- 相手の推理時 → **ミスリードX**（防御側）
- 任意のタイミング → **【相手ターン中】持ち能力**（非ターンプレイヤー）
- MR が現場リムーブ時 → **パートナーエリア移動**（自動・即時）

## 優先権ウィンドウのライフサイクル

```text
[Window 開始]
  ↓
[応答候補を全プレイヤー分計算]
  ↓
[setActivePlayers で応答可能プレイヤーを stage に切替]
  ↓
[タイムアウトタイマー開始]
  ↓
  応答あり → [効果スタック push] → 再帰
  応答なし → [Window 終了]
```

## 状態モデル

```typescript
interface PriorityWindow {
  id: string;
  trigger: TriggerEvent;                  // 何によって開いたか
  candidates: Record<PlayerID, ActionCandidate[]>;  // 各プレイヤーの応答候補
  apnapOrder: PlayerID[];                  // 応答順（active player first）
  currentResponder: PlayerID;
  passedBy: PlayerID[];                    // パスしたプレイヤー
  timeoutAt?: number;                      // タイムアウトの時刻
  resolved: boolean;
}

// G.priorityWindow: PriorityWindow | null
```

## キャンセル・ロールバック

- 応答候補が0件なら **即時自動パス** (UIに表示せず)
- ガード対象キャラが Window 中に消えたら Window を強制終了
- タイムアウトは「何もしない」(自動パス) として処理

## 公式裁定との整合

[22-qa-action-contact.md](../../rules/22-qa-action-contact.md) より、アクション処理は厳密に Window 化できる: アクション宣言→ガード判定(W1)→【現場リムーブ時】解決→コンタクト発生→1番目応答(W2)→2番目(W3)→1番目再行動(W4・条件付)。各ステップを Window として実装することで、公式裁定を逐語的に再現できる。

## AI への影響

- AI も Window で応答を求められる
- `enumerate` は Window 単位で「応答候補リスト + パス」を返す
- MCTS は Window を1ノードとして扱う

## UI への影響

- Window 開いた時点で UI に **応答可能カード/能力をハイライト**
- タイムアウト残時間を表示
- 「パス」ボタンを常に提示
- 応答候補0件で自動パスする場合、ユーザーには通知のみ表示

## 設定

ユーザー設定で以下を調整可能にする:

- 応答タイムアウト秒数 (10/30/60/無制限)
- 自動パス対象（応答候補0件 / 効果なし / すべて）
- 観戦時の Window スキップ設定

## 関連

- [02-effect-stack-patterns.md](02-effect-stack-patterns.md)
- [10-ai-playback-visualization.md](10-ai-playback-visualization.md)
- [../../rules/22-qa-action-contact.md](../../rules/22-qa-action-contact.md)

## 出典

- [boardgame.io setActivePlayers](https://boardgame.io/documentation/#/turn-order)
- [MTG Priority Rule (CR 117)](https://magic.wizards.com/en/rules)
