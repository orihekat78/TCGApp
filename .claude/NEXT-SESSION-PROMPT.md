# 次セッション再開プロンプト (2026-06-23 — leave-from-remove wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション㊾ — leave-from-remove wave を main へ ff-merge + push 済 = feat ec26d2e8)
refactor-plan は全完了済。㊾ は **カード追加 (A)**。ユーザーが A2「engine投資」を選択 → leave-trigger クラスタ
(棚卸57) を grounding 精査。**重要訂正**: 棚卸の「leave-trigger=【現場リムーブ時】hook 一般化が最難」は誤で、
hook(leave:to-remove)は30枚超 subscribe の成熟済 path。機械分類で 57 を 8 群に分解し、均質 clean slice
**group B (self-leave→リムーブエリアから pick→登場/手札)** が B03113 verbatim exemplar で **engine変更ゼロ**と判明。
ユーザー確認の上 group B を出荷 (ALL_CARDS 1395→1405)。
- ★開始時に `git ls-remote origin main` で local HEAD 一致 + CI (`gh run list -L1`) green を確認。
- 直前㊽ (deck-mill-gated-chain) は 0f6027ce/a19ad703。㊾ 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## ㊾ サマリ (検証済: tsc0両 / vitest 2868→2881(+13) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本errors0 / 敵対review opus 6 lens+engine-0 lens 全SHIP-OK blocker0 / engine diff 0)
- **engine変更ゼロ**: 既存 leave:to-remove + sceneEnter{from:remove}(atom-pick-spec.ts:60既存) + handAddFromRemove +
  and[partnerColor,turn] + bond continuous grantKeywords の settled path 再録のみ。src/cards のみ touch。
- **出荷10** (各touched1): B02075/P 諸伏高明(trait長野県警Lv≤6 sleep登場) / B02066/P メアリー(登場時draw+discard
  + cardNameメアリーLv≤5) / B05091/P 風見裕也(絆降谷零 突撃[キャラ]continuous + cardName降谷零Lv≤6 + ヒラメキsleep)
  / B05099/P 高木渉(and[partnerColor黄,turn opp] trait警察Lv≤4) / B05058 富沢(a2 trait鈴木財閥→手札)
  / B05116 火傷の男(a2 color黒Lv≤4)。
- **DEFER3** (grounding で engine gap 発見、DEFERRED-INDEX §leave-from-remove): B05111全体(a2ヒラメキ「アクション中の
  キャラ」= hirameki ctx に actor binding 不在、汎用pick=over-fire不誠実) / B05058 a1(継続self-trait付与機構ゼロ:
  readTraits静的のみ/charGrantTrait無) / B05116 a1(forced-target強制選択機構ゼロ)。B05058/B05116 は
  **partial-ship** (継続passive a1をDEFER + a2 leave出荷 = 先例ct-p04/B04059同型)。
- decoy test: tests/cards/wave-leave-from-remove-2026-06-23.test.ts (13件)。

## 次にやること (要ユーザー選択)
A) **カード追加 継続** (.tmp/inventory-remaining.json + 棚卸所見):
   - **残 leave-trigger 観測者型 = 真の engine 投資先**: D:ally-removed-observer(7) / E:opp-removed-observer(2) /
     F:self-revive(5) / A:contact-removal-self(3)。leave payload に **cause判別 + 他キャラdef matcher** を additive 追加
     すれば解禁。最大 yield だが回帰リスク高 (cluster15/16 で一部解禁済、leave:to-remove payload に byUid 既存)。
   - **純 codegen で即出荷可 (engine 0)**: hand-count-cond の真出荷分 B07065/B07068/B07069/B07100 (4 unique+P) +
     set-event-to-char codegen 分 B05030/B05035/PR099 (3 unique+P) = card-wave skill の codegen pipeline で軽量 wave。
   - **より大きい engine 投資**: opp-evidence-removed(6, high) / set-event host-continuous(DEFER群) / MR①②(rules/18配線)。
   → **着手前に1クラスタを certify/grounding で精査して真 yield 確定** (棚卸の「clean」「最難」ラベルは信用不可。
     ㊾ で「leave=最難」が誤=実は engine0、二次節に隠れた engine gap が3件あった=member毎 full-text grounding 必須)。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (カード wave)
- **着手前に member 毎 full-text TSV 再取得 + grounding** (棚卸 eff は truncate、二次節に engine gap が隠れる)。
  green/clean ラベル不可信。各句を 公式テキスト⇔rules⇔実 engine コードで裏取り (opus grounding workflow → 敵対verify)。
  ★grounding/scoping の DSL sketch は exemplar 誤認・rules 誤適用・card名誤りを含む → 必ず exemplar 実ファイル+rules+TSVで訂正。
- **engine変更0 wave が最優先** (additive不要なら最良)。engine 拡張する場合のみ additive+回帰ゼロ厳守 (legacy形保持/新verb·flag·hook)。
  二次節に未対応 capability があれば **partial-ship** (a1 DEFER + 他出荷、先例B04059) か **whole-DEFER** を faithfulness で判断。
- engine拡張·新capabilityカードは **codegen でなく手書き** (exemplar照合)。純既存パターンは codegen pipeline 可。
- **decoy engine test 必須** (非deckは playwright不可): leave/enter等 hook emit (mutate.scene.removeToRemove) →
  runAllUntilEmpty + drainAiEffectPicks、decoy(wrong trait/level/color/name/kind)込み1対1 witness + gate(turn/partnerColor)。
  harness: tests/cards/leave-reanimate-foreach-batch.test.ts / wave-leave-from-remove-2026-06-23.test.ts 参照。
  実match/decoy id は `/c/tmp/card-meta-query2.cjs` 流用 (CardDef export ブロックのみ parse) で trait/level/color/name 別に抽出。
- **敵対 faithfulness review** (opus workflow、1カード=1 lens + engine-0 lens、SUB≤5・1つずつ)。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"` (_reuse/index.ts へ挿入)。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2881) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.4min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
  ★validate-specs の FAIL PR280 は既存・無関係 (CI gate でない、PR280 continuousModifier closure spec)。engine diff 0 が真の engine0 証跡。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design。git add -A 禁止。
  ★lint:test-pair は batch test path を warn (非block)。★reports 新 smoke + .tmp-taskA-registered.json は gitignore 済 ゆえ commit 不要。
  重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
