## Engine 拡張 #4 sceneToHand batch #3 — 2 枚 (engine 変更 0)

**Round/Phase**: 2026-06-05 session batch #3 拡充

batch #1 (2枚) + #2 (5枚) に続いて、sceneToHand 残から choice + bounce option を含む
B06007/B06007P 灰原哀を batch #3 として追加。engine 変更ゼロ。

### 実装カード (2 枚)

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B06007 | 0632 | 灰原哀 (R) | a1 ミスリード1 + a2 enter【パートナー青】 3択 choice (突撃付与 / 相手 lv≤7 bounce / 2 ドロー) |
| B06007P | 0632 | 灰原哀 (RP) | 同 |

### choice + sceneToHand 適用例

```ts
effect: {
  kind: 'choice',
  chooser: 'self',
  options: [
    { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
    { kind: 'atom', verb: 'sceneToHand', args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
  ],
},
```

choice の各 option が単独 atom で、UI 側で 3 つ目のいずれかを選択可能。
chooser='self' なので人間/AI の選択経路が共通動作する。

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest 1780 pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass
- pre-commit hook SKIP 不要で clean に通過

### ALL_CARDS

911 → 913 枚 (+2)

### 残課題 (sceneToHand 残)

- B01047/P 黒羽快斗 (action 終了時 self-deck-bottom + grant turn-end-bounce 多段) — DEFER
- B01067/B03070 メアリー系 (action[事件]→evidence gain hook) — engine 拡張要 DEFER
- B01092/P 松田陣平 (replace-on-leave) — DEFER (replace kind)
- B03110 ジン (自分ターン終了時 + FILE→hand + discard 2 + remove all chars) — 複雑、batch #4 可能
- B07008 小嶋元太 (FILE5 enter + optional self-sleep + bounce) — optional self-sleep 構造
- B08081/B08081P 広田雅美 (解決編 enter + optional discard + bounce / 別 ability 無効化系) — partial 可能
- B08014/P 毛利蘭 (action 後 turn-end self-bounce 効果付与) — 複雑
