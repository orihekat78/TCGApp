# 次セッション再開プロンプト (2026-06-23 — deck-mill-gated-chain wave 完了 / 次=カード継続 or デザイン)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、セッション㊽ — deck-mill-gated-chain wave を main へ ff-merge + push 済 = feat 0f6027ce)
refactor-plan は全完了済。㊽ は **カード追加 (A)** の engine 拡張クラスタ第3弾。新 flag `mill{gate:true}` を
additive 追加し「自分のデッキを上からN枚リムーブしてもよい。そうした場合〜」の gated-mill chain 4枚 を出荷 (ALL_CARDS 1387→1395)。
- ★開始時に `git ls-remote origin main` で local HEAD 一致 + CI (`gh run list -L1`) green を確認。
  push 直後で CI 完走前にセッションを閉じた場合は green を見届ける。
- 直前㊼ (facedown wave) は ffd4989e/b4a6d29c。㊽ 詳細は memory.md (80行 rotate 時は sessions/2026-06-23.md へ)。

## ㊽ サマリ (検証済: tsc0両 / vitest 2845→2868(+23) / smoke winsA=498 exc0 baselineOK / e2e 123pass+1skip / 規約lint8本errors0 / 敵対review opus 5lens 全faithful blocker0)
残未実装を **4候補クラスタ** (deck-mill / set-event / opp-evidence / hand-count) で opus grounding 棚卸 (Workflow 並列) →
deck-mill-gated-chain が最小 additive (engine 1 file) ×真 clean 4枚 ×low risk と確定して出荷。
- **engine 拡張** (additive 1 file=core.ts atomMill、回帰0=gate 使用カード従来0): `mill{gate:true}` 分岐。
  deck<N で何もリムーブせず chainStepNoApply→chain break = 公式Q&A all-or-nothing (filePopToHand/evidenceToHand 同型)。
  gate 未指定/false は従来挙動 (可能な限り mill+refresh、B09064/B09104) 完全保持。args=unknown 型ゆえ
  AtomVerb union/validate/whitelist の **3点同期不要** (verb名 'mill' 不変)。最も収束的な engine 拡張パターン。
- **出荷 4+P4** (touched 各1): B01044 怪盗キッド (登場時 gated-mill7→キャラ deck下、condition partnerColor白) /
  B03094 萩原千速 (突撃 partnerColorKeyword + 無条件 action:declare gated-mill2→AP+1000 action-scope、【ターン1】無) /
  B05061 終極 event (event-use + partnerColor白 + gated-mill7→相手キャラ deck下) /
  B06016 鬼丸猛 (登場時 partnerColor緑 gated-mill3→AP8000以下 remove + 宣言 turn1 sleepSelf 証拠⇄手札 swap=B06029 同型 bare chain)。
- **decoy test** (tests/cards/wave-deck-mill-gated-chain-2026-06-23.test.ts、23件): runAtom mill gate (deck≥N/deck<N/境界deck==N) /
  legacy gate-less 回帰 (B09104 shape) / chain[mill(gate),draw] consequence decoy で chain-break / optional gating /
  per-card 固有 N / B03094 a2 golden full (gate+AP両 deterministic) / DSL 構造断言 / parallel 同一性。
- **同族 DEFER** (DEFERRED-INDEX §deck-mill-gated-chain): B02052/P トランプ銃 (set-event の permanent grant 未検証 +
  replace-on-set-card-removal hook 不在)。

## 次にやること (要ユーザー選択)
A) **カード追加 継続**: ㊽ の 4候補棚卸で判明した残候補 (.tmp/inventory-remaining.json + 棚卸 workflow 所見):
   - **純 codegen で即出荷可 (engine 0)**: hand-count-cond の真出荷分 B07065/B07068/B07069/B07100 (4 unique+P、手札枚数 cond は
     既出荷=誤ラベル) + set-event-to-char の codegen 分 B05030/B05035/PR099 (3 unique+P、host-continuous 仮説は誤で
     大半は「デッキ上を裏向きでセットする資源トークン」= 既存 charSetCard/charRemoveSetCard で表現可)。
     → engine 不触の軽量 wave。card-wave skill の codegen pipeline (collect→validate→codegen→register) で拾える。
   - **より大きい engine 投資**: opp-evidence-removed (high risk、evidence-pick→deck下 verb + 相対証拠 cond 等) /
     leave-trigger (57、最大 yield だが【現場リムーブ時】hook 一般化が最難、cluster15/16 で一部解禁済) /
     set-event host-continuous (DEFER 群) / MR ①② (rules/18 配線)。
   → **着手前に1クラスタを certify/grounding で精査して真 yield を確定** (棚卸の「clean」は信用不可、member ごと grounding 必須。
     ㊽ で scoping DSL が exemplar 誤認・rules 誤適用を2点含んでいた=必ず exemplar/rules で訂正)。
B) **デザイン刷新** (.claude/design/RESUME.md、frontend-design skill、memory: project-design-redesign-2026-06-19)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (engine 拡張カード wave の場合)
- **engine 拡張は additive + 回帰ゼロ厳守**: 死 atom 有効化 or 新 verb/flag/hook を「既存挙動不変」で。legacy 形を保持。
  既存 atom への opt-in flag (㊽ の mill gate) は新 verb 不要で最も収束的。新 query field は TargetQuery 直下 (TargetFilter は sync test 3点同期要)。
  **新 area で multi-pick するなら resolve-picks の CPU 分岐 (kind filter) も確認** (㊼ で evidence kind 欠落バグを踏んだ)。
- engine 拡張カードは **codegen でなく手書き** (新 capability)。exemplar 照合必須。member ごと TSV 全文再取得 (green master は truncate)。
  ★scoping/grounding workflow の DSL sketch は exemplar 誤認・rules 誤適用を含む (㊽: B06029 を optional と誤認 / 【パートナー色】を装飾扱い)。
   **必ず exemplar 実ファイル + rules で訂正してから書く**。
- **decoy engine test 必須** (非 deck カードは playwright 不可): 新 engine path を decoy 込み 1対1 witness +
  end-to-end (hook emit → runAllUntilEmpty → drainAiEffectPicks)。BUG-117/118 教訓を engine 層で踏む。
- **敵対 faithfulness review** (opus workflow、1カード=1 lens + engine lens、SUB≤5・1つずつ)。
- register: 手書きカードは `.tmp-taskA-registered.json` ([{id,pkg}]) → `node scripts/taskA-register.cjs "<batch>"`。

## プロセス共通
- 着手前 working tree clean (`.claude/design/` のみ untracked=OK) / branch first (`cards/wave-<slug>`)。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (baseline 2868) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`=124、3.6min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash 指示。
  カード全文 TSV: character col11=effect col17=qAndA / event col8=effect col13=qAndA。B0N→ct-p0N、PR→pr-01。
- 新 .md/src で structure/changelog/mapping 変わる → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。
  ★Markdown は基本 100 行 / memory.md 80 行で sessions/ へ rotate (DEFERRED-INDEX は例外肥大)。
- git add は対象 src/test + 記録 md + 再生成 auto docs (.claude/auto 一式 + CHANGELOG.md)。除外: .claude/design。git add -A 禁止。
  ★lint:test-pair は batch test path を warn (非block)。★reports 新 smoke + .tmp-taskA-registered.json は gitignore 済 ゆえ commit 不要。
  重い opus workflow は1つずつ・SUB≤5 (throttle 回避)。
```
