# 作業ログ — 名探偵コナンプロジェクト

## セッション ㊳ (2026-06-22) — refactor Phase 3b (pick-resolution 責務 3 分割)

branch `refactor/phase-3b`。3a (atom-handlers 分割) は main `846109ec` 取込み済・CI green を起動時に確認。

### 実装
resolve-picks.ts (849行) の pending管理 = **連続ブロック L166-467** (declare global ×8 / Pending各型 /
ContinuationFrame型 / toPlainDeep / queue・choice・optional の状態管理 fn) を **決定論 codemod**
(`c:/tmp/phase3b-split.mjs`) で新 **pending-state.ts** へ verbatim 移送。
- resolve-picks=**walk** (resolveEffectPicks/substituteAtomPick/tryRePickFromAtom/dyn helpers) +
  旧 public pending API を pending-state から **barrel 再export** → **importer 改変0**。
- pending-state=**pending** (leaf、Effect/EffectCtx のみ import + local Player 複製)。
  private 7 fn (push/set/get 系) のみ export 昇格 (additive)、getPendingQueue/syncLegacyPickProperty は private 維持。
- apply-pick=**continuation** (無改変)、resolver も無改変 (`git diff --quiet` 確認)。
- 2nd 成果物: BUG-054〜121 を 3 group 化した回帰テスト棚卸し (phase-3b-test-inventory.md)。
- 結果行数: resolve-picks 849→564 / pending-state 315 (新)。

### レビュー
- **着手前** Workflow opus 4 lens + critic (697k tok): BLOCKER 0。MAJOR 1 (Player 型欠落) +
  MINOR 4 (GameState 過剰 / blanket regex / BUG-135 漏れ / overlap 書式) を設計 doc へ反映
  (codemod は元から named-7 whitelist + Effect/EffectCtx-only + Player 複製で正しく実装済だった)。
- **実装後** opus 1 agent: re-export 25=25 exact / pending-state 24fn+4type / apply-pick・resolver UNCHANGED /
  移送 block diff = コメント移設+7 export 昇格のみ・**関数本体 0-byte 改変** → **APPROVE**。

### 検証 (全 GREEN)
- **独立 byte-identity verifier** (`c:/tmp/verify-3b.mjs`、git HEAD と part1/block(export-strip後)/part2 が md5 一致) = VERIFIED。
- tsc **0** / full vitest **2783 pass / 1 skip** (baseline 完全一致) / smoke:1000 **winsA=498** (timeouts0/exceptions0、baseline OK) /
  e2e 3 spec **26 pass** / eslint **127** (HEAD と delta0) / 規約 lint 8 本 errors=0 (side-channel 13ch/0warn)。

### 学び (恒久)
- codemod 自己 check は **「written-file vs HEAD」** で行う。slice を slice 自身と比較すると trailing-newline doubling
  (`join(eol)+eol` の二重化) や挿入境界の double-blank を見逃す → **独立 verifier (git show HEAD から再構築) 必須**。
- 「再設計」フェーズでも挙動不変が絶対なら **責務境界での verbatim 移送 + barrel 再export** が王道
  (BUG パッチ済 core を 1 byte も触らず分離できる。3a の case-body 分割と同型)。
- pending管理を単一 module (pending-state) に集約 → Phase 3c (side-channel 8→5 縮減) の前提が整った。
  side-channel 直接 consumer = apply-pick / resolver / resolve/stack.ts / ai/policy (全て inline cast、移送無影響)。

### commit / 次
branch `refactor/phase-3b`。docs 再生成 → 明示 add → 1 commit → main ff-merge → **push** (要認可、後 `git ls-remote origin main` 確認 + CI green)。
次タスク未確定 — Phase 3c (side-channel 縮減) / 3d (UI hooks 分割) / 4 (周辺整理) / デザイン刷新。`/clear` 推奨。
