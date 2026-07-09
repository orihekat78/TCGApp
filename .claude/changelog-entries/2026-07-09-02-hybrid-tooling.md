# feat(tooling): hybrid pipeline 恒久化 + probe compiler MVP (2026-07-09)

- **scripts/hybrid/prepare.cjs** (`npm run hybrid:prepare`): corpus/shipped-dsl fresh 化 → refuse-1行
  scan → **twin 自動 group** (refused 行同文 + rest-compile deep-equal。pilot の手書き twin group を
  機械再現することを実証) → DEFERRED-INDEX 照合 skip → 選定 → payload 生成。従来 .tmp 手作業 3 script
  + 手書き UNITS を 1 コマンド化。
- **scripts/hybrid/finish.cjs** (`npm run hybrid:finish`): merge (compiledRest verbatim ゲート +
  twin 同文機械証明) → **ability key 順 正規化** → **shipped-idiom 決定論 lint** (BUG-130 / BUG-032 /
  BUG-123 warn / sceneSetState player — 負例 3/3 検出・hard violation で codegen 中断を実証) →
  validate-specs → codegen → register → tsc → crosscheck。pilot 教訓の手動工程を恒久 gate 化。
- **probe compiler MVP** (`npm run gen:probes`、scripts/gen-card-probes.cjs +
  tests/helpers/card-probe-harness.ts): card DSL (serializable JSON) から probe を機械導出 —
  filter→decoy 合成 (levelMax→+1 等) / optional→take+decline / n.min0→skip / condition→on+off /
  cost→unpayable gate。harness は production dispatch のみ (activateDeclaredAbility / enter emit /
  handUseCard) + surfaced pick の候補リスト記録で decoy 除外を実 assert。
  検証 = 出荷済 B07032/B07036/B09089 の再生成 probe **11/11 GREEN** (hand probe と意味一致)。
  適用範囲 (fail-closed): declared / enter-selfOnly / event-use = batch2 実測で **14/33 abilities 自動**、
  observer hook・continuous・misread・choice は MANUAL 報告。
- **check-smoke-baseline fix**: 初回 smoke report (`-N` なし filename) を検出できず「no smoke report
  found」誤報する再発 nit (06-24/06-27/07-02/07-09 の 4 回目) を regex optional-suffix 化で恒久解消。
- gates: tsc0 / vitest **4331 pass +1 skip** (+11 harness 検証) / 8 lint err0 / src 変更 0 (smoke 不変)。
