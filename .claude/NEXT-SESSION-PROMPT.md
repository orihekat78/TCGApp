# 次セッション再開プロンプト (2026-06-23 — evidence-flip-facedown wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション㊼ — evidence-flip-facedown wave を main へ ff-merge + push 済 = ffd4989e)
refactor-plan は全完了済。㊼ は **カード追加 (A)** の engine 拡張クラスタ第2弾。faceup wave (㊻) の対称で、
新 verb evidenceFlipDown を additive 追加し「自分の表向き証拠を裏向きにする」4枚を出荷 (ALL_CARDS 1383→1387)。
- ★開始時に `git ls-remote origin main` で local HEAD (ffd4989e) 一致 + CI (`gh run list -L1`) green を確認。
  push 直後で CI 完走前にセッションを閉じた場合は green を見届ける。
- 直前㊻ (faceup wave) は a8da02b0/957d261b。㊼ 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## ㊼ サマリ (検証済: tsc0両 / vitest 2822→2845(+23) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本errors0 / 敵対review opus 4lens 全faithful blocker0)
ユーザー「あと何枚?」→ 棚卸 (scripts/inventory-remaining.cjs 新規・決定論): 残 **666** 未実装。
粗 regex の「clean 520」は **信用不可** (reusable-306 過大評価の罠を再現、サンプルで実証) → 真 yield は
positively-matched gate のみ信頼。facedown 真 clean=4枚と確定 → ユーザー「facedown wave 進行」で出荷。
- **engine 拡張** (additive 9 files、使用カード従来0=回帰0): 新 verb evidenceFlipDown。core.ts
  atomEvidenceFlipDown = handAddFromRemove 鏡像 3-path (cardIds await / cardIds resolved multi / single short-form) /
  mutate/evidence.ts flipFaceDown (faceUp false のみ=順番不変) / candidates.ts evidence faceUp filter /
  effect.ts TargetQuery.faceUp + AtomVerb union / pick-spec + validate + cjs whitelist (3点同期) /
  **resolve-picks.ts CPU multi-pick 分岐に evidence kind 追加** (隠れバグ修正: 従来 'card' kind 限定で
  evidence 除外 → flip されず。human path は BUG-076 対応済、CPU 欠落。D08021/B09034 は remove=card kind ゆえ無影響)。
- **出荷 4** (touched 各1): B05013 灰原哀 (登場時 2まで multi-pick + ヒラメキ) / B06017・B06017P 天草四郎時定
  (登場時 sceneHas YAIBA excludeSelf→draw + ヒラメキ + 変装[caseTrait YAIBA/fileAtLeast5]) /
  B06019 クモ男 (【事件編】caseStatus gate + chain[discard 緑YAIBA, draw2] + ヒラメキ)。
- **decoy test** (tests/cards/wave-evidence-flip-facedown-2026-06-23.test.ts、23件): candidates faceUp filter /
  runAtom single・multi(cardIds)・同cardId2件・0枚・裏向きtarget-noop / 順番不変 / pick-await / enter multi-pick e2e /
  B06017 excludeSelf gate / B06019 caseStatus gate + chain / legacy faceup 回帰。
- **同族 DEFER** (DEFERRED-INDEX §evidence-flip-facedown): B06026 (event-as-evidence) / B07099 (自己 effect-leave) /
  B08087 (現場リムーブ時+強制選択) / B08091 (facedown 無・誤グルーピング) は二次 gate で全体 DEFER。

## 次にやること (要ユーザー選択)
A) **カード追加 継続**: engine 不触 dense family は枯渇。次は **engine 拡張クラスタ**が主力。
   棚卸 (`node scripts/inventory-remaining.cjs` → .tmp/inventory-remaining.json) の positively-matched gate を
   size 順に: set-event-to-char(~18、host-continuous 機構要・中規模) / opp-evidence-removed(~6-10、新 observer hook 要) /
   state-to-sleep(active→sleep emit、B03008) / MR ①②(5、rules/18 配線・大)。**いずれも前回より大きい engine 投資** ゆえ
   着手前に1クラスタを certify で精査して真 yield を確定 (棚卸の「clean」は信用不可、member ごと certify 必須)。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。A は「最小 additive で coherent micro-cluster」戦略が枯渇気味なので、
  より大きい engine 投資 (新 hook/機構) を伴う前提で提案する。

## プロセス必須 (engine 拡張カード wave の場合)
- **engine 拡張は additive + 回帰ゼロ厳守**: 死 atom 有効化 or 新 verb/flag/hook を「既存挙動不変」で。legacy 形を保持。
  新 query field は TargetQuery 直下 (TargetFilter は sync test 3点同期が要る)。**新 area で multi-pick するなら
  resolve-picks の CPU 分岐 (kind filter) も確認** (㊼ で evidence kind 欠落バグを踏んだ)。
- engine 拡張カードは **codegen でなく手書き** (新 capability)。exemplar 照合必須。member ごと TSV 全文再取得 (green master は truncate)。
- **decoy engine test 必須** (非 deck カードは playwright 不可): 新 engine path を decoy 込み 1対1 witness +
  end-to-end (hook emit → runAllUntilEmpty → drainAiEffectPicks)。BUG-117/118 教訓を engine 層で踏む。
- **敵対 faithfulness review** (opus workflow、1カード=1 lens + engine lens、SUB≤5・1つずつ)。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"`。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2845) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.4min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design。git add -A 禁止。
  ★lint:test-pair は batch test path を warn (非block)。★reports 新 smoke は gitignore 済 (policy E) ゆえ commit 不要。
  重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
