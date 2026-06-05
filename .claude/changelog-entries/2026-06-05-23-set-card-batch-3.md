## Engine 拡張 #5b charSetCard batch #3 — 5 枚 (engine 変更 0)

**Round/Phase**: 2026-06-05 session batch #3 拡充

batch #1 (2 枚) + #2 (6 枚) に続いて、charSetCard 残から 5 枚を batch #3 として追加。

### 実装カード (5 枚)

| ID | No | カード名 | 効果 |
|----|---|---|---|
| B02040 | 0207 | 黒羽盗一 (SR) | a1 パートナー白 enter lv≤7 sceneRemove / a2 declared turn1 自陣【白】excludeSelf 1pick → setCard + AP+2000 |
| B02040P | 0207 | 黒羽盗一 (SRP) | 同 |
| B03032 | 0289 | 服部平次 (C) | a1 パートナー緑 突撃 keyword / a3 enter 相手 1pick + opp-deck setCard (a2 DEFER) |
| B03032P | 0289 | 服部平次 (CP) | 同 |
| B05029 | 0533 | 大岡紅葉 (R) | a1 declared sleepSelf cost + 自陣 1pick + self-deck setCard (a2 cost=setCards 2 枚リム DEFER) |

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest 1780 pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass
- pre-commit hook SKIP 不要で clean に通過

### ALL_CARDS

913 → 918 枚 (+5)
