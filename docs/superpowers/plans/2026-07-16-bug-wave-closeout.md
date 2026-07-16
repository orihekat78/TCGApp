# Current Bug Wave Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BUG-202〜230と再開票を、検証済みbaselineと明示的な未完了入力へ分離する。

**Architecture:** 全票修正済みを前提にしない。変更・票・テストをmanifestで固定し、各票を検証済み/仕様外/未修正/公式確認待ちへ分類する。未修正だけを次waveへ送り、安定baselineに対して全ゲートを実行する。

**Tech Stack:** TypeScript, React, Vitest, Playwright, Vite, Conan Engine DSL

## Global Constraints

- T3。Root=`gpt-5.6-sol high`、実装修正=`gpt-5.6-terra high`、機械監査=`gpt-5.6-luna medium`。
- このphaseで`cards:sync`、新カード、AI方針改善、無関係refactorを行わない。
- 新しいroot causeは新BUGへ分離する。公式未確定事項は推測修正しない。
- ユーザー指示なしにcommit/pushしない。生成物は`npm run docs`以外で編集しない。

---

### Task 1: Wave manifestとscope gate

**Files:**
- Create: `.claude/specs/you-vs-cpu-hardening-wave-manifest.json`
- Create: `scripts/check-wave-scope.ts`
- Create: `tests/scripts/check-wave-scope.test.ts`
- Modify: `package.json`

- [ ] BUG-202〜230と再開BUG-130/140/158/166/167/176/180をmanifestへ入れる。
- [ ] 分類、ownership、実装path、test path、検証command、次wave送付理由を記録する。
- [ ] RED: manifest外変更、存在しないpath、同一変更の複数RCA所属をfailするtestを書く。
- [ ] `npm run check:wave-scope`を追加し、tracked/untracked全差分を検査する。
- [ ] BUG-227〜230も黙って除外せず、今回検証か次waveかを明記する。

### Task 2: Ticket/changelog整合lint

**Files:**
- Create: `scripts/lint-bug-closure.ts`
- Create: `tests/scripts/lint-bug-closure.test.ts`
- Modify: `.claude/changelog-entries/2026-07-16-01-you-vs-cpu-hardening.md`
- Modify: `.claude/specs/you-vs-cpu-hardening-wave-manifest.json`

- [ ] RED: `RCA=調査中`、date/test/implementation commit欠落、changelog fixesと票status不一致をfailする。
- [ ] `仕様外`をfixesへ入れた場合と、未修正を`修正済`にした場合をfailする。
- [ ] 現在全て`対応中`のBUG-202〜230を証拠に基づき分類し、矛盾を解消する。

### Task 3: 未完票だけを修正

- [ ] 修正で増減したpathとticket分類をwave manifestへ反映する。
- [ ] 未修正票ごとに公式期待のRED probeを先に作る。
- [ ] owner/human side/chooser/target/ability ID、0/1/複数、辞退、terminal、次の合法行動を確認する。
- [ ] 実カードproduction pathを最低1件含め、同型consumerを水平監査する。
- [ ] 別root cause発見時はpatch-and-continueせず、新BUG化してmanifestへ戻す。

### Task 4: Focused回帰と全ゲート

**Files:**
- Test: `tests/e2e/engine-extensions-2026-06-05.spec.ts`
- Test: `tests/e2e/reasoning-hook-batch3-2026-06-06.spec.ts`
- Test: `tests/e2e/bug-211-212-product-path.spec.ts`
- Test: `meta-app/tests/e2e/effect-decision-hosts.spec.ts`

- [ ] Root/Meta対象をdesktop/mobileで通し、CPU pause fixtureとterminal fixtureを分離する。
- [ ] `npm run typecheck && npm run lint && npm run lint:bugs`を通す。
- [ ] `npm run lint:listener && npm run lint:side-channel && npm run lint:icon-abilities`を通す。
- [ ] `npm test`、`npm run smoke:1000`、`npm run benchmark`を通す。
- [ ] `npm run test:e2e`、`npm run test:meta:e2e`を全件通す。
- [ ] `npm run docs && npm run docs:check`後、生成差分を一度だけ確定する。

### Task 5: 実ブラウザ製品確認

- [ ] `/#setup`→YOU vs AI→マリガンを画面クリックだけで完了する。
- [ ] 登場、イベント、推理、アクション、コンタクト、人間判断を合法時に実行する。
- [ ] 判断後pending 0、別の合法行動成功、console/page error 0を確認する。
- [ ] `/#match`で開発HUD非表示、desktopと393×851でpointer遮蔽0を確認する。

### Task 6: Baseline確定

- [ ] 各票を`検証済み/仕様外/未修正/公式確認待ち`で一覧化する。
- [ ] 未修正・確認待ちは`対応中`のまま次waveへ送り、全件修正済みを名乗らない。
- [ ] 自己レビュー、水平調査、実行結果をchangelogとmemoryへ記録する。
- [ ] commit指示時は実装commitとticket closeout commitを分け、票の`commit:`は実装commitを指す。
