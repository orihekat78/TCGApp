# engine拡張 wave#2 cluster6 — usage-restriction (event-use ban) 解禁 2枚

**Round/Phase**: 2026-06-14 engine拡張 wave#2 cluster6 (`cards/wave2-cluster6`)。
「このターン中、自分はイベントを使用できない」(M3) 族を解禁。cluster5 (M1+M2 aura) と同 work order ③ の続き。
B09034/B09034P「黄金千枚二千杯」(緑イベント lv5、P は同文 reprint) を出荷。

### engine 拡張 (additive・不在時 no-op)

- **新 verb `setEventUseBan`** (3点同期: `types/effect.ts` AtomVerb union + `effect/validate.ts` ATOM_VERB_MAP +
  `scripts/taskA-validate-specs.cjs` VERBS、`sync-taskA-whitelists.test.ts` が CI gate)。所有者相対 (player 省略時 self) に
  `turnState[p].eventUseBanned=true` をセットする turn-scoped flag verb。
- **新 field `TurnScopedFlags.eventUseBanned?: boolean`** (`types/game-state.ts`、`enterCountThisTurn` と同じ optional 前例。
  state-factory/fixtures 未初期化)。`mutate/flag.ts` resetTurnFlags でターン境界クリア。
- **2 flow gate (event のみ)** — `flow/main/hand-use-card.ts` handUseGateCommon は `d.kind==='event' && eventUseBanned`
  で不可化 (character は不変)。`flow/main/next-hint.ts` は step2 (optionalCardId) で event を throw (step1 FILE→手札は阻害なし)。
  `ui/hooks/useActionsPanelFlow.ts` toCandidate も ban 中 event を候補除外 (UX 整合)。
  公式 Q&A 通り【カットイン】【ヒラメキ】は別経路のため非ゲート。「イベントを使用する」効果 verb は engine 未実装
  (生成するカード皆無) のため追加ゲート不要。
- **`handAddFromRemove` に複数pick path** (`$pick.cardIds`、charStackCard/D08021 と同型) を additive 追加。
  従来 single-card path (cardIds 未指定) は非干渉。human=apply-pick.ts / AI=resolve-picks.ts の既存 generic
  cardIds 機構をそのまま利用 (handler 分岐のみ追加)。`forEach over:{kind:'pick'}` は実行時 throw のため不採用。

### 解禁カード 2枚

- B09034 / B09034P「朝日射し夕日輝く鉄の瓶…黄金千枚二千杯」(緑 lv5) — 本体: リムーブのイベント2枚まで回収
  (multi-pick) + このターン自分イベント使用不可 (sequence で 0 枚 pick でも ban 発火) / 【ヒラメキ】リムーブのイベント1枚まで回収。
  ALL_CARDS 1161→1163。

### 検証 (cheap gates、heavy gates は cluster7 と合算で後追い)

- 挙動 pin 8 件 (`tests/cards/cluster6-event-use-ban-behavioral.test.ts`): canHandUseCard で event 不可・character 可・
  相手 ban は無関係 / runNextHint ban gate throw (`/event-use banned/`) + character は登場 / setEventUseBan verb + reset /
  canCutIn は ban 影響なし (exempt) / B09034 a1 multi-pick **0・1・3(→上限2)** 枚 + 非 event は filter 除外 + 0枚でも ban 発火 /
  B09034 a2 ヒラメキは ban 中でも回収 (exempt)。
- cheap gates green: **tsc --noEmit exit 0** / **sync-taskA-whitelists pass** / taskA-validate-specs **70 pass 0 fail** /
  targeted vitest **13 pass**。
- full vitest + smoke:1000 baseline + e2e playwright は cluster7 完了後に合算実行 (ユーザー指示 2026-06-14: heavy gates は
  cluster7 後に1回)。新カードは非 MVP (CT-D08/D11 不在) で smoke は no-op 回帰のみ → 新挙動は上記専用 vitest で実証 (BUG-132 教訓)。
- 設計記録: [.claude/specs/engine-wave2-cluster5-usage-restriction-design.md](../specs/engine-wave2-cluster5-usage-restriction-design.md) §cluster6。
