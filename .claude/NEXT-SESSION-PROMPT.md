# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3f 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊷ — refactor Phase 3f を main へ ff-merge 済、push 確認要)
refactor-plan Phase 3f (engine applyMove exhaustiveness ガード、additive) を完了。
- ★開始時に `git ls-remote origin main` で 3f commit が origin 取込み済か確認。未認可で終わったなら
  `git push origin main` (per-session 認可要) を再実行し、push 後 `git ls-remote origin main` + CI (`gh run list -L1`) green を確認。
- 直前 ㊶ (Phase 3e) は main 取込み済 (`83d2542e`)。

## ㊷ サマリ (検証済: tsc0 両tsconfig / 負テストTS2322@policy.ts(280,13) / vitest 2783+1skip / smoke winsA=498 / e2e 26 / eslint 125 added0 / 規約lint8 0 / numstat 8add/0del)
engine `applyMove` (src/ai/policy.ts:209、Move 11-member union を switch、void) の末尾に `default:never` (void 変種) を追加。
3e の UI 2 switch と完全同型の silent-gap (noImplicitReturns 無効で member 脱落が compile error 化されない穴) を塞ぐ。
- **throw 不使用**: 呼出 4 site のうち policy.ts:412 (`produce()` 内) が try 外。throw だと将来到達可能化した際 uncaught で
  stepTurn を貫通し挙動破壊 → void 変種で統一 (Phase 3e と同判断、mcts/mcts-tree/replay の他 3 site は try 内)。
- **着手前設計レビュー** (Workflow opus 3 lens [invariance/骨格凍結/completeness] + synthesis、367k、BLOCKER 0、GO)。
  骨格 touch ゆえ「動作不変な内部最適化」例外を明示し挙動不変を敵対的反証。
- **水平展開で Phase 3g + BUG-152 新設**: resolve-picks.ts:431 `switch(effect.kind)` が `case 'chain'` を欠き top-level chain を
  `default: return effect` で silent passthrough (un-walked)。resolver.ts:78 は handle。構造非対称は機械確認済・runtime 影響は未確認。
- 記録: refactor-plan/{INDEX(3f✅/3g追加),phases,review-records(3f),phase-3f-design}.md / bugs/BUG-152 / memory㊷ / changelog 2026-06-22-07。

## 次にやること (要ユーザー選択)
C-refactor 継続 (推奨、INDEX.md 状態列参照):
  - **Phase 3g** = resolve-picks.ts:431 の silent passthrough + `case 'chain'` 欠落を guard 化 (BUG-152)。applyMove と違い
    default が reachable passthrough ゆえ **real-logic 課題**: ① chain step が dispatch 時に resolveEffectPicks を再入するか確認
    (再入なら実害なし) → ② 実害あれば `case 'chain'` 追加 (sequence ブロック踏襲) → ③ default を never 化 (negate/custom も明示 case 化)。
    中リスク (挙動変更を伴いうる) → 着手前に個別設計レビュー + 実機/テストで chain $pick 落ちの有無を確定。
  - Phase 4 (周辺整理: scripts archive / specs stale 検証 / _reuse 規約統一 / sessions アーカイブ、低リスク)。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- 骨格凍結: refactor は「動作不変な内部最適化」例外。挙動完全不変が絶対。1 フェーズ=1 commit=セッション境界。
  ★Phase 3g は engine 本体を触り **default を reachable→unreachable に変える** = 純 additive でない (挙動変更可能性) →
  設計レビューで「chain walk が現状ドロップしている $pick を救済するか / 無害か」を一次資料 (カード effect・dispatch 経路) で確定。
- 着手前: working tree clean / branch first / INDEX 状態列更新 / baseline vitest 件数控える / Phase3系は個別設計レビュー必須。
- additive (default:never 等) は byte-identity 不可 → `git diff --numstat` deletions=0 + 追加 hunk=ガードのみ + 負テスト
  (member 1 削除→tsc TS2322) で機械保証。3g は chain case 追加で挙動が変わりうるので numstat だけでは不十分 → smoke/e2e 差分注視。
- 挙動不変ゲート (全部、この順): tsc0 (両 tsconfig=`npm run typecheck`) / full vitest (baseline=2783+1skip) /
  smoke:1000 + check:smoke-baseline 一致 (winsA=498) / e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions=26) /
  eslint (baseline=125、新規 0) / 規約 lint 8本。e2e は vitest/smoke と並走させると CPU contention で flake → 単体再走で確認。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 群。新 .md/src で structure/changelog 変わる → `npm run docs` を全 .md 編集後に 1 回 → commit。
- git add は対象 + 再生成 auto docs。除外 .gitignore(.superpowers/)/.claude/design/.claude/reports(smoke)/scripts/_phase*。
```
