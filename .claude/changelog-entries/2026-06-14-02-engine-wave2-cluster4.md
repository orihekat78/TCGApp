# engine拡張 wave#2 cluster4 — remove-area → deck-bottom 解禁 6枚

**Round/Phase**: 2026-06-14 engine拡張 wave#2 cluster4 (`cards/wave2-cluster4`)。
「リムーブエリアのカードをデッキの下に移す」族を解禁。比較 triage (6 gate × opus) で
最高歩留り × 最低リスク を確定 → 敵対設計レビュー 3 lens (rules / edge-determinism / per-card)
で DSL 短縮形修正を反映し approve。

### engine 拡張 (additive 2 プリミティブ、骨格挙動変更 0)

- **新 Cost `removeAreaToDeckBottom {target, n}`** — 既存 `sceneToDeckBottom` の area:'remove' 版。
  canPay = candidates(remove,filter)≥n (rules/21)。pay = `mutate.remove.removeFromHere` +
  `mutate.deck.toBottom` (自分のみ / query.side:'self' = 公式Q&A「相手のカードは移せない」)。
- **新 AtomVerb `removeAreaAllToDeckBottom`** (B08027) — 両プレイヤーの remove 全部を各自 deck 下 → 両 shuffle。
  リムーブした自身も含む (sequence で sceneRemove $self が先行) / 「リフレッシュではない」= 証拠付与なし (rules/14/26)。
- 3点 whitelist 同期 (effect.ts union / 各 dispatch / taskA-validate-specs.cjs)。UI は costToText +
  costParams 配線を additive 追加。

### 解禁カード 6枚 (4設計) / DEFER 1枚

- B08051 / B08051P 赤井秀一 — 【登場時】[宮野明美]∈remove で自身〚突撃〛/ 【宣言】【ターン1】cost remove→deck で自身〚ブレット〛
- B08066 / B08066P 上原由衣 — 【宣言】cost pay[sleepSelf, remove→deck(長野県警)] → 長野県警キャラに〚突撃〛
- B03059 土井塔克樹 — 【宣言】【ターン1】cost remove→deck(白) → キャラ AP+1000 / 【ヒラメキ】remove[怪盗キッド]→手札
- B08027 長門秀臣 — 【登場時】このキャラをリムーブしてもよい→自分と相手の remove 全部を各自 deck 下 + 両 shuffle
- ALL_CARDS 1152→1158。**DEFER B07025** (triage 誤分類: cost は sceneToDeckBottom 実装済、effect が動的 levelMax-from-cost で不在)。

### 設計の要点 (敵対レビュー反映)

- pick-and-grant/modify は**短縮形必須** (`max:1`+inline `filter`。nested `target`/`n:{}` は hasNorMax 不成立で無音 no-op、BUG-130 系)。3 lens 全員が blocker 指摘 → 全句修正。
- B08051 突撃は triggered 一回 grant (scope:'turn')。条件[宮野明美]消失でも失わない (qAndA、continuous では不可)。
- B08027 は `optional(sequence[…])` (chain は declined optional で後続誤実行のため不可、B09084 先例)。
- 既知ギャップ DEFER: B08066 cost の《諸伏高明/大和敢助》leave:remove-area 反応 (hook 不在 + 反応元未実装で安全に繰越)。

### 検証

- 挙動 pin 12 件 (`tests/cards/cluster4-remove-area-deckbottom.test.ts`): cost(self-only/deck下/leave不発) / verb(両者drain/自己含む/空remove) / 各カード発火 (decoy 非発火含む)。
- 全ゲート green: tsc / sync-whitelists 5/5 / full vitest **2086** (+12) / **smoke:1000 baseline 完全一致**
  (timeouts0/exceptions0/avg10.863≈10.86/winsA469 = 挙動保存の回帰証跡。新カードは MVP デッキ不在) /
  playwright MCP 実機 (load→mulligan→turn→end-turn→CPU、console err 0=favicon のみ)。
- 設計記録: [.claude/specs/engine-wave2-cluster4-remove-area-design.md](../specs/engine-wave2-cluster4-remove-area-design.md)。
