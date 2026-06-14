# cluster8 — ヒラメキ抑止窓 (action-scoped hirameki suppress) 1枚

**Round/Phase**: 2026-06-15 engine拡張 wave#2 cluster8。cluster3 で DEFER した B06049 a2 を、新 engine 機構
(action-scoped ヒラメキ抑止 flag) を追加して解禁。設計は敵対的設計レビュー (opus) で `sound` 判定後に実装。

### 新 engine 機構 (cluster6 setEventUseBan の action-scoped 版)

- `TurnScopedFlags.hiramekiSuppressed?: boolean` を追加 (player-level)。
- 新 atom verb `setHiramekiSuppress` (3点 whitelist 同期: effect.ts union / validate.ts map / taskA cjs)。
  `turnState[resolvePlayer(player)].hiramekiSuppressed=true` をセット。
- `listeners/triggered.ts handleEvidenceRemovedHook` が payload.player (証拠を失う側) の flag を見て、
  optional/forced 両経路の【ヒラメキ】発火を抑止。
- 清掃: `flow/action/state-machine.ts` の contact-end→action-end 遷移で両プレイヤー分クリア (action-scoped、
  player-level なので scene loop 外)。turn:start `resetTurnFlags` も backstop。

### 解禁カード 1枚

- **B06049 佐々木小次郎** (白 lv6/ap6000/lp0, YAIBA, R):
  - a1【登場時】このキャラ以外の[YAIBA]がいれば、ターン終了時まで〚突撃〛 (D08011 a1 同型、trait=YAIBA)。
  - a2 このキャラがアクション[事件]したとき、アクション終了時まで相手の【ヒラメキ】は発動しない
    (`action:declare` + `selfOnly` + `matcherCondition triggerActionKind{case}` → `setHiramekiSuppress{opp}`)。新機構。
  - a3【ヒラメキ】キャラ1枚までスリープ (PR138 a2 同型)。
- ALL_CARDS 1165→1166。

### 検証

- 専用 behavioral テスト `tests/cards/cluster8-hirameki-suppress.test.ts` 4 件 (抑止の核 + 制御、verb、
  trigger 配線 + action[char]/非このキャラ 制御、action-end 清掃) で新挙動を実証 (B06049 は非 MVP のため
  smoke では踏めない、BUG-132 教訓)。full vitest 2113 pass、smoke:1000 baseline **不変** (engine 変更が
  既存デッキに no-op = B06049 不在時は flag 未セットで check/clear が無影響) を証跡として確認。
