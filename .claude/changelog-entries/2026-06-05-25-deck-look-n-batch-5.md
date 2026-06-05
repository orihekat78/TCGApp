## Engine 拡張 #5a deck-look-N batch #5 — 9 枚 (ct-p01 早期再録展開)

**Round/Phase**: 2026-06-05 session batch #5 拡充

batch #4 (B01013/16/34 / 6 枚) に続いて、ct-p01 内の deck-look-N 系の残 9 枚を追加。

### 実装カード (9 枚)

D01013 系 (maxN=4, color filter, discard 1 連鎖):
- B01055 / B01055P 鈴木園子 (白)
- B01072 / B01072P ジョディ・スターリング (赤)
- B01090 / B01090P 佐藤美和子 (黄)

variant (maxN=3, no filter, declared sleep cost):
- B01048 / B01048P 鈴木園子 — 【宣言】【スリープ】 デッキ上 3 枚見て 1 枚手札に加える

variant (maxN=2, LP≥2 + 白 filter):
- B01053 工藤有希子 — 【登場時】 LP2 以上の【白】キャラを 1 枚まで手札に加える

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass
- pre-commit hook SKIP 不要で clean に通過

### ALL_CARDS

924 → 933 枚 (+9)
