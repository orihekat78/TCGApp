# 公開対局: 一手理由ログ

自分の正規手札は `player-visible`。双方公開の情報は `shared-public`。
相手hidden名、内部状態、推測した山札順は書かない。

```text
T{turn}/{phase} | mode:{shared-public|player-visible|hidden-range}
observe: {evidence, incident, partner, named, hand, board, last-log}
options: A {source IDs; expected delta}; B {source IDs; expected delta}
choose: {A/B/pass} | why:{clock/board/hand/risk/option} | falsify:{condition}
after: {visible result/log} | status:{confirmed|unknown-ui|blocked-ui-rule-mismatch}
```

## 規則

- `options` は最低2候補。1候補なら `only rule/UI candidate`。
- ルール/カード主張にはsource IDとファイル又はカードIDを付ける。
- `player-visible` の自分の手札は判断根拠に使えるが、共有公開とは呼ばない。
- `hidden-range` は可能性、根拠、外れた時の損失を添える。確定名を書かない。
- 任意効果、対象、カットイン、Next Hint、終了を独立選択として残す。
- `after` は事後観測。`why` の上書きは禁止。
