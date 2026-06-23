# 次セッション再開プロンプト (2026-06-23 — BUG-153 修正 + B05035 解禁 wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション51 — BUG-153 修正 + B05035 解禁 wave を main へ ff-merge + push 済 = fix b36df029 + chore fcf32460)
refactor-plan は全完了済。51 は **engine additive 小 wave** (㊿ 敵対 review が起票した BUG-153 を修正し DEFER 解禁)。
- ★開始時に `git ls-remote origin main` で local HEAD 一致 + CI (`gh run list -L1`) green を確認。
- 直前㊿ (codegen-handcount-setevent) は 7eaacff0。51 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## 51 サマリ (検証済: tsc0両 / vitest 2888→2896(+8) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本errors0)
- **engine additive 10行** (char.ts のみ): `charSetCard{fromDeckTop}` の fromDeckTop explicit-uid 分岐で
  `sscDeck.shift()` の前に `readScene.byUid(s, scUid)` で host 存在を確認、不在なら shift せず return。
  byUid は setCard の findChar と byte-identical な scene scan (self+opp) ゆえ host-present 完全不変=回帰0。
  既存行の変更ゼロ。BUG-153 = host 離場時に上端カードが deck/remove/setCards のどこにも残らず消失していたバグ。
- **出荷 1** (ALL_CARDS 1409→1410): B05035 遠山和葉 (緑5/高校生) 【登場時】reveal-1 (cardName OR
  [服部平次/遠山和葉]) → 任意手札追加 (chooseMatch:'upTo') → 加えねば裏向きセット (charSetCard fromDeckTop)。
  DSL = B01050 (reveal+conditional add) + B02019 (upTo decline) + B03061 (set-facedown) 合成。
- **敵対 review** (opus 3 lens: B05035 faithfulness / BUG-153 engine correctness / 水平展開): **3/3 PASS、0 BLOCKER**。
  concern 1 = BUG-153 影響範囲が ~30枚へ過少申告 (host≠$self の B03034/$contact・B07058/$entered・PR049/$pick・
  B02020/opp PA短縮形 が真の host-absent 到達経路、全件 faithfulness 改善方向・回帰なし) → BUG-153.md に反映済。
- decoy test: tests/cards/wave-bug153-setcard-host-check-2026-06-23.test.ts (8件: host-absent/host-present回帰0/
  empty-deck + B05035 4経路 + descriptor)。BUG-153.md status→修正済 / DEFERRED-INDEX B05035 解禁。

## 次にやること (要ユーザー選択)
A) **カード追加 継続** (.tmp/inventory-remaining.json + 棚卸所見、★ラベル不可信=要 grounding):
   - **残 leave-trigger 観測者型 = 最大 engine 投資先**: D:ally-removed-observer(7) / E:opp-removed-observer(2) /
     F:self-revive(5) / A:contact-removal-self(3)。leave payload に cause判別+他キャラdef matcher を additive。最大 yield・回帰リスク高。
   - **より大きい engine 投資**: opp-evidence-removed(6,high) / MR①②(rules/18配線、B07065等解禁) / 任意card名 rewrite verb(PR099等) /
     setCount dyn token (B05030 a2 解禁) / entered-char binding (B07068 解禁) / opp-hand reveal (B07100 解禁)。
   - **engine変更0 で残る純既存パターン**があれば最優先 (codegen pipeline 可)。
   → **着手前に1クラスタを certify/grounding で精査して真 yield 確定**。㊿〜51 の教訓: 棚卸ラベルは不可信
     (㊿「codegen 7+P」→実は手書き4+5DEFER)、敵対 review が出荷直前に BLOCKER 検出 (B05035→BUG-153)。member 毎 full-text grounding 必須。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (カード wave)
- **着手前に member 毎 full-text TSV 再取得 + grounding** (棚卸 eff は truncate、二次節に engine gap が隠れる)。
  green/clean/codegen ラベル不可信。各句を 公式テキスト⇔rules⇔実 engine コードで裏取り (決定論スクリプト優先 → 不足分のみ opus grounding)。
  ★grounding/scoping の DSL sketch は exemplar 誤認・rules 誤適用・card名誤りを含む → 必ず exemplar 実ファイル+rules+TSVで訂正。
- **engine変更0 wave が最優先**。engine 拡張する場合のみ additive+回帰ゼロ厳守 (legacy形保持/新verb·flag·hook·dyn token)。
  ★51 の BUG-153 修正が好例: 新 read query (byUid) 1行 import + 既存挙動と byte-identical な guard を shift 前に挿入、
  既存行ゼロ変更、smoke baseline 完全不変 (MVPデッキ未到達)。engine 触る時はこのレベルの additive を厳守。
  二次節に未対応 capability があれば **partial-ship** (a1 DEFER + 他出荷、先例B04059) か **whole-DEFER** を faithfulness で判断。
- engine拡張·新capabilityカードは **codegen でなく手書き** (exemplar照合)。純既存パターンは codegen pipeline 可。
- **decoy engine test 必須**: enter は `useDeclaredAbility`/`handUseCard` で駆動 → `runAllUntilEmpty`+`drainAiEffectPicks`、
  set-facedown は `runEffect(effect, ctxFor(cardId,uid))` で host.setCards 検証。
  decoy(wrong trait/level/color/name/kind)込み1対1 witness + gate。harness: wave-bug153-setcard-host-check-2026-06-23.test.ts /
  wave-codegen-handcount-setevent-2026-06-23.test.ts / B02019.test.ts 参照。
- **敵対 faithfulness review 必須** (opus workflow、1カード=1 lens + engine lens、SUB≤5・1つずつ)。
  ★review は飾りでなく最終ゲート。BLOCKER は DEFER + BUG 起票で対応 (㊿ B05035→BUG-153 が実例)。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"` (_reuse/index.ts へ挿入)。
  撤去時は手で _reuse/index.ts の import + 配列 entry を削除 (taskA-register に unregister 無し)。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2896) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.6min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
  ★validate-specs の FAIL PR280 は既存・無関係。engine 触る wave は git diff src/engine で additive のみ精査。
  ★BUG-XXX.md の status は enum内 (未着手/対応中/修正済/見送り/仕様外)。status=修正済 は `commit:` hash 必須
   (lint-bug-frontmatter)。自己参照 hash は placeholder→commit→amend、または小 follow-up commit で実 hash 反映 (51 で後者を実施)。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design (?? のみ、auto-mapping の *-design.md は M で対象)。git add -A 禁止。
  ★reports 新 smoke + .tmp-taskA-registered.json は gitignore 済 ゆえ commit 不要。重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
