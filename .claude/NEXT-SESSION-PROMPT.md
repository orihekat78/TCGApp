# 次セッション再開プロンプト (2026-06-23 — wave leave-reveal-until 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション53 — wave leave-reveal-until を main へ rebase+push 済 = 21c4268d)
refactor-plan は全完了済。直前は並行 2 wave: 491a0ede (engine session: removedCharMatches.removedFilter 拡張 +
離場キャラ属性 observer 6枚) → 21c4268d (本 session: leave-reveal-until カード 7枚、engine変更0)。
- ★開始時に `git ls-remote origin main` で local HEAD 一致 + CI (`gh run list -L1`) green を確認。HEAD=21c4268d (CI green 4m3s)。
- 53 は engine変更0 カード wave。並行 engine session が同時進行 → 私の push が reject → rebase + 再生成で機械解決 (協調プロトコル実証)。

## 53 サマリ (検証済: tsc0両 / vitest 2910→2926(+16、combined 2951) / smoke winsA=498 exc0 baselineOK / e2e 123+1skip / 規約lint8本errors0)
- **engine変更0** (git diff src/engine 空が確証)。出荷 7枚 (本 wave 分 ALL_CARDS 1417→1424、combined 1430):
  B05021 森達夫 / B03019 フサエ(+ヒラメキdraw) / B05077 ジョディ・サンテミリオン(levelMax4→登場) /
  B07086 榎本杉人(ミスリード1+加えた場合discard1) / B07043 寺井黄之助(choice3名) / B02058+B02058P 赤井秀一。
- パターン = **leave:to-remove selfOnly + condition{turn:opp} (S394成熟) × deckRevealUntil reveal-until →
  handAddFromDeck/sceneEnter → deckToBottomBound → deckShuffle (wave-08)** の合成。両半 engine-in。
  exemplar = D05007 a1 (leave reveal→enter) / B06053 a1 (reveal-until→hand+shuffle) / D01013 (hirameki draw) / D01010 (misreadX) / D02013 (choice) / B07067 a1 (handCountAtLeastOther) / D04010 (discard opp)。
- **棚卸ラベル不可信を再実証**: regex tag「cutin」クラスタは PRIMARY が cutin-use observer / set-event / event-use closure の gate だらけ (clean ほぼ0)。
  tag 横断で公式テキスト「出るまで1枚ずつ公開」を決定論抽出 (.tmp/_grep-remaining.cjs) → full-text grounding が正道。
- **capability-map stale 教訓**: grounding agent が B02058 a1 を「hand-count condition 不在」で DEFER 候補と誤判定 →
  敵対 verify が capability-map.txt(2026-06-06) の stale を検出 (handCountAtLeastOther は Task D E1 2026-06-12 で実在、eval.ts:135)。
  → full-ship 化 + capability-map L192/571 訂正。**⛔ negative claim は eval.ts/effect.ts 直参照で裏取り** (memory: reference-capability-map-stale-negatives)。
- **敵対 review** (opus 7 lens): 全7枚 faithful+engineZero、blocker 0。指摘の B03019 no-match path は assertion 追加で close。
- decoy test: tests/cards/wave-leave-reveal-until-2026-06-23.test.ts (16件: cardName/levelMax4/over-fire-guard/no-match/turn-gate/hand-count両分岐/choice/parallel)。

## 残カード実数 (2026-06-23 live 計測、棚卸 json は stale cache 不可信)
- **universe 2049 − 実装済 1430 = 残 619** (P変種含む)。engine変更0 実装可 clean ≈ 510。
- 実数は `.tmp/_regen-regids.mts` (live ALL_CARDS→_registered-ids.json 再生成) → `node scripts/inventory-remaining.cjs`。
  ★signature tag (regex) は不可信。clean プールでも二次節に隠れ gate あり → member 毎 full-text grounding 必須。

## 次にやること (要ユーザー選択)
A) **カード追加 継続** (残 619、clean~510):
   - **engine変更0 純既存パターン**最優先。reveal-until family は B02050(keyword-filter gate)/D10003-D10004(突撃+caseTrait)/B03062(scene→deck-bottom verb)/PR195-196(event→partnerArea verb) が残 DEFER 候補 (要 grounding)。
   - 他 clean クラスタ: hirameki(char)/enter-trigger 残/cutin 純AP+ など。着手前に1クラスタ grounding→敵対verify で真 yield 確定。
   - engine 投資先 (大yield、別 engine session 推奨): leave-trigger 観測者 残 / set-event-to-char(15) / opp-evidence-removed(6) / MR①②/ flipFaceDown。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## 並行セッション (engine session / card session 役割分担、2026-06-23 実証済)
- **engine変更 session (例491a0ede) と engine変更0 card session (例21c4268d) の同時進行は有効**。衝突は registry/auto-doc/共有md のみ。
- 衝突解決 (rebase 時): `git diff --name-only --diff-filter=U | xargs git checkout --ours --` で origin 版採用 →
  `node scripts/taskA-register.cjs "<batch>"` (.tmp-taskA-registered.json から私のカード再追加) → `npm run docs` 再生成 →
  `git add .claude/auto CHANGELOG.md src/cards/_reuse/index.ts` → `git rebase --continue`。**手動 merge でなく再生成で解決** (本 session で実証)。
- 個別 card src/test/changelog-entry は新規ゆえ clean 適用 (集合 disjoint なら)。NEXT-SESSION-PROMPT は手書き共有=直列更新。
- 敵対 review/grounding workflow は同時不可 (server rate-limit、1つずつ・SUB抑制)。

## プロセス必須 (カード wave)
- **着手前に member 毎 full-text TSV 再取得 + grounding** (棚卸 eff は truncate)。green/clean/codegen ラベル不可信。
  ★capability-map の **⛔ negative は stale 化しうる** → eval.ts/types/effect.ts 直 grep で裏取り (決定論優先)。
  ★grounding sketch は exemplar 誤認・rules 誤適用を含む → 必ず exemplar 実ファイル+rules+TSV で訂正。
- **engine変更0 wave 最優先**。engine 拡張は別 engine session で additive+回帰ゼロ (legacy保持/新verb·flag·hook·dyn token)。
- engine拡張·新capabilityカードは codegen でなく **手書き** (exemplar照合)。純既存は codegen pipeline 可。
- **decoy engine test 必須**: leave は `mutate.scene.removeToRemove(d,uid,'effect')`+`runAllUntilEmpty`+`drainAiEffectPicks`、
  enter は `runEffect(d, sceneEnter atom, makeCtx({source}))` で enter hook 駆動 (conditional 直叩きは pick が drain されない)。
  decoy(cardName/level/over-fire-guard/no-match) 込み1対1 + turn-gate。harness: wave-leave-reveal-until-2026-06-23.test.ts / D05007 / B06053 参照。
- **敵対 faithfulness review 必須** (opus workflow、1カード=1 lens、1つずつ)。BLOCKER は DEFER+BUG 起票 か 同 wave データ補完。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (combined baseline 2951) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124: 123pass+1skip、~4min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
  ★validate-specs の FAIL PR280 は既存・無関係。engine 触る wave は git diff src/engine で additive のみ精査。
  ★lint-test-pair WARN (個別 test pair 無し) は非ブロック (wave 共有 decoy test で網羅していれば可)。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。col0=cardNum col1=numericId。no='numericId/cardNum'、imagePath=col9帯。
  ★fulltext/grep helper: .tmp/_fulltext.cjs <ids> / .tmp/_grep-remaining.cjs <regex> / .tmp/_meta2.cjs <ids> / .tmp/_count.mts (tsx)。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown 基本 100 行 / memory.md 80 行で sessions/ へ rotate。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design (?? のみ)。git add -A 禁止。
  ★reports 新 smoke + .tmp-taskA-registered.json は gitignore 済 ゆえ commit 不要。重い opus workflow は1つずつ・SUB抑制 (throttle 回避)。
```
