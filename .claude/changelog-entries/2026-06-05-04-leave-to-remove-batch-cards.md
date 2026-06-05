## Engine 拡張 #1: leave:to-remove batch (実カード 10枚)

**Round/Phase**: 2026-06-05 engine-extension #1 step 1.5 (engine-extension-plan.md)

Engine 拡張 #1 (commit `314281d`) で解禁した【現場リムーブ時】(`leave:to-remove`) hook を
最初に利用する 10 枚を `_reuse` バッチに追加実装。全カードは既存 atom verb のみで構築
(骨格再修正なし)。引き続き 89 枚 (全 leave:to-remove 持ち) の残実装は engine 機能ゲートを
満たすものから順次追加予定。

### 実装カード

| ID | No | カード名 | パッケージ | 効果 (leave:to-remove) |
|----|---|---|---|---|
| D03013 | 0129 | 鈴木次郎吉 | ct-d03 | 1 ドロー (+ ヒラメキ sleep) |
| D04010 | 0141 | ジョディ・スターリング | ct-d04 | 相手 discard 1 (+ ヒラメキ sleep) |
| B03013 | 0271 | 大尉 | ct-p03 | charModifyAP-2000 turn |
| B03091 | 0344 | 高木長介 | ct-p03 | side:self+trait:警察 AP+1000 turn |
| B03130 | 0379 | マッドサイエンティスト | ct-p03 | 1 ドロー (+ ヒラメキ draw) |
| B04010 | 0415 | 本堂瑛祐 | ct-p04 | levelMax:4 sleep |
| B06009 | 0634 | トラカゲ | ct-p06 | 1 ドロー → discard 1 chain (+ 条件付きヒラメキ draw) |
| B08084 | 0920 | ウォッカ | ct-p08 | 1 ドロー → discard 1 chain |
| B08089 | 0925 | ヘルエンジェル | ct-p08 | 1 ドロー → caseStatus:解決編 conditional discard 1 |
| PR054 | 0259 | 灰原哀 | pr-01 | enter draw 1 + leave self-discard 1 |

### 全カードの共通パターン

- `trigger: { hook: 'leave:to-remove', selfOnly: true }`
- `condition: { kind: 'turn', player: 'opp' }` (【相手ターン中】)
  - 例外: 該当節を持たない card は condition なし (今回 batch では全て条件付きのため該当なし)
- `scope: 'on-scene'` (handleLeaveToRemoveSelf が virtual `area: 'scene'` で発火)

検証: 新規 unit (`tests/cards/leave-to-remove-batch.test.ts`) 11/11 pass /
全 vitest **1736 pass · 1 skip** (回帰 0) / typecheck clean /
`reuse-cards-2026-06-05.spec.ts` e2e 9/9 pass / lint:listener errors=0 /
docs:check clean (auto regen)。

### 残実装 (DEFER 候補 79 枚)

leave:to-remove 持ちカードは全 89 枚。今回 batch (10 枚) の残 79 枚は以下のいずれかが理由:
- **enter/declared 等の追加 ability** が複雑 (例: B09007 enter optional self-remove)
- **複合 effect** (deckRevealUntil + 候補登場 / カード名指定 set / カットイン filter etc.)
- **特定 condition 未対応** (charSetLP/AP / 特定 partner 参照 / untargetable / aura)

次バッチ (#2 以降) では engine-extension-plan の step 2 (level-modify) を経由してから順次追加する。
