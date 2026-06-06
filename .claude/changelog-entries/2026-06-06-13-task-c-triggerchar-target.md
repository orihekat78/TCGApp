## タスク C: triggerChar→target ($trigger.uid) + B05080 羽田秀吉

**Round/Phase**: 2026-06-06 session — reasoning 残 new-feature 実装 第1弾 (お勧め順 ①)。
「そのキャラ (=反応のきっかけになったキャラ)」を effect target にする binding を additive 追加。

### engine 拡張 (additive — resolveBindRef 1 分岐)

`resolveBindRef` (atom-handlers.ts) に **`$trigger.<field>`** を追加。トリガ payload のキャラを参照する:
- runtime ctx は `entryToCtx` (stack.ts) で `triggerPayload` を持つ (reasoning:end={uid,player,gained} 等)。
- `$trigger.uid` → `payload.uid ?? payload.byUid` (hook 差を吸収) / `$trigger.player` → `payload.player`。
- 既存カードは `$trigger.` 未使用 → 完全 additive。chain/sequence の継続 ctx も runtime ctx 由来のため
  pick pause を跨いでも triggerPayload が保持される。

### 対応カード (1 枚)

- **B05080 羽田秀吉** (赤Lv4): a1=〚ミスリード1〛(misreadX 既存) / a2=【ターン1】相手の現場のキャラが推理したとき、
  手札を1枚リムーブしてもよい。そうした場合、そのキャラを ターン終了時まで LP-1。
  `reasoning:end` + `triggerCharMatches{side:'opp'}` + limit turn:1 +
  `chain([discard{max:1}, charModifyLP{uid:'$trigger.uid', delta:-1, scope:'turn'}])`。
  chain で「〜してもよい。そうした場合〜」(discard skip → chain break) を表現 (optional 機構不要、D11007 同型)。

### 検証

- typecheck clean / 全 vitest **1838 pass / 1 skip / 0 fail** (回帰0) / lint errors=0。
- unit `tests/cards/triggerchar-target-batch.test.ts` 4 件 (LP-1 適用 / 手札0で chain break / side:opp gate / def)。
- e2e `tests/e2e/triggerchar-target-2026-06-06.spec.ts` 2 pass (人間経路: する→discard+そのキャラLP-1 / skip→LP-1しない)。
- ALL_CARDS 958 → **959**。

### 残課題

- `$trigger.player` 等を使う action/leave 反応カードは将来再利用可。次: multi-hook 共有 limit (D03007 等)。
