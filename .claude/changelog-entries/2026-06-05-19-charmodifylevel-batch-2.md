## Engine 拡張 #2 charModifyLevel batch #2 — MR 4 枚 (a2 only)

**Round/Phase**: 2026-06-05 session 残課題対処 — 優先度 中 #5

batch #1 (B07103/P / 2026-06-05 早朝) に続いて、charModifyLevel 残 15 枚から
declared a2 が clean な MR 4 枚を batch #2 として実装。engine 変更ゼロ。

### 実装カード (4 枚 / すべて MR a2-only partial)

| ID | No | カード名 | 効果 (a2 のみ) |
|----|---|---|---|
| B05066 | 0566 | 赤井秀一＆沖矢昴 (MR) | 【宣言】【ターン1】相手 1pick → turn-level-1 |
| B05066P | 0566 | 赤井秀一＆沖矢昴 (MRP) | 同 |
| B07093 | 0820 | バーボン＆ライ (MR) | 同 |
| B07093P | 0820 | バーボン＆ライ (MRP) | 同 |

### a2 のみ実装 (a1 DEFERRED)

- **B05066/P a1**: 【パートナー赤】【自分ターン中】【ターン1】相手キャラがリムーブされたとき
  level≤8 を 1枚 リムーブ — `leave:to-remove` hook + matcher (side=opp) で実装可能だが本バッチでは
  declared a2 に集中
- **B07093/P a1**: 【パートナー黒】【FILE7】【宣言】【ターン1】hand/remove 2-source choice + 多段
  grant (AP+4000 + 突撃 + turn-end-deck-bottom rider) — 複合効果が複雑

### 「パートナーエリアでも宣言できる」の扱い (partial-impl)

a2 公式テキスト末尾に「この能力はパートナーエリアでも宣言できる」とあるが、本実装は
**scope: 'on-scene' のみ** で対応。partner-area での宣言は engine 側に partner-area 用 ability
列挙の拡張が必要 (gates 既知の DEFER 領域)。MR の `相手ターン中の現場離脱でパートナーエリア
へ移動` (rules/18) は engine 側で対応済みのため、self ターンで scene にいる時 / opp ターンで
partner-area に避難中に self が再開 (turn:end:start trigger 等) の中間状態でしか declared a2 が
呼ばれない想定。

### 複数名カード対応 (rules/19)

両 MR は「&」結合の複数名カード:
- B05066: `names: ['赤井秀一＆沖矢昴', '赤井秀一', '沖矢昴']`
- B07093: `names: ['バーボン＆ライ', 'バーボン', 'ライ']`

rules/19 の「あらゆるエリアで すべての分割名を持つカード として扱う」に従い、配列に分割名も
含める (【絆 沖矢昴】等の他カード effect が正しく target できるように)。

### 検証

- typecheck clean / lint:bugs/listener/side-channel 全 OK
- 全 vitest 1773 pass · 1 skip (回帰 0、flaky BUG-077 -1)
- e2e 13/13 pass (engine-extensions-2026-06-05)
- pre-commit hook SKIP 不要で clean に通過

### ALL_CARDS

894 → 898 枚 (+4)

### 残課題 (level-modify 残 11 枚)

- B05066/P a1 / B07093/P a1 (上述、DEFERRED 理由付き)
- B07103 同 (engine#2 batch #1 で実装済 — 重複なし)
- B08048 アンドレ・キャメル (action[キャラ] triggered → lev-1 + conditional AP+3000) — action target binding 必要
- B09078 榎本梓 / PR096 安室透 (enter 反応 = self/cardName-list matcher) — matcher 実装で可能、別バッチ
- B05102 小五郎の弟子 (event card with multiple chain effects) — イベント版
- B04046/P 赤井秀一 (相手場全体 lev-1 continuous) — aura、DEFER (高リスク領域)
- B08050/B08057 (解決編で self lev+3 continuous) — continuous self level、DEFER
- B08059 諸星大 (場に lev7 が 2 体以上で self lev+1 + AP+1000 + 突撃) — 複合 condition + continuous、DEFER
- B09003 江戸川コナン (自分ターン中 self lev-2 continuous) — continuous self、DEFER
- B09095 ベルモット (痕跡 trigger lev-2、手札内 effect) — 痕跡 system 必要、DEFER
