# 次セッション再開プロンプト (2026-06-23 — 54-card: reveal-handadd wave 出荷 + 54-engine: MR設計 / 次=MR実装 or カード継続)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効 (実作業は Workflow オーケストレーション、token 制約なし)。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 現在地 (2026-06-23、HEAD=05103039 — 54-card reveal-handadd wave 出荷済 / 4e31facd MR設計 の上に積層)
- ★開始時に `git ls-remote origin main` で HEAD=05103039 確認 + CI green を確認 (本 wave CI green 実証済)。
- **2並行 session が同時進行・両方 main へ push 済** (協調プロトコル再実証):
  - **54-card (本サマリ下段)**: reveal-handadd wave 10枚 engine変更0 出荷 = **05103039** (ALL_CARDS 1430→1440)。
  - **54-engine (本サマリ上段)**: MR partner-area 構造 **設計のみ** (engine code 変更0) = b8a48a12/4e31facd。実装は未着手。
  - card session の push は engine session の 4e31facd の上に clean ff (集合 disjoint: 別 card files + 別 spec)。

## 54-card サマリ (reveal-handadd wave、検証済: tsc0 / vitest 2951→2969(+18) / smoke winsA=498 exc0 baselineOK / e2e 123+1skip / lint8本errors0)
- **engine変更0** (git diff src/engine 空)。出荷10 (ALL_CARDS 1430→1440): B02050 中森銀三 (reveal-until keyword変装) /
  B05114 弁崎桐平 (declared selfToDeckBottom + reveal-until cardNameバーボン) / B05082+P 「FBI…」(event-use: reveal5 FBI→hand→remove→sceneEnter from hand) /
  B07010 円谷光彦 (reveal2 少年探偵団 + 解決編&加えた discard / 宣言AP+3000) / B09074+P+P2 松田陣平 (疾風draw + reveal4 keyword疾風 + 加えた discard) /
  D10003+D10004 黒衣の騎士・スペイド (caseTrait突撃 continuous + reveal-until cardName)。
- **手法 = CLAUDE.md 決定論優先**: agent 前に engine capability を grep 確定 (deckRevealUntil.filter は defHasKeyword で 変装/疾風 印字判定 + filterAny(OR) /
  sceneEnter source∈{hand,remove,deck} / caseTraitConditioned continuous grantKeywords / mill 静的count)。
  → NEXT-SESSION の DEFER フラグ (B02050 keyword-filter / D10003 突撃+caseTrait) が **保守的すぎ=実装可** と判明 (capability-map stale 同型)。
- **敵対 review が実バグ検出**: D10003/D10004 a1 inner.description prefix 込み → caseTraitConditioned 再付与で二重prefix (表示のみ) → prefix削除+回帰assertion で close。
- exemplar: B05016/B02019 (deck-look) / B06053/B07052 (reveal-until) / D07008 (sceneEnter from hand) / B01076 (event-use wrapper) / D11003 (疾風) / partnerColorKeyword (continuous keyword)。
- 同クラスタ DEFER 据置: PR265 (mill動的count) / B09078 (dual-pick) / B08026・B03028 (event-use closure/hook) / B04063 (動的level-sum)。

---
（以下は 54-engine session の MR partner-area 設計サマリ。実装は未着手＝次 session の候補A/B）

## 54-engine サマリ (MR partner-area 構造 設計、engine code 変更0 の design-first session、push=b8a48a12)
- 出荷物 = MR partner-area 設計 spec 2本 + DEFERRED-INDEX 更新 + auto-docs。

## 54-engine スコーピング詳細 (MR investment 選定経緯)
- ユーザー選択 C「engine投資 wave」→ scout で名前候補 (leave-trigger/set-event/opp-evidence/hand-count/flipFaceDown) は
  **全部 low-yield** と判明 (hand-count は既に engine変更0=capability-map stale、他は 0〜1枚)。**MR partner-area が唯一の大投資**。
- → ユーザー選択「MR (設計先行)」。grounding 3lens (cohort/touchpoint/rules) → 設計 → **敵対review 3lens** で BLOCKER×3 fold-in。
- **spec**: [.claude/specs/engine-mr-partner-area-design.md](specs/engine-mr-partner-area-design.md) (設計) +
  [engine-mr-partner-area-cohort.md](specs/engine-mr-partner-area-cohort.md) (yield 表)。DEFERRED-INDEX partner-area 行から link。
- **歩留まり**: 残 MR 25 unique。PA-slot 配線 + read/char PA-MR 走査で **SOLE 15枚**、残 **MULTI 10**。
- **設計要点**: partner singleton 非破壊・新 optional slot `partnerAreaMR`、MR②で MR≤1。dead stub (toPartnerAreaFromScene/toRemovedByMR) は破壊的ゆえ置換。
  spine = collectCardsInPlay 別uid `partnerMR:` + read/char auraDelta PA-MR 走査。MR① 全 leave verb redirect + remove splice。MR② cause:'effect' + caller 層 fullness 再計算。declaredUseCount は slot object + flag.ts。
- **未解決4件は要公式Q&A** (MR① 中間状態順序 / PA-MR removal 分類 / targetability / MR②×switch)。実装前に commmune 照会 or 暫定保守解+provisional。

## 次にやること (要ユーザー選択)
A) **MR partner-area 実装 (Phase 1 = engine core)**: spec の変更ファイル10件を additive 実装 + decoy test (TDD)。
   別 engine session 推奨。挙動不変ゲート + 敵対review。未解決4件は着手前に方針決定 (公式Q&A or provisional)。Phase 2=UI / 3=AI / 4=SOLE 15枚 card wave。
B) **MR 着手前に公式 Q&A 照会** (deep-research / firecrawl で commmune talk002): 未解決4件の裁定を取ってから実装。
C) **カード追加 継続** (engine変更0 純既存パターン) or 他 engine 投資。残カード実数は live 計測 (`.tmp/_regen-regids.mts` → `node scripts/inventory-remaining.cjs`)。
→ 開始時にユーザーへ方向確認。

## 並行セッション協調 (2026-06-23 再実証)
- engine変更0/design session と card session の同時進行は有効。衝突は registry/auto-doc/共有md のみ。
- ⚠ **docs 混入注意** (今回実証): 並行 session の未追跡カードが `npm run docs` で structure.md に混入 → commit すると CI red。
  commit 前に相手の未追跡 (`git status --short | grep '^??'`) を `/c/tmp/parallel-hold/` へ退避 → docs 再生成 (clean) → 自分の対象だけ add → commit → 退避戻す。
  (memory: feedback-parallel-docs-contamination)。mapping/progress は source-hash で自分の変更のみ反映=安全。structure.md だけが filesystem スキャンで混入。
- 衝突解決 (rebase): `git checkout --ours` auto-docs → `node scripts/taskA-register.cjs` 再登録 → `npm run docs` → add → continue。NEXT-SESSION は手書き共有=直列更新。
- 敵対review/grounding/scout workflow は同時不可 (server rate-limit、1つずつ・SUB抑制 ≤5〜8)。

## プロセス必須 (engine 拡張 wave、MR 実装時)
- **着手前に spec 2本を全読み** (Bash cat、Read は line1 truncate)。設計の変更ファイル10件 + 未解決4件 + 回帰アイソレーション節を踏襲。
- **engine 拡張は additive + 回帰ゼロ** (legacy 保持 / 新 verb·flag·hook·slot)。partner singleton path は別 slot ゆえ干渉ゼロが load-bearing 不変。
- **decoy engine test 必須**: MR① は相手ターン全 leave verb (remove/toDeck/toDeckBottom/toHand)、MR② は enter/switchEnter の fullness 再計算、PA-MR の triggered/declared/continuous/【ターン①】reset を 1対1。
- **敵対 faithfulness review 必須** (opus workflow、1つずつ)。BLOCKER は DEFER+BUG 起票。
- capability-map の ⛔ negative は **stale 化しうる** → eval.ts/types/effect.ts 直 grep で裏取り (今回 hand-count/aura/split-name/keyword filter の stale を発見訂正)。

## プロセス共通
- 着手前 working tree 確認 (`.claude/design/` + 並行 session 未追跡 = OK) / branch first。main 直 commit 禁止。
- 挙動不変ゲート: tsc0(両=`npm run typecheck`) / vitest (combined baseline 2951、wave-reveal-handadd 出荷後は要再計測) / smoke:1000 + check:smoke-baseline (winsA=498) /
  e2e (`npx playwright test`、~4min) / pre-commit (simple-git-hooks: docs:check + 規約 lint 8本)。
  ★validate-specs FAIL PR280 は既存・無関係。engine 触る wave は git diff src/engine で additive のみ精査。
- Read hook が file を line1 で切る → Bash cat/sed/awk で読む。Write/Edit は Read 1回で登録後。subagent も Bash 指示。
  カード全文 TSV (0-index): character col10=effect col11=cutIn col12=hirameki col13=henso col16=qAndA / B0N→ct-p0N、PR→pr-01。col0=cardNum col7=rarity(MR/MRP/MRCP) col9=imagePath。
  ★helper: .tmp/_fulltext.cjs <ids> / .tmp/_grep-remaining.cjs <regex> / .tmp/_meta2.cjs <ids> / scripts/inventory-remaining.cjs / .tmp/_regen-regids.mts。
- 新 .md/src → 全 .md 編集後 `npm run docs` 1回 → 明示 add (CHANGELOG.md も) → commit。★Markdown 基本 100 行 / memory.md 80 行で sessions/ へ rotate (現 memory.md は session51 で 80行=要 rotate)。
- git add は対象 src/test + 記録 md + 再生成 auto docs。除外: .claude/design (?? のみ)・並行 session 未追跡。git add -A 禁止。重い opus workflow は1つずつ。
```
