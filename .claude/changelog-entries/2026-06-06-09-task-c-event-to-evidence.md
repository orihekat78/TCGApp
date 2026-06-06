## タスク C: event→evidence 解禁 — selfToEvidence verb (イベント自身を表向き証拠化)

**Round/Phase**: 2026-06-06 session — タスク C 第5弾。engine 拡張計画の "event→evidence" を 1 ユニットとして実装。

### engine 拡張 (additive 1 verb)

新 atom verb **`selfToEvidence`** を追加 (`effect.ts` AtomVerb union / `validate.ts` ATOM_VERBS /
`atom-handlers.ts` handler / `mutate/evidence.ts gainCard`)。「このカードを表向きのまま証拠として得る」
(rules/01 §必要証拠数, rules/06 §イベント) を実装:

- handUseCard はイベント使用時に当該カードをリムーブへ置く (既存・不変)。`selfToEvidence` はその後 effect 解決時に
  `ctx.source.cardId` を **リムーブ→証拠 (表向き)** へ移す (`gainCard` が remove から lastIndexOf で 1 枚取り除き
  evidence へ push)。最終状態は「証拠+1 / リムーブ・手札に残らない」。
- 既存カードは selfToEvidence 未使用 → 完全 additive。証拠追加で勝利は早発しない (勝利は事件解決の別アクション)。
- faceUp 既定 true (「表向きのまま」)。同 cardId が既にリムーブに在っても二重計上しない (lastIndexOf で 1 枚のみ)。

### 対応カード batch #1 (5 枚, 全5色)

B04015(青) / B04028(緑) / B04041(白) / B04062(赤) / B04086(黄) — いずれも Lv7 イベント、効果は同一
「このカードを表向きのまま証拠として得る。」。effect:declared selfOnly + matcher kind:'event-use' (B04096 同型) で
発火し selfToEvidence。

### 検証

- typecheck clean / 全 vitest **1822 pass / 1 skip / 0 fail** (+4, 回帰0) / 変更ファイル lint 新規エラー 0
  (※ validate.ts:68 の no-fallthrough は pre-existing・本変更と無関係)。
- unit `tests/cards/event-to-evidence-batch.test.ts` 4 件 (verb 配線 / full path remove→evidence 表向き /
  黄事件 色制限 / 二重計上ガード)。
- e2e `tests/e2e/event-to-evidence-2026-06-06.spec.ts` 1 pass (実機: B04015 使用→自身が表向き証拠化・証拠+1・
  remove 非経由・console error 0)。
- ALL_CARDS 938 → 943。

### 残課題 (event→evidence 残)

- **PR reprint 12 枚** (PR012-021 = B0401x の再録 / PR062・PR066「RUM!!」) は同 selfToEvidence で実装可 (trivial follow-up)。
- **別 verb 要**: B06033「手札からカードを1枚裏向きで証拠として得る」= hand→evidence (裏向き) / B05103 (相手証拠→デッキ下) /
  B06034 (解決編 証拠 flip + ヒラメキ) は selfToEvidence 対象外で別機能ゲート (DEFER)。
