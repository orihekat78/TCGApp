# 次セッション再開プロンプト (2026-06-23 — wave decklook-enter-handadd 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション52 — wave decklook-enter-handadd を main へ ff-merge + push 済 = 11d9b641)
refactor-plan は全完了済。直前51 (BUG-153 + B05035) は b36df029/fcf32460/a84ab8da。
- ★開始時に `git ls-remote origin main` で local HEAD 一致 + CI (`gh run list -L1`) green を確認。HEAD=11d9b641。
- 52 は前コンテキスト実装済 wave の resume → 全 gate 再検証 → commit/push (engine変更0)。詳細は memory.md / sessions/2026-06-23.md。

## 52 サマリ (検証済: tsc0両 / vitest 2896→2910(+14) / smoke winsA=498 exc0 baselineOK / e2e 98pass+1skip / 規約lint8本errors0)
- **engine変更0** (git diff src/engine 空が確証)。出荷 7枚 (ALL_CARDS 1410→1417):
  B05016/B05016P 小嶋元太・B09079 佐藤美和子・B06048/B06048P 峰さやか・B06053/B06053P 鉄刃。
  【登場時】reveal(upTo|until)+filter(trait/cardName/kind)→任意手札追加→残りリムーブ/デッキ下。
  exemplar = B07035 a1 / B06010 a1 / B01050 の純既存 verb 流用。
- **YAIBA event trait データ補完** (engine変更0、先例 ef29f608): event.tsv に features 列が無く
  実装済 YAIBA イベント (B06035/B06033) が traits:[] で永久非マッチだった → 公式 API category1=YAIBA を
  正本に traits:['YAIBA'] 補完 (B06033P は spread 継承)。B06048 event枝 / B06053 match経路が live 化。
- **敵対 review** (opus): v1 5-lens で **1 BLOCKER** (B06053 DEFER 誤判定 → backfill で同 wave 解消) +
  1 CONCERN (B06048 event枝未追跡) を検出・解消。v2 2-lens 再 review で delta 再検証。
- decoy test: tests/cards/wave-decklook-enter-handadd-2026-06-23.test.ts (14件: filter各軸1対1 witness +
  解決編 tail discard 4分岐 + event枝 + YAIBA backfill regression + descriptor + P=base 等価)。

## 残カード実数 (2026-06-23 live 計測、棚卸 json の 666 は stale cache 由来=不可信)
- **universe 2049 − 実装済 1417 = 残 632** (base非P 421 + P変種 211)。engine変更0 実装可 clean ≈ 520。
- 実数は `.tmp/_count.mts` (tsx で再走) か、`.tmp/_registered-ids.json` を live ALL_CARDS で再生成後に
  `node scripts/inventory-remaining.cjs`。inventory json の total は cache 依存ゆえ過大。

## 次にやること (要ユーザー選択)
A) **カード追加 継続** (残 632、clean~520。★棚卸ラベル不可信=要 grounding):
   - **engine変更0 で残る純既存パターン**を最優先 (codegen pipeline 可)。
   - engine 投資先 (大yield): leave-trigger 観測者型 (D/E/F/A) / opp-evidence-removed(6) / MR①②(rules/18) /
     setEvent-to-char(18) / hand-count-cond(12) / flipFaceDown verb(8) 等。additive+回帰ゼロ厳守。
   → **着手前に1クラスタを certify/grounding で精査して真 yield 確定** (㊿〜52 教訓: 棚卸ラベル不可信、
     敵対 review が出荷直前に BLOCKER 検出)。member 毎 full-text grounding 必須。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## 並行セッション (複数セッションで同時カード実装する場合の協調、2026-06-23 確立)
- **可能、但 shared file 衝突あり**。衝突する: `src/cards/_reuse/index.ts` (registry append) /
  `.claude/auto/*`+`CHANGELOG.md` (全再生成) / NEXT-SESSION-PROMPT・memory・DEFERRED-INDEX (共有状態)。
- **衝突しない**: 個別カード src/cards/ct-pNN/*.ts (集合 disjoint なら) / wave test (名前一意) / changelog-entry (seq一意)。
- 協調プロトコル: ①パッケージ分担しカードID重複ゼロ ②git worktree 分離 ③main merge は直列
  (片方 push → 他方 rebase → `taskA-register.cjs`+`npm run docs` 再走で機械解決 → merge) ④敵対 review workflow は同時不可
  (server rate-limit、1つずつ・SUB≤5)。registry/auto-doc 衝突は手動 merge でなく**再生成で解決**。

## プロセス必須 (カード wave)
- **着手前に member 毎 full-text TSV 再取得 + grounding** (棚卸 eff は truncate、二次節に engine gap が隠れる)。
  green/clean/codegen ラベル不可信。各句を 公式テキスト⇔rules⇔実 engine コードで裏取り (決定論スクリプト優先)。
  ★grounding/scoping の DSL sketch は exemplar 誤認・rules 誤適用・card名誤りを含む → 必ず exemplar 実ファイル+rules+TSVで訂正。
- **engine変更0 wave が最優先**。engine 拡張する場合のみ additive+回帰ゼロ厳守 (legacy形保持/新verb·flag·hook·dyn token)。
  ★51 BUG-153 が好例: 新 read query 1行 import + byte-identical guard を挿入、既存行ゼロ変更、smoke baseline 完全不変。
  二次節に未対応 capability あれば partial-ship (a1 DEFER + 他出荷) か whole-DEFER を faithfulness で判断。
- engine拡張·新capabilityカードは **codegen でなく手書き** (exemplar照合)。純既存パターンは codegen pipeline 可。
- **decoy engine test 必須**: enter は `useDeclaredAbility`/`handUseCard` で駆動 → `runAllUntilEmpty`+`drainAiEffectPicks`、
  set-facedown は `runEffect(effect, ctxFor(cardId,uid))` で host.setCards 検証。
  decoy(wrong trait/level/color/name/kind)込み1対1 witness + gate。harness: wave-decklook-enter-handadd-2026-06-23.test.ts /
  wave-bug153-setcard-host-check-2026-06-23.test.ts / B02019.test.ts 参照。
- **敵対 faithfulness review 必須** (opus workflow、1カード=1 lens + engine lens、SUB≤5・1つずつ)。
  ★review は飾りでなく最終ゲート。BLOCKER は DEFER + BUG 起票 か 同 wave データ補完で対応 (㊿ B05035→BUG-153、52 B06053→YAIBA backfill が実例)。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"` (_reuse/index.ts へ挿入)。
  撤去時は手で _reuse/index.ts の import + 配列 entry を削除 (taskA-register に unregister 無し)。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2910) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=99: 98pass+1skip、~4min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
  ★validate-specs の FAIL PR280 は既存・無関係 (pass=72 fail=1 needsManual=7)。engine 触る wave は git diff src/engine で additive のみ精査。
  ★lint-test-pair WARN (個別 test pair 無し) は非ブロック (wave 共有 decoy test で網羅していれば可)。
  ★BUG-XXX.md の status は enum内 (未着手/対応中/修正済/見送り/仕様外)。status=修正済 は `commit:` hash 必須 (lint-bug-frontmatter)。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。col0=cardNum(B05016) col1=numericId。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design (?? のみ、auto-mapping の *-design.md は M で対象)。git add -A 禁止。
  ★reports 新 smoke + .tmp-taskA-registered.json は gitignore 済 ゆえ commit 不要。重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
