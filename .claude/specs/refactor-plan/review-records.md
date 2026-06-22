# リファクタ各フェーズ レビュー記録 (phases.md から分割、100 行制約)

- **1a+1b (2026-06-12)** 厳格レビュー (反証観点の自己レビュー + 実コード裏取り) — 指摘 3 件、全て反映:
  ① contact.ts:187 の置換先は scene.toDeckBottom では**ない** — それは scene から splice する primitive
    で、変装はキャラが scene に残る (uid 維持 cardId 入替)。正は `mutate.deck.toBottom` (push と byte 同一)
  ② expandActionTargets の verb 削除は不可 — 印字カード 3 枚 (D11007/B01028/B05071) の def を
    target-expander が静的 walk で読むため verb は declarative marker として必要。dead なのは
    handler の side-channel push のみ → push のみ除去し handler を log no-op 化 + stale コメント 2 箇所是正
  ③ charSetAP/LP throw stub の削除を却下 (1b 参照 — テストで仕様固定された意図的ガード)
  検証: typecheck clean / full vitest **1961 pass / 0 fail** / smoke:1000 **baseline 完全一致**
  (469/531, avg 10.86 — 挙動不変の直接証拠) / e2e 17 pass (engine-extensions + task-d-extensions)

- **1c (2026-06-12)** 調査で計画前提を 2 点補正: ①70 定義は全コピーではなく 30 グループ
  (md5 正規化分類) → Group A 38 定義=完全置換 / Group B ~26 file=既定値保存 wrapper (本文不変) /
  Group C 5 定義=対象外 (CardDef factory・特殊 ctx)。②「旧スキーマ 4 ファイル」は triggered.test.ts
  1 file のみ (他 3 は mutate.scene.enter の options API `named:` の誤検知)。
  敵対レビュー (Workflow 4 観点: default-drift / exact-replace / schema-correction /
  meaning-preservation、546k tok): pass 3 + 指摘 4 件全て同フェーズ内で解消 —
  ① .tsx 3 file (OppTurnOverlay/SceneArea×2) の同名 fixture 取りこぼし → wrapper 化
  ② bug-123 の makeCtx (正準と同値) → import 化 ③ fixtures.ts ヘッダ「byte 等価」→
  「deep-equal (プロパティ順のみ相違)」に訂正 ④ commit 前 docs 再生成。
  残課題 (Phase 4 候補として記録): 別名 factory (char()/mkChar()/インライン literal) が
  unit ~14 + e2e ~13 file に残存 / 既存 eslint 46 err (HEAD 同値)。
  検証: full vitest **1961 pass / 0 fail** ×3 回 / eslint **baseline 46 err と完全一致 (新規 0)** /
  61 file +91/−800 行。tests/ は tsconfig 対象外 (typecheck はテストを検査しない) と判明 — 2b で考慮

- **2b (2026-06-12)** 4 系統を実装: ①AtomVerb/Cost/Condition は `satisfies Record<…, true>` map で
  union との両方向同期をコンパイル時強制 (value セットを export) ②canPay/payInner/evalCond/costToText
  に exhaustive default (noImplicitReturns 無効による missing-case silent ギャップの封鎖 — payInner は
  Task D で実証済の欠陥) ③TRIGGERED_HOOKS export 化 ④cjs whitelist との同期は新設
  sync-taskA-whitelists.test.ts (4 テスト) が機械検証。
  レビューは新トークンポリシー初適用: 決定論検証 (新旧 ATOM_VERBS 50/50 集合一致スクリプト +
  fake verb 注入で同期テストの fail を実証) + **opus 1 lens** (94k tok、旧フルパネルの 1/3〜1/6) — pass。
  指摘 0。検証: typecheck 0 / full vitest **1972 pass / 0 fail** (+4) / smoke:1000 baseline 完全一致 /
  e2e 26 pass。教訓: Python subprocess は cp932 decode 例外で後続復元処理が飛ぶ —
  一時改変→復元パターンは Bash 直列 (mutate && test; restore) で行う

- **2c (2026-06-12)** dispatch 契約是正 (BUG-116 構造解消): declaredAbility/partnerAbility の
  cost+ctx 構築 + pay を新設 engine helper `flow/main/ability-activate.ts`
  (activateDeclaredAbility / activatePartnerAbility + AbilityCostParams) に一元化。呼出元
  (UI runDeclared/PartnerAbilityFlow / AI policy.applyMove / unit 2 / e2e task-d) は
  `{type, uid, abilId, costParams?}` のみ渡す。AI greedy 充填は populateCostParams →
  computeAiCostParams (充填値・走査順同一)。effectPickResolve は 4 形態 union
  (skip / single / multi / switch) 化、Playmat multi-pick 0 枚は skip 形態へ分岐 (挙動同一)。
  意図された挙動変化は「cost 持ち能力の raw dispatch で cost が実際に支払われる」のみ (= 修正本体)。
  silent-skip 依存の e2e 7 箇所を機械棚卸し (tsx one-shot で def cost 抽出) — assert 影響は
  B06069 のみで、skip コメントを sleepSelf 実 assert に置換 (構造解消の実証)。
  レビュー: 決定論検証 (旧形 dispatch 残存ゼロ grep / cost 定義機械抽出) + **Fable 1 lens** (162k tok)
  — BLOCKER/MAJOR 0。MINOR-1 docs 再生成 (本 commit で解消) / MINOR-2 `declaredAbility:cost-not-paid`
  警告が構造解消後 false-positive 化 (pay が costPaid を積むのは flipFaceUpEvidence のみ。log 列は
  旧実装と完全不変のため挙動不変要件外 — 後続フェーズで pay() の costPaid 全 kind マーク化 or
  警告廃止を検討。declared-ability.test.ts:247-362 が警告挙動を固定、変更時は同時更新)。
  INFO: costParams の sceneToDeckBottom.uids / costChoice channel は現状 producer なし (pre-existing) /
  partner-uid declared は latent に cost 支払い化 (UI/AI とも未到達、rules/21 準拠方向)。
  検証: typecheck 0 / full vitest **1972 pass (baseline 完全一致)** / smoke:1000 **baseline 完全一致**
  (469/531, avg 10.86, exceptions 0) / e2e 6 spec **33 pass** / eslint 46err = baseline (新規 0) /
  規約 lint 7 本 errors=0

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
