## タスク C: evidence 抑制 (evidenceToDeck + optional triggerPayload 引継ぎ) + B03038

**Round/Phase**: 2026-06-06 session — reasoning 残 new-feature 第4弾 (お勧め順 ④)。
「この推理によって証拠を得ない」を additive 解禁。

### engine 拡張 (additive)

- **`mutate.evidence.toDeckTop(s, p, n)`**: 証拠最上部 n 枚をデッキ上へ元順序で戻す (addFromDeck の逆操作)。
  net で「証拠0・デッキ復元」= rules/11 §LP≤0「証拠を1つも得ない」と同じ状態。
- **新 atom verb `evidenceToDeck`** (effect.ts / validate.ts / atom-handlers.ts)。n は number か
  `$trigger.gained` (推理で得た枚数 = reasoning:end payload.gained) を resolveBindRef で解決。
- **optional 越しの triggerPayload 引継ぎ**: pendingEffectOptional に `triggerPayload?` を追加し、
  resolve-picks の optional surface (triggered.ts resolveCtx に triggerPayload 追加) → store →
  applyOptionalAndContinuation の再開 ctx + queue payload まで伝搬。これで optional 内の effect が
  `$trigger.<field>` を実行時解決できる。triggerPayload 無しの通常 optional (B05019) は不変=additive。

### 対応カード (1 枚)

- **B03038 時津潤哉** (緑Lv5): 【自分ターン中】【ターン1】自分の現場のLP1以上のキャラが推理したとき、
  1枚引いてもよい。そうした場合この推理で証拠を得ない。`reasoning:end` + condition turn:self + limit turn1 +
  triggerCharMatches{self,lpMin:1} + `optional(sequence([draw 1, evidenceToDeck{n:'$trigger.gained'}]))`。

### 検証

- typecheck clean / 全 vitest **1851 pass / 1 skip / 0 fail** (回帰0) / lint (side-channel 11ch errors=0) / eslint 0 errors。
- unit `tests/cards/evidence-suppression-batch.test.ts` 4 件 (する→証拠デッキ復元+draw / しない→保持 / AI skip / def)。
- e2e `tests/e2e/evidence-suppression-2026-06-06.spec.ts` 2 pass (人間経路 する/しない)。回帰 e2e (B05019 optional) 2 pass。
- ALL_CARDS 966 → **967**。

### 残課題

- ⑤ B09047 (闇の男爵) は DEFER。当初「2色MRデータ無」と記したが**誤り** — 2色MR は実在する
  (B08093 灰原哀＆シェリー 青/黒・MR / B09108 / B09109 / B09110。tsv-loader.ts:9 コメントは stale)。
  真の blocker は **engine 構造**: (1) TargetFilter に `isMR` / 色数(colorCountMin) 述語が無い
  (candidates.ts 未対応) / (2) **パートナーエリアの MR キャラを列挙できない** — GameState は partner.cardId 単一枠のみで
  MR能力①(rules/18) で移動した MR キャラのエンティティ枠が無い (ビッグジュエル B07045 と同型の高リスク構造問題)。
  → D の高リスク群 (partner-area 構造拡張) として DEFER。教訓: stale コメントを信じず実データを確認すること。
