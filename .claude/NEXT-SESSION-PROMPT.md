# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3g 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊸ — refactor Phase 3g を main へ ff-merge + push 済)
refactor-plan Phase 3g (resolve-picks chain-case exhaustiveness ガード) を完了。commit `8face6a4`、
`f8fd4b4d..8face6a4 main` push 済。
- ★開始時に `git ls-remote origin main` で 8face6a4 が origin に在るか + CI (`gh run list -L1`) green を確認。
  push 直後に CI 完走前でセッションを閉じた場合は green を見届ける。
- 直前 ㊷ (Phase 3f) は `f8fd4b4d`、その前 ㊶ (Phase 3e) は `83d2542e`。

## ㊸ サマリ (検証済: tsc0両 / 負テストTS2322@resolve-picks(574,13) / vitest 2783+1skip / smoke winsA=498 exc0 / e2e 26 / eslint 125 added0 / 規約lint8 0 / numstat 16add/1del)
resolve-picks.ts:560-563 の `case 'negate': case 'custom': default: return effect` を
`case 'chain': case 'negate': case 'custom': return effect` + `default: {const _exhaustive:never=effect; void _exhaustive; return effect}` に再構成。
3f 水平展開の silent-gap (Effect union 11 member のうち chain が default に落ち un-walked) を塞ぐ。
- **Option A (明示 passthrough、walk しない)**: chain step 内 atom $pick は dispatch 時 (resolver.ts:78 chain case →
  run(step) → atom-handler tryRePickFromAtom) に解決されるため passthrough で drop なし。**throw でなく return** 変種
  (resolveEffectPicks は applyMove→declared-ability:199 経由で produce() try 外 [policy.ts:419-423] 到達、throw だと
  stepTurn 貫通。resolver.ts:174 が throw なのは dispatch sink ゆえの正当な非対称)。
- **着手前 opus 3 lens 設計レビュー** (403k、BLOCKER 0、GO): invariance=invariant (chain/negate/custom は現 default と
  参照同一 effect 返却→全11member bit-identical、パッチ適用→vitest/smoke→git diff empty で実証) / guard=return /
  活性バグ=**無し** (ALL_CARDS 1374枚 object-walk: chain node 126、step が choice/optional = subtree 含め **0件**。
  B02068/B04023 は optional が chain を wrap で step でない)。Option B (chain walk 救済) は latent future-only。
- **非 additive** (default アーム再構成) ゆえ numstat だけでは挙動不変を担保できない → tsc の never 受理 (11member 全網羅の
  compile 証明) + vitest/smoke/e2e の実行差分で担保。
- 記録: refactor-plan/{INDEX(3g✅),phases(3g✅/§header 3a〜3g),phase-3g-design(新規),review-records(3a/3b を
  review-records-1[1a〜3b 化]へ退避し 3g 追記)}.md / bugs/BUG-152(修正済・date_fixed・latent化) / memory㊸ / changelog 2026-06-22-08。

## 次にやること (要ユーザー選択)
refactor Phase 3 系 (3a〜3g) は全完了。残るは:
  - **Phase 4** (推奨、低リスク): 周辺整理 = scripts 棚卸し (scripts/_archive へ) / specs 2026-05-11 系 stale 検証
    (specs/_archive へ) / `_reuse/index.ts` コメント規約統一 / sessions・reports アーカイブ方針決定。INDEX.md 行34・phases.md §4 参照。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- Phase 4 は低リスク (ファイル移動・コメント整理中心、engine 不触) → 着手前個別設計レビューは不要、決定論検証 + 1 lens で可。
  ただしファイル移動は import 切れ・リンク切れに注意 (tsc + リンクチェック)。
- 着手前: working tree clean (.gitignore の .superpowers/ 行は無関係・放置可) / branch first / INDEX 状態列更新 / baseline vitest 控える。
- 挙動不変ゲート (engine 触れる場合、この順): tsc0 (両=`npm run typecheck`) / full vitest (baseline=2783+1skip) /
  smoke:1000 + check:smoke-baseline 一致 (winsA=498) / e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions=26) /
  eslint (baseline=125、新規 0) / 規約 lint 8本。e2e は vitest/smoke と並走で CPU contention flake → 単体再走で確認。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 群。新 .md/src で structure/changelog 変わる → 全 .md 編集後に `npm run docs` 1回 → commit。
  ★BUG を 修正済 にしたら frontmatter に `date_fixed` 必須 (lint:bugs が ERROR にする、㊸ で踏んだ)。
  ★Markdown 100 行制約: review-records.md 等が満杯なら古い entry を分割ファイルへ退避 (㊸ で 3a/3b を review-records-1 へ移した手法)。
- git add は対象 + 再生成 auto docs (.claude/auto 一式、mapping は Source hash churn が出るが 3f/3g 同様 commit 同梱)。
  除外: .gitignore / .superpowers/ / .claude/design/ / .claude/reports(smoke) / scripts/_phase*。git add -A 禁止。
```
