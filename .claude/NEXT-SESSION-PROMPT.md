# 次セッション再開プロンプト (2026-06-22 — refactor Phase 3d 完了 / 次フェーズ未定)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-22、セッション㊵ — refactor Phase 3d を main へ ff-merge 済、push 確認要)
refactor-plan Phase 3d (UI hooks 分割、100% byte-identity) を完了。
- ★開始時に `git ls-remote origin main` で 3d commit が origin 取込み済か確認。未認可で終わったなら
  `git push origin main` (per-session 認可要) を再実行し、push 後 `git ls-remote origin main` + CI (`gh run list -L1`) green を確認。
- 直前 ㊴ (Phase 3c) は main 取込み済 (`d9223011`)。

## ㊵ サマリ (検証済: tsc0 / vitest 2783+1skip / smoke winsA=498 / e2e 26 / eslint stash-diff added0 removed0 (125) / 規約lint8 0err / slot11 / sidelint12ch / 独立 HEAD verifier PASS)
肥大 UI hook 2 ファイルを barrel + サブファイル化 (関数 body 無改変移送、export 昇格のみ)。
- useActionsPanelFlow.ts (909) → barrel + useActionsPanelFlow/{cost,enumerators,flows}.ts。
- useEngineDispatch.ts (677) → barrel + useEngineDispatch/{types,can-check}.ts。runEngineAction + `_justDeclaredAxId` +
  dispatchEngineAction は barrel KEEP。旧 path を barrel として残し importer (Playmat + driver + modal + ~30 test) 無改変。
- **着手前フルパネルレビュー** (opus 4 lens + critic, 690k, BLOCKER 0) で scope 補正 → runEngineAction 分離 +
  EngineAction family 型化を **新 Phase 3e へ繰り延べ** (理由: `_justDeclaredAxId` cross-module shared-mutable 化
  [BUG-034 category] / 両 switch に default:never ガード無く tsc が型化 member 脱漏を捕捉不能)。
- 決定論 codemod = scripts/_phase3d_codemod.mjs (commit 除外)。記録: refactor-plan/{INDEX(3d✅/3e追加),phases,
  review-records(3d),phase-3d-design}.md / memory㊵ / changelog-entries/2026-06-22-05。
- 注: 途中 opus classifier の長時間障害 (~1h) で commit がブロック → ScheduleWakeup 再試行で復帰後完了。

## 次にやること (要ユーザー選択)
C-refactor 継続 (推奨、骨格凍結の動作不変例外、INDEX.md 状態列参照):
  - **Phase 3e** = useEngineDispatch 続き (runEngineAction 分離 + `_justDeclaredAxId` の globalThis/accessor 化 +
    EngineAction family 型化 + 両 switch [isAllowed/runEngineAction] に default:never exhaustiveness ガード追加)。
    **高リスク** (byte-identity 不可・挙動隣接編集)。着手前個別設計レビュー必須 + switch 網羅性ゲートとセット設計。
  - Phase 4 (周辺整理: scripts archive / specs stale 検証 / _reuse 規約統一 / sessions アーカイブ、低リスク)。
B) デザイン刷新 (.claude/design/RESUME.md、frontend-design skill、project-design-redesign-2026-06-19)。
A) カード追加 (engine-gate DEFER 多数、DEFERRED-INDEX)。
→ 開始時にユーザーへ方向確認。

## プロセス必須 (refactor-phase skill に従う)
- 骨格凍結: refactor は「動作不変な内部最適化」例外。挙動完全不変が絶対。1 フェーズ=1 commit=セッション境界。
- 着手前: working tree clean / branch first / INDEX 状態列更新 / baseline vitest 件数控える / Phase3系は個別設計レビュー必須。
- ★モジュール分割系は **決定論 codemod + 独立 HEAD verifier** (移送 body md5 突合、EOL 正規化) で byte-identity を機械保証。
  挙動を**書き換える**部分 (3c/3e 型: side-channel 移設・型化) はフルパネル設計レビューで各 move を敵対的に反証。
- 挙動不変ゲート (全部、この順): tsc0 / full vitest (baseline 件数維持=2783) / smoke:1000 + check:smoke-baseline 一致 (winsA=498) /
  e2e 3 spec (engine-extensions/reuse-cards/task-d-extensions=26) / eslint (stash-diff で added=0、現 baseline=125) / 規約 lint 8本。
- Read hook が file を line1 で切る → Bash cat/sed で読む。Write/Edit は Read 1回で登録後に使える。subagent も Bash cat 指示。
- pre-commit = docs:check + 規約 lint 群。新 src で structure/mapping 変わる → `npm run docs` を全 .md 編集後に 1 回 → commit。
- git add は対象 + 再生成 auto docs。除外 .gitignore(.superpowers/)/.claude/design/.claude/reports(smoke)/scripts/_phase*。
- ★push to main は per-session 認可要求あり。push 後 `git ls-remote origin main` で実取込みを必ず確認。
```

㊵ で refactor Phase 3d を完了し main へ ff-merge。次フェーズ未確定 — 開始時にユーザー確認 (C-refactor 3e 推奨)。`/clear` 後の新セッション再開を推奨。
