## Engine 拡張 #5a: deck-look-N (deckRevealUntil maxN) + handAddFromDeck + D01013

**Round/Phase**: 2026-06-05 engine-extension-plan.md step 5 (前半 = deck-reorder)

「自分のデッキのカードを上から N 枚見る」(D01013/D02011/D03009/D04011/D05012/D07019/B01013 等)
パターンを解禁する 2 つの primitive を additive 追加:

### 変更内容

#### `deckRevealUntil` に `maxN` オプション追加 (additive)

```diff
const maxN = a.maxN as number | undefined;
if (maxN !== undefined) {
  // 公式テキスト "上から N 枚見る" semantics — 全 N 枚 reveal + その中から 1 件抽出
  const lookN = Math.min(deck.length, maxN);
  for (let i = 0; i < lookN; i++) revealed.push(deck[i]!);
  for (const cardId of revealed) {
    if (filter(cardId)) { matched = cardId; break; }
  }
} else {
  // 従来 semantics: filter match まで 1 枚ずつ reveal、match で停止 (D11019 動作維持)
}
```

`$revealed` bind は match を除いた残り全 reveal カード (maxN 新動作)。旧動作 (slice(0,-1)) は
maxN 未指定時に維持。

#### `handAddFromDeck` verb 追加 (新規)

- `args: { player, cardId }` で bind 済 cardId をデッキから splice → 手札へ
- 通常 `cardId: '$matched.cardId'` で deckRevealUntil の bind を受ける
- 未解決 / not-found は silent no-op

### 実装カード batch #1

| ID | No | カード名 | 効果 |
|----|---|---|---|
| D01013 | 0012 | 灰原哀 | 【登場時】デッキ上から4枚見て【青】1枚を手札に加え、取った場合 discard 1、残りはデッキ下 |

### 互換性 (回帰 0 の根拠)

- `maxN` 未指定の `deckRevealUntil` 呼出は従来通り動作 (D11019 等の既存カードに影響なし)
- 新規 verb `handAddFromDeck` のため既存カードは影響を受けない
- typecheck clean / 全 vitest 1761 pass · 1 skip (回帰 0、baseline 1757 + 新規 4)

### 検証

- 新規 unit (atom-handlers.test.ts +4 件): maxN cap / no-match / shorter-deck / no-maxN 互換
- 新規 e2e (engine-extensions-2026-06-05.spec.ts +1) — 計 6/6 pass
  - D01013 handUseCard → enter a1 chain →
    deckRevealUntil maxN=4 で D08013 (青) を $matched →
    handAddFromDeck で手札追加 →
    discard pick で D11005 を捨て →
    deckToBottomBound で残り [D11015,D11003,D11004] をデッキ下
    最終: deck=[D08005, D11003, D11004, D11015], hand=[D08013] (+ scene=D01013)
- ALL_CARDS 875 枚 (+1)

### 残実装 (deck-look-N 系の 6 枚 + 他デッキ操作系)

- D02011/D03009/D04011/D05012/D07019/B01013/B01013P (D01013 同型、色違い) → batch #2 で対応
- D01012/D05007 (現場リムーブ時 deck-look-3 → スリープ登場) → leave:to-remove + deckLookN 複合
- 他 deck-reorder 系 (B01005 「ネクストヒント時 1枚デッキ下」等) → 別パターン
