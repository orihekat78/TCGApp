# YOU vs CPU System Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固定10デッキの順序付き100組を、YOU側の実UI操作で検証し、能力coverageを別途100%割り当てる。

**Architecture:** 10デッキをstable ID付き共有fixtureへ固定する。UTはデッキ/操作方針/能力責任を検査、ITはheadless 100組、STは5174 setupからdesktop 100組をDOM clickだけで実行する。mobileは3 viewportの高リスク6組を再実行する。

**Tech Stack:** Meta React UI, Playwright, Vitest, Conan match logs

## Global Constraints

- 10デッキ: 少年探偵団・標準、警察・標準、緑アグロ、黒赤デッキ、青緑、疾風、デッキ破壊、TEST-バグ波-緑、TEST-コンタクト、TEST-無制限0627。
- 現在コードfixtureは標準2件だけ。残り8件をbrowser localStorage依存のままCIへ持ち込まない。
- STは`setGameState`、`__game.dispatch`、forced click、CPU pause禁止。`getState()`は観測だけ許可。
- 30turn cap、操作上限、console/page error、pointer interception、stale pendingは成功に数えない。

---

### Task 1: 共有deck catalog

**Files:**
- Create: `tests/fixtures/decks/you-vs-cpu-10.ts`
- Create: `tests/meta/you-vs-cpu-deck-catalog.test.ts`
- Create: `meta-app/tests/e2e/helpers/installDeckCatalog.ts`

- [ ] RED: 厳密10件、stable ID、各40枚、partner/case、全card ID解決をtestする。
- [ ] 同一ID上限3と公式無制限例外をcardId合算で検査する。
- [ ] ユーザー提供5コード、標準2件、TEST3件をfixtureの正本として固定する。
- [ ] ordered matrix=100、対角10、非対角90、A/BとB/Aを別caseとして検査する。
- [ ] `page.addInitScript`でgoto前にcatalogを投入し、setup画面で実際に選択する。

### Task 2: Human intentとability manifest

**Files:**
- Create: `tests/ai/you-vs-cpu-human-intent.test.ts`
- Create: `tests/cards/you-vs-cpu-ability-manifest.test.ts`
- Create: `meta-app/tests/e2e/helpers/humanOperator.ts`

**Interfaces:**
```ts
type HumanAction = { kind:string; cardId?:string; abilityId?:string; targetUid?:string };
```

- [ ] 優先順を`判断→宣言能力→手札使用→アクション→推理→アシスト→NH→END`としてpure testする。
- [ ] 合法手ありでENDを選ばない、modal同時1件、1turn 20操作超過をfailする。
- [ ] 10デッキ全能力をcardId/abilityIdで棚卸しし、各能力へUT/IT/ST責任testを最低1件割り当てる。

### Task 3: Headless IT ordered 100

**Files:**
- Create: `tests/helpers/you-vs-cpu-match-runner.ts`, `tests/helpers/ability-coverage.ts`
- Create: `tests/integration/you-vs-cpu-ordered-matrix.test.ts`

- [ ] seed=`yvscpu-it-v1-${i}-${j}`、先攻=`(i+j)%2`で100組を実行する。
- [ ] 毎turnでzone conservation、pending/action context cleanup、exception 0を検査する。
- [ ] terminalとturn-capを別集計し、能力をcardId/abilityId/owner/turnで記録する。

### Task 4: Meta ST actual-click 100

**Files:**
- Create: `meta-app/tests/e2e/you-vs-cpu-round-robin.spec.ts`
- Create: `meta-app/tests/e2e/helpers/matchOracle.ts`, `matchTelemetry.ts`
- Modify: `meta-app/playwright.config.ts`
- Review: `tests/e2e/full-match-human-vs-cpu.spec.ts`

- [ ] 各caseをsetup→deck選択→先攻→開始→mulligan→active play→result→次setupまでクリックする。
- [ ] CPUターンを手動dispatchせず、click後にlog/turn/zone/pendingの変化を待つ。
- [ ] desktop 100組を25組×4 shard、`--workers=1`で実行する。
- [ ] 既存END中心/dispatch直呼びspecをsystem証拠に数えず、engine smokeと明記する。
- [ ] 120秒/試合、5秒無進行をstuckとしてseed、直前20log、pending、trace、screenshotを保存する。

### Task 5: Mobileと能力専用ST

**Files:**
- Create: `meta-app/tests/e2e/you-vs-cpu-card-effects.spec.ts`

- [ ] 393×851、360×640、851×393で高リスク6組を実クリック再実行する。
- [ ] Meta configへ`mobile-393x851`、`mobile-360x640`、`mobile-851x393`を追加する。
- [ ] 人間判断、複数pick、並べ替え、コンタクト、カットイン、変装、宣言コスト、FILE/removeをST必須にする。
- [ ] 100組未発火能力は確定seed/test deckで発動し、未発動と未テストを分離する。
- [ ] すべての判断でowner/chooser/対象UID/解決state/次の合法操作をassertする。

### Task 6: 機械ゲートとCI

**Files:**
- Create: `scripts/lint-system-e2e.ts`, `scripts/report-ability-coverage.ts`
- Modify: `.github/workflows/ci.yml`, `package.json`
- Create: `.github/workflows/you-vs-cpu-nightly.yml`

- [ ] system spec内のdispatch/state注入/force/CPU pauseをlint failureにする。
- [ ] PRはUT/IT100/targeted ST、nightly/releaseはdesktop100＋mobile18を必須にする。
- [ ] 成功条件をwinner 100/100、console/page error 0、pending/session leak 0、操作不能0とする。
- [ ] 100組完走と能力coverageを別報告し、未テスト能力0件をrelease条件にする。
