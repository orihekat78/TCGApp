# 全体リファクタ Phase 3a/3b — engine 内部の巨大ファイル分割 (挙動 byte-identical)

**Round/Phase**: 2026-06-22 リファクタ計画 (`.claude/specs/refactor-plan/`) Phase 3a / 3b。
高リスク群につき **着手前フルパネル設計レビュー** (Workflow opus 多 lens + critic) +
**決定論 codemod + 独立 byte-identity 検証** + 挙動不変ゲート全通過で実施。
骨格凍結原則の「動作不変な内部最適化」例外に該当。

### Phase 3a: atom-handlers.ts 分割 (`846109ec`)
- 1828 行・単一 `runAtom` switch (55 verb) を barrel + `_shared` + core/scene/char/picks/misc の
  6 ファイルに **extract-and-dispatch** 分割 (case body 無改変移送)。
- 外部 API は barrel 再export で不変。**byte-identity 52/52** + 55-case ↔ 55-AtomVerb 完全 bijection。

### Phase 3b: pick-resolution 責務 3 分割
- `resolve-picks.ts` (849 行) の pending管理 (連続ブロック L166-467 = side-channel state ×8 / Pending各型 /
  ContinuationFrame / toPlainDeep / queue・choice・optional の getter/setter/drain) を新 **`pending-state.ts`** へ
  verbatim 移送。責務を **resolve-picks(walk) / pending-state(pending) / apply-pick(continuation、無改変)** に分離。
- 旧 public pending API (17 値 + 4 型) は resolve-picks の **barrel 再export** で不変 → **importer 改変 0**
  (apply-pick / resolver / UI / 49+ test 全て無変更)。walk が必要とする private 7 fn のみ export 昇格 (additive)、
  `getPendingQueue` / `syncLegacyPickProperty` は private 維持。local `type Player` を pending-state に複製。
- pending管理が単一 module に集約 → Phase 3c (side-channel 8→5 縮減) の前提が整った。
- 2nd 成果物: BUG-054〜121 を walk/pending/continuation の 3 group に分類した回帰テスト棚卸し
  (`phase-3b-test-inventory.md`)。

### 検証 (3b、全 GREEN)
- **独立 byte-identity verifier** (git HEAD 原本と part1[1-165] / pending block[166-467 export-strip 後] /
  part2[468-end] が md5 一致)。
- tsc **0** / full vitest **2783 pass / 1 skip** (baseline 完全一致) / smoke:1000 **winsA=498**
  (timeouts 0 / exceptions 0、baseline OK) / e2e 3 spec **26 pass** / eslint **127** (HEAD と delta 0) /
  規約 lint 8 本 errors=0 (side-channel 13ch/0warn)。
- 着手前レビュー (opus 4 lens + critic 697k tok): BLOCKER 0 / MAJOR 1 (Player 型) + MINOR 4 を着手前解消。
  実装後レビュー (opus): re-export 25=25 exact / 関数本体 0-byte 改変 / apply-pick・resolver UNCHANGED → APPROVE。

### 学び (恒久)
- 「再設計」フェーズでも挙動不変が絶対なら **責務境界での verbatim 移送 + barrel 再export** が王道
  (BUG パッチ済 core を 1 byte も触らず分離)。
- codemod 自己 check は **「written-file vs HEAD」** で行う (slice を slice 自身と比較すると trailing-newline
  doubling を見逃す)。独立 verifier (git show HEAD から再構築) を別途必須化。
