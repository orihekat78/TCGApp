# Official QA Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公式FAQ項目を安定ID化し、対象処理・実装・挙動test・未解決票へ全件追跡可能にする。

**Architecture:** live API取得とdisk writeを分離し、FAQ本文はcommitせずhash-only manifestを生成する。source/engine/testの`qa:`注釈をtrace generatorが集約し、offline CIは未対応とstaleを検出する。

**Tech Stack:** Node.js/TypeScript, TSV/JSON, Vitest, Conan CardDef/Effect DSL

## Global Constraints

- 2026-07-16 live: 22 package/2,240印刷。local: 21/2,074。差分はCT-P10 166印刷だけ。
- live FAQ: 1,538印刷/4,345質問/2,644安定QA ID。local欠落は132印刷/457質問。
- 既存2,074印刷の`q_a`変更は0。同期とCardDef実装を同じwaveへ混ぜない。
- raw公式本文はcommitしない。公式source失敗を「変更なし」にしない。
- `全公式準拠`と`現行出荷準拠`を別指標にし、未出荷をverifiedへ数えない。

---

### Task 1: API read/write分離とstale checker

**Files:**
- Create: `scripts/cards/official-api.cjs`
- Create: `scripts/cards/check-official-sync.cjs`
- Modify: `.claude/specs/cards-data/_raw/_fetch_all.cjs`
- Modify: `package.json`
- Test: `tests/scripts/official-api.test.ts`

- [ ] RED: 2-page、retry、count mismatch、no-write、未知set発見をmock testする。
- [ ] pure取得処理とraw writerを分離し、`npm run cards:check`を追加する。
- [ ] 現baselineで`added=166, removed=0, qaChanged=0`をmachine JSONへ出す。

### Task 2: FAQ normalizerと安定ID

**Files:**
- Create: `scripts/cards/qa-normalize.cjs`
- Modify: `scripts/compiler/tsv-corpus.cjs`
- Test: `tests/compiler/qa-normalize.test.ts`

**Interfaces:**
```ts
type QaItem = { qaId:string; cardId:string; cardNums:string[]; section:string; questionHash:string; answerHash:string };
```

- [ ] legacy JSON 462件とQ/A text 944件、CRLF、NFKC、空白、variant重複をfixture化する。
- [ ] `qaId=card:<cardId>:sha256(normalizedSection+'\0'+normalizedQuestion)`、回答は別hashにする。
- [ ] B06098の同一質問/別sectionとB02086/Pの空白差を回帰し、answer conflict 0を確認する。

### Task 3: Data-only同期

**Files:**
- Modify local ignored data: `.claude/specs/cards-data/_raw/*.json`, `ct-p10/*.tsv`
- Modify: `.claude/specs/cards-data/INDEX.md`, `.claude/specs/cards-data/packages.md`
- Test: `tests/compiler/cards-data-consistency.test.ts`

- [ ] clean worktreeで`npm run cards:fetch`を実行し、22/2,240とCT-P10 166件を確認する。
- [ ] raw/TSV cardNum集合、normalized FAQ hash、package/kind件数、重複0を検査する。
- [ ] INDEXの19/2,049というstale値を手書き固定値でなく生成status参照へ置換する。

### Task 4: Hash-only trace generator

**Files:**
- Create: `scripts/gen-docs/gen-qa-trace.ts`
- Modify: `scripts/gen-docs/index.ts`, `package.json`
- Generate: `.claude/auto/qa-manifest.json`, `.claude/auto/qa-trace.md`
- Test: `tests/scripts/gen-qa-trace.test.ts`

- [ ] source/engine/testの`// qa: <qaId>`を収集し、shipped/deferred/missingを出す。
- [ ] dangling ref、digest drift、testなしmatched、shared engine、多printingをtestする。
- [ ] 本文なしでqaId/cardId/cardNums/questionHash/answerHash/source日時だけを追跡する。

### Task 5: Rules 22〜26 provenance

**Files:**
- Create: `.claude/rules/qa-sources.json`
- Modify: `.claude/rules/22-qa-action-contact.md`〜`26-qa-deck-refresh.md`
- Test: `tests/scripts/rule-qa-provenance.test.ts`

- [ ] URL/postId/status/summary hashを保存し、全rule bulletへ`qa-ref`を付ける。
- [ ] postId不明は`unverified`、未裁定はBUG/DEFER参照必須にする。
- [ ] commmune全件取得を証明できなければsource metadataを`exhaustive:false`にする。

### Task 6: Coverage backfill wave

- [ ] 初回はnonblocking reportを作り、単なるcardId mentionをcoverageに数えない。
- [ ] rule family/card family単位でRED→最小修正→水平decision-table testを実施する。
- [ ] mismatchはBUG、公式待ちはDEFER、manual裁定は理由付きmanual-onlyへ分類する。
- [ ] Engine変更はT3、カードfamilyは`card-wave`、UIは製品Playwrightへ分離する。

### Task 7: Offline lintとCI

**Files:**
- Create: `scripts/lint-qa-trace.ts`, `.claude/specs/qa-trace-baseline.json`
- Modify: `.github/workflows/ci.yml`, `package.json`
- Create: `.github/workflows/cards-sync.yml`

- [ ] collision/conflict/dangling/new-or-changed未追跡/baseline悪化を`npm run lint:qa`でfailする。
- [ ] PRはhash manifestでoffline検査し、scheduled jobだけがnetwork `cards:check`を行う。
- [ ] `unmapped/mismatch/stale/legacy-unreviewed`が1件でもあれば全件整合宣言を禁止する。
