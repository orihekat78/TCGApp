# リファクタ各フェーズ レビュー記録 (phases.md から分割、100 行制約)

> Phase 1a〜3b は [review-records-1.md](review-records-1.md) へ分離。本ファイルは Phase 3c 系。

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

- **3d (2026-06-22)** UI hooks 分割 (useActionsPanelFlow 909行 / useEngineDispatch 677行)。**決定論 codemod** で
  barrel + サブファイル化、関数 body **無改変移送** (export 昇格のみ decl 行に `export ` 付加)。useActionsPanelFlow →
  cost/enumerators/flows、useEngineDispatch → types/can-check (runEngineAction + `_justDeclaredAxId` + dispatch は barrel KEEP)。
  **着手前フルパネル設計レビュー** (Workflow opus 4 lens + critic, 690k tok): **BLOCKER 0**。INVARIANCE=INVARIANCE-HOLDS
  (accessor 案も挙動不変と実証) / SURFACE=APPROVE / CODEMOD・SCOPE・critic=CONCERNS。MAJOR 3 を受け **scope を安全側に補正**:
  ① runEngineAction 分離は `_justDeclaredAxId` (produce 境界越え module-let) を cross-module shared-mutable 化し BUG-034
  category に該当 → barrel KEEP ② EngineAction family 型化は両 switch に default:never ガード無く tsc が member 脱落を
  捕捉不能 → ①② を **新 Phase 3e へ繰り延べ**、本 phase は **100% byte-identity** に純化。critic 指摘の検証ゲート格上げ
  (独立 HEAD verifier) も反映。設計の誤根拠 (_drainPending* singleton 援用) は実態 (同期単一呼出局所性 + Zustand handoff) に訂正。
  **実装後レビュー** (opus 1 agent): re-export surface / byte-identity / barrel-KEEP / import 配線 / private 漏れ の 5 観点。
  決定論検証: 独立 verifier (HEAD slice md5 突合) **PASS** (全移送 body byte-identical) + surface 検証 (旧公開 17+5 漏れ 0 /
  private 漏れ 0) + B 行被覆完全。挙動不変ゲート (全 GREEN): tsc **0** / full vitest **2783 pass+1skip** (baseline 一致) /
  smoke:1000 **winsA=498** (timeouts0/exceptions0) / e2e 3spec **26 pass** / eslint **stash-diff added=0 removed=0** (125,77e/48w) /
  規約 lint 8 本 errors=0 / slot **11 不変** / side-channel **12ch 不変** (_justDeclaredAxId は `__pending` 接頭辞外で非計数)。
  教訓: ① 抽出先専用 import (AbilityCostParams/_getResolutionLock) は barrel から除去要 (noUnusedLocals が捕捉)。
  ② file-private の export 昇格は sub-file 限定・barrel 非公開で公開 surface を広げない (3b 方針)。
  ③ produce 境界越え module-let の cross-module 化は安全でも convention 逸脱 → 同居 KEEP が最小リスク。

- **3e (2026-06-22)** useEngineDispatch exhaustiveness ガード (minimal)。**着手前フルパネル設計レビュー** (Workflow opus 4 lens
  [invariance/ts-semantics/scope-rebuttal/completeness-critic] + synthesis、509k tok、**BLOCKER 0**、scopeVote **4/4 minimal**)。
  当初 4 sub-goal を adversarial に裁定し sub-goal④ のみ ADOPT に純化: ①runEngineAction 分割=**DROP** (barrel 490<500 で size
  動機ゼロ + axId cross-module化が BUG-034 category)、②axId globalThis化=**DROP** (slot 11→12 で headline ≤7 逆行・3c 打消し、
  barrel module-let KEEP)、③EngineAction family型化=**SUBSUMED** (効くのは 2 switch のみ、full-union default:never が member-drop
  全捕捉、family は net-negative)。実装: 両 switch (runEngineAction void / isAllowed boolean) 末尾に inline
  `const _exhaustive: never = action; void _exhaustive;` + void/false。**throw 不使用** (isAllowed は dispatchEngineAction
  try 外で呼ばれ throw だと uncaught 化で挙動破壊)。helper 不使用 (repo 既存 8 サイト全インライン)。挙動不変ゲート (全 GREEN):
  tsc **0** (両 tsconfig) + **負テスト** (case 1 削除→TS2322 で guard 有効性実証、commit せず) / vitest **2783+1skip** (baseline 一致) /
  smoke **winsA=498** (timeouts0/exceptions0/avg11.0) / e2e 3spec **26** / eslint **125** (added0) / 規約 lint 8 本 0 / slot **11 据置** /
  numstat **additive-only** (各 7add/0del、追加行=default ブロックのみ)。教訓: ⓐ 骨格層 `applyMove` に同型 silent-gap
  (policy.ts:209) → 骨格凍結ゆえ **Phase 3f** に trace (水平展開義務)。ⓑ scope 反証 lens が convergence hazard (deferred sub-goal
  の phantom 化) を指摘 → DROP/SUBSUMED を doc 明記し phase を clean close。ⓒ additive 改変は byte-identity verifier 不適 →
  `git diff --numstat` deletions=0 + 追加 hunk=default ブロックのみ で機械検証。

- **3f (2026-06-22)** engine `applyMove` (policy.ts:209) に default:never (void 変種)。3e engine 同型 silent-gap の水平展開。
  **着手前 opus 3 lens+synthesis** (367k、**BLOCKER 0**、GO): invariance/骨格凍結(例外3「動作不変な内部最適化」)=ADOPT-AS-IS、
  completeness=ADOPT-WITH-CHANGES → resolve-picks.ts:431 同型未ガード switch (`case 'chain'` 欠落で top-level chain un-walked) を **Phase 3g/[BUG-152](../../bugs/BUG-152.md)** に切出し。
  void 理由: 呼出 4 site のうち policy.ts:412 が try 外 (3e 同判断)。ゲート全 GREEN: tsc0(両)+負テスト(reasoning削除→TS2322@(280,13)→復元) /
  vitest 2783+1skip / smoke winsA=498 / e2e 26 (初回 contention flake→再走 green) / eslint 125(added0) / 規約8本0 / numstat 8add/0del。詳細 phase-3f-design.md。

- **3g (2026-06-22)** resolve-picks.ts:431 `resolveEffectPicks` の `switch(effect.kind)` に `case 'chain'` を追加
  (`negate`/`custom` と並べ明示 passthrough) + `default` を `const _exhaustive: never = effect; void _exhaustive; return effect` 化。
  3f 水平展開で発見の silent-gap (Effect union 11 member のうち chain が default:return effect に落ち un-walked) を塞ぐ。
  **着手前 opus 3 lens+synthesis** (403k tok、**BLOCKER 0**、**GO**): ① invariance(敵対)=**invariant** (chain/negate/custom は現 default と
  参照同一の effect を返す→全11member runtime bit-identical。パッチ適用→vitest/smoke 実走→git diff empty で実証)、② 骨格凍結+guard変種=
  例外「動作不変な内部最適化」に該当 / **return が正** (resolveEffectPicks は applyMove→declared-ability:199 経由で produce() try 外
  [policy.ts:419-423] から到達、throw だと stepTurn 貫通。resolver.ts:174 が throw なのは dispatch sink ゆえの正当な非対称)、③ 活性バグ=
  **無し** (ALL_CARDS 1374枚 object-walk: chain node 126、step が choice/optional = subtree 含め **0件**→passthrough で drop なし。chain step の
  atom $pick は dispatch 時 tryRePickFromAtom で解決)。Option B (chain walk 救済) は latent future-only ゆえ非採用。
  ゲート全 GREEN: tsc0(両)+負テスト(case'chain'削除→TS2322@(574,13)→復元) / vitest 2783+1skip / smoke winsA=498(exc0/baselineOK) /
  e2e 26 / eslint 125(added0) / 規約lint8本0 / numstat **16add/1del** (additive でなく default アーム再構成、挙動不変は実行差分で担保)。
  詳細 phase-3g-design.md / [BUG-152](../../bugs/BUG-152.md) (活性バグ無のため latent 化・status 据置)。
