# YOU vs CPU 公開UI対応表

UI候補は合法性の手掛かり。ルール根拠ではない。不明表示は `unknown-ui`。

| UI | 情報mode | ルール上の意味 | 確認 |
|---|---|---|---|
| ターン/フェイズ | shared-public | 行動時機 | 手札使用、推理、アクション可否。 |
| 事件/証拠/解決表示 | shared-public | 勝敗時計 | 必要数、事件面、次ターン勝利。 |
| パートナー状態 | shared-public | アクティブ/スリープ/アシスト | 事件解決、推理、アクション可否。 |
| キャラ状態/AP/LP | shared-public | 名乗り、推理、接触 | 状態と迅速・突撃等の本文。 |
| 自分の手札 | player-visible | 正規に使える自分の情報 | 通常枠、cut-in、Next Hint後の札。 |
| 相手手札枚数 | shared-public | resource量だけ | 内容はhidden-range。確定しない。 |
| 裏向きFILE/証拠 | hidden-range | identity不明 | 表示や位置から識別しない。 |
| 対象tray/modal | shared-public UI | UI提示候補 | 本文対象、任意なら選ばない。 |
| cut-in/反応表示 | shared-public UI | 応答窓 | AP差、1枚制限、pass後の順序。 |
| 履歴/結果 | shared-public | 解決済み事実 | 予測差。ex ante理由は変えない。 |

## 操作

1. 操作前に盤面、証拠、状態、手札、直近ログをmode付きで記録する。
2. packet本文からrule候補を作り、UI候補と照合する。
3. クリック後に同じ項目とログを再読する。
4. 候補欠落、説明不足、停止は保存して中止する。

禁止: dispatch、state注入、pending参照、相手hidden、裏向き識別、直接URL復旧。
接続停止2回連続時だけ新規ブラウザ。再開は `#setup`。
