## タスク E: BUG-083 (rules/20 複数同時登場スイッチ) 再調査 — throw は解消済を確認

**Round/Phase**: 2026-06-06 session — 推奨作業順 B→E→C→A→D の E。

BUG-083 (起票 2026-05-28) は「効果で2体以上同時登場し現場上限超過時、2 体目 sceneEnter が
mutate.scene.enter で throw する」未実装バグ。タスク E で実コードを再調査した結果:

- **throw は 2026-06-04 switch-on-effect-enter (BUG-106) で解消済**。atom-handlers の sceneEnter が
  満杯 (5枚) を検知し、`switchRemoveUid` 無し→skip (rules/15「可能な限り」) / 有り→switchEnter で
  ガードするため `mutate.scene.enter` の throw に到達しない。
- **条件2 の結果も per-step switch で到達可能** (human は 2 体目登場時に退場キャラを選ぶ)。
- 専用 `sceneMultiEnter` (2体を真に同時 enumerate して 1 回の switch) は **該当カード0** のため
  未実装 (骨格凍結原則)。multi-entry カード実装時のみ検討する latent refinement として記載。

検証: `tests/engine/effect/bug-083-multi-entry-switch.test.ts` 新規 2 case —
現場4枚 + 2体 sequence 登場が throw せず scene≤5 を保つ / overflow に switchRemoveUid を与えれば
switchEnter で両方登場 (条件2 の結果)。登録カードに multi-entry (2+ sceneEnter) は 0 件と確認。

BUG-083 status → 修正済 (throw 解消 / true-simultaneous は latent・該当0カードで DEFER)。
