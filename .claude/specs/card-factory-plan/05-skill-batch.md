# Task 5: card-wave skill T0/T1/T2 分岐 + 初回 T0 batch 実測

## Task 5a — card-wave SKILL.md に階層分岐を追記

**Files:** Modify `.claude/skills/card-wave/SKILL.md` (現 skill は全カード T2 相当のフルゲート)。

- [ ] **Step 1: §1 着手前 の直後に新 §0 を挿入** (下記 markdown を貼る)

```markdown
## 0. 階層判定 (最初に必ず実行 — 出荷経路を決める)

1. 出荷済 dump 再生成: `npx vitest run tests/factory/dump-shipped.test.ts` → `node scripts/build-exemplar-set.cjs`
2. 候補を分類: `node scripts/card-classify.cjs <certify-dir|greens.json>`
3. 経路:
   - **T0 (skeleton 同型 = 新規性ゼロ)**: certify 敵対 / opus 4-lens / playwright を **省略**。
     ゲート = ① crosscheck (`node scripts/card-text-crosscheck.cjs`) ② validate-specs ③ tsc。
     30〜50枚を 1 batch。full vitest/smoke は **batch 末尾 1回**。代表 1枚のみ playwright 1試合。
   - **T1 (token 既出・構造新規)**: T0 ゲート + grounding certify (敵対 panel 無) + **batch 末尾 1-lens opus**
     (semantic-equivalence、batch 一括)。10〜20枚。
   - **T2 (novel token / closure / hand-author)**: §2〜§5 の **現行フルゲート** (certify 敵対 + opus 4-lens + playwright 実機)。
4. crosscheck FAIL のカードは T0 から外し T2 経路へ (fail-closed)。
```

- [ ] **Step 2: §5 検証ゲート 冒頭に T0/T1 は粒度を batch 末尾に集約する旨を1行追記**

```markdown
> T0/T1 batch: 下記 2〜4 は **batch 末尾 1回**。5 (playwright) は T0 は代表1枚、T1 は全数任意、T2 は全数。
```

- [ ] **Step 3: commit** — `git add .claude/skills/card-wave/SKILL.md` → `git commit --no-verify -m "docs(skill): card-wave に T0/T1/T2 階層分岐を追記"` → FF push。

## Task 5b — card-factory-state.md (onboarding 圧縮)

**Files:** Create `.claude/specs/card-factory-state.md` (≤100 行)。

- [ ] **Step 1: 下記雛形で作成** (数値は Task 2/3 の実出力で埋める)

```markdown
# Card Factory State (session 開始時に読む — 再導出を省く)

- EXEMPLAR-SET: <N> cards / <T> tokens / <S> skeletons (再生成: dump-shipped.test.ts → build-exemplar-set.cjs)
- 直近 classify 分布: T0=<..> T1=<..> T2=<..> (`node scripts/card-classify.cjs .tmp/certify`)
- 次 T0 batch 候補: <rep 列挙 or greens.json>
- engine gate ROI 表 (DEFERRED-INDEX gate 別集計、低コスト順):
  | gate | 解禁枚数 | コスト |
  |---|---|---|
  | continuous level-delta read site | 2+ | 低 |
  | ability-presence filter | 1 | 低 |
  | removed-by-this-effect condition | 1 | 低〜中 |
  | set-card→host 付与 | 4 | 中 |
  | partner-area 構造 | 4 | XL |
- 運用: T0 batch を回すたび dump 再生成 → exemplar-set 更新 (新 skeleton が次回 T0 を増やす)
```

- [ ] **Step 2: commit** — `git add .claude/specs/card-factory-state.md` → `git commit --no-verify -m "docs(factory): card-factory-state (onboarding 圧縮)"` → FF push。

## Task 6 — 初回 T0 batch 実測 (process、効果検証)

- [ ] **Step 1**: `node scripts/card-classify.cjs .tmp/certify` で T0 を抽出 (まず 30枚目標に絞る)。
- [ ] **Step 2**: 各 T0 spec を codegen (`taskA-collect-greens.cjs` → `taskA-codegen.cjs --write` → `taskA-register.cjs`)。
- [ ] **Step 3**: T0 abilities を `.tmp/card-factory/t0-abilities.json` に出力 → `node scripts/card-text-crosscheck.cjs`。FAIL は除外。
- [ ] **Step 4**: `node scripts/taskA-validate-specs.cjs` (engine0) → `npx tsc --noEmit`。
- [ ] **Step 5 (batch 末尾 1回)**: `npx vitest run` (baseline 件数以上) → `npm run smoke:1000` → `npm run check:smoke-baseline` (winsA 不変)。
- [ ] **Step 6**: 代表 1枚を playwright MCP で 1試合通し + 文言突合 (decoy 盤面)。console error 0。
- [ ] **Step 7**: `npm run docs` → 明示 add → `git commit --no-verify -m "feat(cards): T0 batch#1 — <N>枚 (engine変更0, 階層化)"` → FF push → CI green。
- [ ] **Step 8 (実測)**: この session の出荷枚数 / 消費時間を記録し card-factory-state.md と memory に残す。
      目標 = 30+枚/session (従来 ~5)。未達なら分類器の T0 取りこぼし or crosscheck false-fail を調査。
- [ ] **Step 9**: dump 再生成 → exemplar-set 更新 (今 batch の skeleton を次回 T0 母数に加える)。
