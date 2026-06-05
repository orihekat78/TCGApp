## Engine 拡張 #1 leave:to-remove batch #3 — 7 枚 (engine 変更 0)

**Round/Phase**: 2026-06-05 session batch #3 拡充

batch #1 (10 枚) + #2 (7 枚) に続いて、leave:to-remove 残から simple draw/discard 系を中心に
7 枚を batch #3 として追加。engine 変更ゼロ。

### 実装カード (7 枚)

| ID | No | カード名 | 効果 (leave のみ抽出) | 注記 |
|----|---|---|---|---|
| B04018 | 0419 | 遠山和葉 (R) | a2: 引く1 | a2 only (a1/a3 DEFER) |
| B04018P | 0419 | 遠山和葉 (RP) | 同 | 同 |
| B05056 | 0558 | 鈴木次郎吉 | a1: 引く1 | a1 only (a2 DEFER) |
| B06080 | 0700 | 世良真純 | a1: 引く1+discard1 chain | a1 only (a2 DEFER) |
| B08079 | 0915 | ピンガ (SR) | a1: 自分ターン中 AP+1000 continuous / a2: 引く1+discard1 | a1+a2 完全実装 (a3 DEFER) |
| B08079P | 0915 | ピンガ (SRP) | 同 | 同 |
| B08083 | 0919 | ラム (R) | a1: 引く1 | a1 only (a2 DEFER) |

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- sanity test 7 件追加 → 25/25 pass
- 全 vitest 1780 pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass

### ALL_CARDS

904 → 911 枚 (+7)

### 残課題 (leave:to-remove 残)

- cause matcher (D06009/B01035/B05032 大滝悟郎 系: "コンタクトによってリムーブ" 条件) — DEFER
- B01054/P 寺井黄之助 (turn-scope charOverrideLP — engine 拡張要)
- B01092/P 松田陣平 (replace-on-leave) — DEFER
- deckRevealUntil cardName 系 (B01018/B02058/B02058P/B02066/P 等) — engine#5a maxN モードと
  異なる「カード名出るまで」パターン、別 verb or 拡張可能
- カットイン filter (B02025/P 遠山和葉) — gates 既知 DEFER
- evidence-from-leave (B07065/0649 など、稀)
