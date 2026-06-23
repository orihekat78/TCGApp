# 次セッション再開プロンプト (2026-06-23 — codegen-handcount-setevent wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション㊿ — codegen-handcount-setevent wave を main へ ff-merge + push 済 = feat 7eaacff0)
refactor-plan は全完了済。㊿ は **カード追加 (A)**。ユーザーが「A-codegen 軽量wave」を選択 → 棚卸ラベル
「codegen 即出荷 hand-count-cond + set-event-to-char (7+P)」を member 毎 full-text TSV grounding した結果
**ラベルは誤り**と判明 (process の「green/clean ラベル不可信」を実証): 7枚は MR/複数名/opp-hand reveal/
entered-char binding/setCount-dyn/任意rename の engine gap を二次節に含み codegen でなく手書き。
ユーザー再確認 (scope 訂正) の上 engine変更0 で 4枚出荷 (ALL_CARDS 1405→1409)。
- ★開始時に `git ls-remote origin main` で local HEAD 一致 + CI (`gh run list -L1`) green を確認。
- 直前㊾ (leave-from-remove) は ec26d2e8/84b78dc9。㊿ 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## ㊿ サマリ (検証済: tsc0両 / vitest 2881→2888(+7) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本errors0 / engine diff 0)
- **engine変更ゼロ**: 既存 charSetCard{fromDeckTop}(B03061) + sceneEnter{from:remove}(B01076) + charGrantKeyword
  突撃[キャラ]scope:turn(D09027) + fileFrom cost(B05037) + handAtMost declared-gate(B07067) の settled path 再録のみ。src/cards のみ touch。
- **出荷4** (各touched1): B07069/P 本堂瑛海 (a1 declared and[partnerColor赤,handAtMost2] lv≤8 remove / a2【FILE8】declared
  pay[sleepSelf,removeFromHand,fileFrom]→remove lv≤7赤 revive) / PR099 工藤有希子 (a1 set-facedown+突撃[キャラ]EOT, a2 DEFER) /
  B05030 遠山銀司郎 (印字突撃[キャラ] + a1 set-facedown, a2 DEFER)。PR099/B05030 は partial-ship (先例B04059)。
- **DEFER5** (DEFERRED-INDEX §codegen-handcount-setevent): B07065(MR+複数名) / B07068(entered-char binding gap) /
  B07100(opp-hand reveal/removal gap) / PR099-a2(任意rename verb無) / B05030-a2(setCardCount dyn無)。
- **★敵対 review が B05035 を BLOCKER 検出 → DEFER + BUG-153 起票**: else-set の `charSetCard{fromDeckTop}` は
  host 解決→deck.shift→setCard。host 不在時 setCard no-op で公開カード消失 = 公式Q&A『離場時はデッキ上に戻す』違反。
  **charSetCard 共有 engine の順序バグ** (set-facedown 一族全て: B03061/B07034/PR099/B05030 等、shift-before-host-check)。
  B05035 のみ Q&A が host-absent 明示ゆえ DEFER (engine変更0 で DSL 修正不可)。BUG-153 修正 (host-check→shift 順、additive) 後に B05035 再出荷可。
- decoy test: tests/cards/wave-codegen-handcount-setevent-2026-06-23.test.ts (7件)。

## 次にやること (要ユーザー選択)
A) **カード追加 継続** (.tmp/inventory-remaining.json + 棚卸所見、ただし★ラベル不可信=要 grounding):
   - **BUG-153 修正 → set-facedown 一族解禁の小 engine wave**: charSetCard fromDeckTop を host 存在チェック→shift 順に
     additive 修正 (回帰0: host 存在時 従来通り)。B05035 再出荷 + host-absent decoy test 追加。低リスク・小 yield だが engine bug 是正。
   - **残 leave-trigger 観測者型 = engine 投資先**: D:ally-removed-observer(7) / E:opp-removed-observer(2) /
     F:self-revive(5) / A:contact-removal-self(3)。leave payload に cause判別+他キャラdef matcher を additive。最大 yield・回帰リスク高。
   - **より大きい engine 投資**: opp-evidence-removed(6,high) / MR①②(rules/18配線、B07065等解禁) / 任意card名 rewrite verb(PR099等)。
   → **着手前に1クラスタを certify/grounding で精査して真 yield 確定**。㊿ で「codegen 7+P」が誤=実は手書き4枚+5DEFER、
     二次節に engine gap が多数あった=member 毎 full-text grounding 必須。**敵対 review が出荷直前に B05035 BLOCKER を検出した教訓も重く受け止める**。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (カード wave)
- **着手前に member 毎 full-text TSV 再取得 + grounding** (棚卸 eff は truncate、二次節に engine gap が隠れる)。
  green/clean/codegen ラベル不可信。各句を 公式テキスト⇔rules⇔実 engine コードで裏取り (決定論スクリプト優先 → 不足分のみ opus grounding)。
  ★grounding/scoping の DSL sketch は exemplar 誤認・rules 誤適用・card名誤りを含む → 必ず exemplar 実ファイル+rules+TSVで訂正。
- **engine変更0 wave が最優先**。engine 拡張する場合のみ additive+回帰ゼロ厳守 (legacy形保持/新verb·flag·hook·dyn token)。
  二次節に未対応 capability があれば **partial-ship** (a1 DEFER + 他出荷、先例B04059) か **whole-DEFER** を faithfulness で判断。
- engine拡張·新capabilityカードは **codegen でなく手書き** (exemplar照合)。純既存パターンは codegen pipeline 可。
- **decoy engine test 必須**: enter は `useDeclaredAbility`/`handUseCard` で駆動 → `runAllUntilEmpty`+`drainAiEffectPicks`、
  declared 効果も `useDeclaredAbility(uid,abilId)` で queue。set-facedown は `runEffect(effect, ctxFor(cardId,uid))` で host.setCards 検証。
  decoy(wrong trait/level/color/name/kind)込み1対1 witness + gate。harness: wave-codegen-handcount-setevent-2026-06-23.test.ts / B02019.test.ts / B07051-momoi-deckreveal.test.ts 参照。
- **敵対 faithfulness review 必須** (opus workflow、1カード=1 lens + engine-0 lens、SUB≤5・1つずつ)。
  ★㊿ で出荷直前 review が B05035 の host-absent Q&A 違反を検出 → review は飾りでなく最終ゲート。BLOCKER は DEFER + BUG 起票で対応。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"` (_reuse/index.ts へ挿入)。
  撤去時は手で _reuse/index.ts の import + 配列 entry を削除 (taskA-register に unregister 無し)。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2888) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.4min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
  ★validate-specs の FAIL PR280 は既存・無関係。engine diff 0 が真の engine0 証跡。★BUG-XXX.md の status は enum内 (未着手/対応中/修正済/見送り/仕様外)。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design (?? のみ、auto-mapping の *-design.md は M で対象)。git add -A 禁止。
  ★reports 新 smoke + .tmp-taskA-registered.json は gitignore 済 ゆえ commit 不要。重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
