## Engine 拡張 #5a batch #2: D01013 同型 5 色違いカード

**Round/Phase**: 2026-06-05 step 5a batch #2

D01013 (上から4枚見て【青】1枚を手札+discard) の **完全同型 5 色違い** を実装。
engine 変更ゼロ、各カードは色 filter のみ差分。

### 実装カード

| ID | No | カード名 | 色 |
|----|---|---|---|
| D02011 | 0028 | 大岡紅葉 | 緑 |
| D03009 | 0047 | 鈴木園子 | 白 |
| D04011 | 0062 | ジョディ・スターリング | 赤 |
| D05012 | 0078 | 佐藤美和子 | 黄 |
| D07019 | 0371 | シェリー | 黒 |

各カードは D01013 と完全同型 (filter color のみ差分):

```ts
{ kind: 'atom', verb: 'deckRevealUntil',
  args: { player: 'self', filter: { color: '<色>' }, maxN: 4, bind: '$revealed', bindMatch: '$matched' } },
{ kind: 'conditional',
  if: { kind: 'bound', key: '$matched', presence: 'matched' },
  then: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  ]},
},
{ kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
```

### 検証

- typecheck clean
- 全 vitest 1764 pass · 1 skip (回帰 0)
- e2e (engine-extensions-2026-06-05) 5 新規 case 含む 13/13 pass:
  各色について handUseCard → enter a1 chain → 該当色を手札へ → discard 1 解決を実機検証
- ALL_CARDS 882 枚 (+5)

カードファイル touched files = 7 (5 card + _reuse/index + changelog) — engine 変更ゼロ。
batch 拡充の理想モデル: 1 engine 拡張 → 同型カード N 枚を engine 変更なしで追加。
