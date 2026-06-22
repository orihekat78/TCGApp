# リファクタ各フェーズ レビュー記録 (phases.md から分割、100 行制約)

> Phase 1a〜2c は [review-records-1.md](review-records-1.md) へ分離 (2026-06-22)。本ファイルは Phase 3 系。

- **3a (2026-06-22)** atom-handlers.ts 1828 行 (単一 runAtom switch・55 verb) を **決定論 codemod** で
  barrel + _shared(8 helper/Player/Pending*Side 2型/_drain*2/declare global 2) + core/scene/char/picks/misc に
  extract-and-dispatch 分割 (case body 無改変移送)。計画 4→5 補正 (misc 分離、各 <500 行)。
  **着手前フルパネル設計レビュー** (Workflow opus 4 lens, 507k tok): BLOCKER 1 (`log` verb が mapping 脱漏 →
  exhaustiveness `never` compile 不能) + MAJOR (per-file import 分配) を着手前に解消。
  **実装後レビュー** (opus 1 agent, 111k tok): dispatch 配線/re-export/preamble/exhaustiveness/未テスト verb の
  5 観点 PASS・BLOCKER/MAJOR/MINOR 0 (APPROVE)。
  決定論検証: **byte-identity 52/52** (抽出 body の md5 が元 case body と EOL 正規化後一致) +
  preamble が HEAD と byte 一致 (diff 空) + 55-case↔55-union 完全 bijection。
  挙動不変ゲート: typecheck **0** / full vitest **2783 pass / 1 skip / 0 fail (baseline 完全一致)** /
  smoke:1000 **baseline 一致** (winsA=498 exact, avg 10.998, timeouts 0, exceptions 0) /
  e2e 3 spec **26 pass** / eslint 問題数 HEAD と完全一致 (**delta 0**、新規 0) / 規約 lint 8 本 errors=0。
  教訓: autocrlf で working tree=CRLF / git store=LF のため byte 比較は EOL 正規化必須 (skill 罠表通り)。

- **3b (2026-06-22)** pick-resolution 責務 3 分割: resolve-picks.ts (849行) の pending管理 (連続ブロック
  L166-467 = declare global ×8 / Pending各型 / ContinuationFrame型 / toPlainDeep / queue/choice/optional の
  状態管理 fn) を **決定論 codemod** で新 pending-state.ts へ verbatim 移送。resolve-picks=walk /
  pending-state=pending / apply-pick=continuation (無改変) に分離。旧 public pending API (17値+4型) は
  resolve-picks の barrel 再export で不変 → **importer 改変0** (apply-pick/resolver/UI/49+ test 全て無変更)。
  walk が必要とする pending fn のうち private 7 個 (push/set/get 系) のみ export 昇格 (additive)、
  getPendingQueue/syncLegacyPickProperty は private 維持。local `type Player` を pending-state に複製。
  **着手前フルパネル設計レビュー** (Workflow opus 4 lens + critic, 697k tok): BLOCKER 0。MAJOR 1 (Player 型欠落) +
  MINOR 4 (GameState 過剰 import / blanket `^function` regex / BUG-135 棚卸し漏れ / overlap symbol 書式) を
  着手前に設計 doc へ反映 (codemod は元から named-7 whitelist + Effect/EffectCtx-only + Player 複製で正しく実装済)。
  **実装後レビュー** (opus 1 agent): re-export surface 25=25 exact / pending-state 24fn+4type / apply-pick・
  resolver `git diff --quiet` UNCHANGED / 移送 block diff = コメント移設 + 7 export 昇格のみ・**関数本体 0-byte 改変** で
  **APPROVE** (BLOCKER/MAJOR 0)。
  決定論検証: **独立 byte-identity verifier** (git HEAD 原本と part1[1-165]・pending block[166-467 export-strip後]・
  part2[468-end] が md5 一致 = VERIFIED ✓)。codemod 自己 check が trailing-newline doubling を見逃した不具合を
  独立 verifier が捕捉 → 修正後再検証。
  挙動不変ゲート: tsc **0** / full vitest **2783 pass / 1 skip (baseline 完全一致)** / smoke:1000 **baseline OK**
  (winsA=498 exact, timeouts 0, exceptions 0) / e2e 3 spec **26 pass** / eslint **127 problems (HEAD と delta 0)** /
  規約 lint 8 本 errors=0 (side-channel 13ch/0warn)。pending-state は test-pair warn (純粋リファクタ、既存 test が
  再export 経由で網羅、新 test 不要 — 3a と同方針)。
  教訓: codemod の自己 check は「written-file vs HEAD」で行う (slice を slice 自身と比較すると trailing-newline 等の
  生成差を見逃す)。独立 verifier (git show HEAD から再構築) を別途必須化。

- **3c (2026-06-22)** globalThis side-channel 縮減 (2ch)。**調査補正** (read/write 全サイト直読み): 計画 5ch のうち
  3ch (ChoiceResume/OptionalResume=cross-dispatch holder / OptionalSide=store-drain+cross-module read
  [stack.ts:121/apply-pick:454] / DeckReveal/Reorder=store-drain) は globalThis が load-bearing (apply-pick が
  dispatch ごと新規 ctx 構築) → **KEEP**。安全 2ch のみ実施:
  ① `__chainStepNoApply` → `ctx.dyn.chainStepNoApply` (intra-produce、reader=resolver chain case のみ。resolver.run が
  全 child run()/runAtom へ同一 ctx 素通し→atom-handler/tryRePickFromAtom が立てた値を同一 ctx で読む。test 5 assert を
  ctx 捕捉へ移送、`.toBe(false)` 2 件は dyn pre-init)。② `__pendingEffectChoiceBindings` を
  `__pendingEffectChoiceResume` holder の {effect,bindings} 格納形に統合 (pending-state.ts 内部のみ・export 不変)。
  **着手前フルパネル設計レビュー** (Workflow opus 4 lens, 613k tok): Lens1 INVARIANCE-HOLDS / Lens2 REFUTED →
  **BLOCKER 1** (統合 take/clear が null-unsafe → apply-pick:236 take が desync guard より先に走り g=null で TypeError、
  現行 top-level `?? null` の graceful return を破る) を `if(g)` ガードで解消 / Lens3 CONCERNS (test 移送 recipe の
  ctx 捕捉・pre-init・行番号) 解消 / Lens4 scope 妥当 (KEEP 3ch 過小なし・MOVE 誤分類なし)。
  **実装後** opus 1 agent: Change A/B 配線・null-safe・test 等価を確認し **APPROVE** (BLOCKER/MAJOR 0)。
  検証 (全 GREEN): tsc **0** / full vitest **2783 pass / 1 skip** (baseline 一致) / smoke:1000 **winsA=498**
  (timeouts0/exceptions0) / e2e 3 spec **26 pass** / eslint **127→125** (削除した declare-global 2 本の不要
  eslint-disable directive warning -2、**新規 problem 0・error 数 77 不変**) / 規約 lint 8 本 errors=0 /
  declare-global slot **13→11** / side-channel lint **13→12**。
  教訓: side-channel を移設可能と判断する前に **dispatch 境界を跨ぐか** を reader の ctx-identity で確定する
  (cross-dispatch holder は ctx 再構築で ctx.dyn 不可)。intra-produce flag は ctx.dyn が globalThis と同一共有意味。
