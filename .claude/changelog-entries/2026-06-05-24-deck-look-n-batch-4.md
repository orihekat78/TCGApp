## Engine 拡張 #5a deck-look-N batch #4 — 6 枚 (D01013 同型展開)

**Round/Phase**: 2026-06-05 session batch #4 拡充

batch #1 (D01013) + #2 (D02011/D03009/D04011/D05012/D07019 — 5 色違い) に続いて、
ct-p01 パッケージの早期コピー再録カード 6 枚を batch #4 として追加。engine 変更ゼロ。

### 実装カード (6 枚)

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B01013 | 0009 | 妃英理 (C) | maxN=2 / filter LP0【青】キャラ / hand-add (discard 連鎖なし) |
| B01013P | 0009 | 妃英理 (CP) | 同 |
| B01016 | 0012 | 灰原哀 (C) | D01013 完全同型 (青、maxN=4、discard 連鎖あり) |
| B01016P | 0012 | 灰原哀 (CP) | 同 |
| B01034 | 0028 | 大岡紅葉 (C) | D02011 完全同型 (緑、maxN=4、discard 連鎖あり) |
| B01034P | 0028 | 大岡紅葉 (CP) | 同 |

### B01013 のみ異なるパターン

B01013/P は他 4 枚と違い:
- maxN = **2** (他は 4)
- filter = **LP0** の【青】キャラ (他は単に色のみ)
- discard 1 連鎖は **無し** (テキスト末尾の「手札を1枚リムーブ」が無い)

```ts
filter: { color: '青', lpMax: 0, kind: 'character' }
```

`lpMax: 0` で「LP0 以下」を抽出。kind: 'character' でイベント除外。

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass
- pre-commit hook SKIP 不要で clean に通過

### ALL_CARDS

918 → 924 枚 (+6)
