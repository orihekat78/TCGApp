## Engine 拡張 #5b charSetCard batch #2 — 6 枚 (engine 変更 0)

**Round/Phase**: 2026-06-05 session 残課題対処 — 優先度 中 #6

batch #1 (B08054 + B02023 / 2026-06-05 早朝) に続いて、charSetCard fromDeckTop 利用カード
残から 6 枚を batch #2 として実装。engine 変更ゼロ。

### 実装カード (6 枚)

| ID | No | カード名 | 効果 | 注記 |
|----|---|---|---|---|
| B02020 | 0190 | 大岡紅葉 (SR) | a2: 【登場時】相手 1pick + opp-deck 上端裏向きセット | a2 only (a1 = set-card-leave hook DEFER) |
| B02020P | 0190 | 大岡紅葉 (SRP) | 同 | 同 |
| B02030 | 0200 | 服部平蔵 | a2: 【宣言】【ターン1】自陣 1pick + self-deck 上端裏向きセット | a2 only (a1 = カットイン negate DEFER) |
| B02046 | 0212 | 黒羽盗一 | a1: 【登場時】自陣【白】1pick で setCard + AP+1000 turn (sequence) | 完全実装 |
| B02046P | 0212 | 黒羽盗一 (CP) | 同 | 完全実装 |
| B03061 | 0316 | ルパン | a1: 【登場時】$self に self-deck 上端裏向きセット | a1 only (a2 = cost remove-set-card DEFER) |

### 新パターンの確立

#### 相手 deck → 相手 char に set (player:'opp' + side:'opp')

```ts
{
  kind: 'atom',
  verb: 'charSetCard',
  args: { player: 'opp', max: 1, side: 'opp', fromDeckTop: true, faceUp: false },
}
```

`charSetCard` の `player` フィールドが `'opp'` を受け入れることを再確認 (atom-handlers では
`resolvePlayer(a.player ?? 'self', ctx)` で正しく解決される)。

#### sequence で同一 pick uid に 2 atom 連続適用 (B02046/P)

```ts
effect: {
  kind: 'choice',
  chooser: 'self',
  options: [
    {
      kind: 'sequence',
      steps: [
        // step 1: $pick uid に setCard fromDeckTop
        { kind: 'atom', verb: 'charSetCard', args: { uid: '$pick', target: { ... } } },
        // step 2: 同じ $pick uid に AP+1000 turn (bindings 経由で再利用)
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$pick', delta: 1000, scope: 'turn' } },
      ],
    },
  ],
}
```

choice→sequence で 1 度の pick で 2 atom を同一 uid に適用するパターン。binding は
resolver の `pickedUid` substitution が両 step で再利用される。

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest 1773 pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass (engine-extensions-2026-06-05)
- pre-commit hook SKIP 不要で clean に通過

### ALL_CARDS

898 → 904 枚 (+6)

### 残課題 (set-card 残)

- B01047/P 黒羽快斗 (action 終了時 self-deck-bottom + grant turn-end-bounce 多段) — DEFER
- B02018/P 服部平次 (set-トリガ hook + cost=mill 3) — set-on hook 未対応、DEFER
- B02023 a2 (cost=set-card 除去 + sleep) — cost system 拡張要、DEFER
- B02030 a1 (カットイン使用反応 + negate) — DEFER (negate kind 未対応)
- B02040/P 黒羽盗一 別 variant (【宣言】+ setCard + AP+2000) — declared 版、batch #3 可能
- B03032/P 服部平次 a3 (登場時 相手 setCard) — B02020 a2 とほぼ同型、batch #3 可能
- B03061 a2 (cost=setCard 除去 + draw) — cost system 拡張要、DEFER
- B05028 服部平蔵 (declared remove-set + scene remove / 別 declared 多面) — 多段で複雑
- B08054 a1 (replace-on-leave) — DEFER 既知

### セッション中の累積 (engine 拡張 #1〜#5b 各 batch)

| 拡張 | batch #1 | batch #2 | 合計 |
|------|---------|---------|------|
| #1 leave:to-remove | 10 枚 | 7 枚 | 17 枚 |
| #2 charModifyLevel | 2 枚 | 4 枚 (MR a2-only) | 6 枚 |
| #3 multi-target Pattern A | 1 枚 | — | 1 枚 |
| #4 sceneToHand | 2 枚 | 5 枚 | 7 枚 |
| #5a deckRevealUntil maxN + handAddFromDeck | 1 + 5 色違い = 6 枚 | — | 6 枚 |
| #5b charSetCard fromDeckTop + PA短縮形 | 2 枚 | 6 枚 | 8 枚 |
| **engine 拡張カード合計** | | | **45 枚** |
