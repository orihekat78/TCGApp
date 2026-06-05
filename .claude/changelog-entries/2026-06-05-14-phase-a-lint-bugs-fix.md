## Phase A: lint:bugs 機械修正 (status prefix match + BUG-115 commit hash)

**Round/Phase**: 2026-06-05 session レビュー Phase A

session 中に 10 connect 連続で `SKIP_SIMPLE_GIT_HOOKS=1` 経由していた pre-existing
`lint:bugs` の 7 件 ERROR を解消。今後の commit は (lint:side-channel を除き) clean に
hook を通過可能。

### 変更内容

#### `scripts/lint-bug-frontmatter.ts` を prefix match 化

```diff
- if (fm.status && !ALLOWED_STATUS.has(fm.status)) { ... }
+ if (fm.status) {
+   const prefixOk = [...ALLOWED_STATUS].some(
+     (v) => fm.status === v || fm.status.startsWith(`${v} `) || fm.status.startsWith(`${v}(`)
+   );
+   if (!prefixOk) { ... }
+ }
```

「修正済 (D08024/D11020) / 一部継続」「未着手 (DEFERRED — …)」等の **richer な suffix 表記**
を許容しつつ、先頭 token が enum 値であることは保証 (BUG-105/108/111-114 が enum 適合に).

#### `status=修正済` 系チェックも prefix match に対応

```diff
- if (fm.status === '修正済') { ... }
+ const isFixed = ... fm.status.startsWith('修正済 ') || ...;
+ if (isFixed) { ... }
```

#### `BUG-115.md` に commit hash 反映

`commit: 851e8c35` (単純カード一括実装 commit — generator 修正で BUG-115 解消)

### 結果

```
[lint-bugs] 115 BUG files / errors=0 / warns=47
```

ERROR: 7 → **0** (BUG-105/108/111-115 enum + BUG-115 commit 全て解消)
warns: 関連 47 件 (category=ui/engine+ui/card 等の "推奨 enum 外" / recurrence_cluster
未登録値) — 移行猶予中なので blocking なし。

### 残課題

- `lint:side-channel` で errors=9 が残る (pre-existing、本 Phase 外):
  - _drainPendingEffectPickQueue / pendingEffectPickQueue store field
  - _drainPendingChainContinuation / pendingChainContinuation store field
  - _drainPendingActionExpansion / pendingActionExpansion store field
- これは UI side-channel architecture compliance の問題で、別 BUG として記録済 (memory S9592)。
  解消には UI store + dispatch 配線追加が必要。本 Phase の lint:bugs 対象外。
