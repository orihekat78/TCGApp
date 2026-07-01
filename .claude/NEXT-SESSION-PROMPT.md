# 次セッション再開プロンプト (2026-07-01 — engine-first E1 / additive wave-5 出荷: boundAnyMatchesFilter + handUseRestrictFilter)

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 方針 (2026-06-30、ユーザー決定)
- **engine 拡張のみ先に全部 → 完了後にカード追加フェーズ** (engine-first)。骨格凍結到達が目標。
- 認識合意: 計画 (E1+E2+E3+MR) 完了 = 現561枚に対しエンジン拡張完了。±5/軽微touch-up/将来セットは別。

## 現在地
- ★開始時 `git ls-remote origin main` + `gh run list -L1` で remote HEAD / CI 確認。
- **main = 7d1e0be2** (E1 additive **wave-5**: boundAnyMatchesFilter cond / handUseRestrictFilter。直前=8d76aeb3 wave-4)。vitest baseline=**3504 pass +1 skip**。
- ⚠ 並行 session 複数稼働・同一 working tree 共有 → 自分のファイルだけ明示 add。engine 並行は `git worktree add` 隔離。

## ★driver: engine 拡張 実行計画
- **[engine-extension-plan-2026-06-30.md](specs/engine-extension-plan-2026-06-30.md)** + per-primitive 全データ
  [.tsv](specs/engine-extension-plan-2026-06-30.tsv) (batch/label/member/sole/additive/effort/stale/vocab/plug/**cardTextPattern**)。
- 85 primitive grounding (opus 11agent workflow)。**50 pure-additive / 32 structural / 3 risky / 10 stale既出荷**。総 sole≈278。
- 実行順 = **E1(additive)→E2(structural)→E3(risky)→MR(G42)**。各 phase 内 impact降順。

## ⚠⚠ 最重要 process 教訓 (継続)
- grounding TSV の sole/effort/stale は **上振れ**。**各 primitive 着手前に origin/main で実 grep 必須** (vocab token を `git grep origin/main -- src/engine`)。
- **sole-count も per-card 要 certify**。card-wave 同様、wave の対象カードは個別確認。
- **TSV の pure-additive ラベルも要検証**: wave-5 で **P37 (trait/name grant aura) は TSV では pure-additive だが実際は matchOneFilter (BUG-117 hot path) の trait/color/name 読みに late-bind aura を差す=filter-core 変更**。「read.char.traits だけ足す」は半端解 (matchOneFilter 経由の filter/bond が granted trait を見ない、on-set-host session70 の READ≠解禁 教訓)。→ **P37 は wave-5 から分離し wave-6 で単独・全 lens review** に回した。

## 直近 wave 出荷済 (engine-only、card 未追加)
- **wave-5 (7d1e0be2)** — 純 additive 2件:
  `boundAnyMatchesFilter` cond(G17、[cond/eval.ts](../src/engine/cond/eval.ts))=ctx.bindings[bindKey] **全枚数 any-match**。
  既存 boundMatchesFilter は bound[0] のみ→N>1 の公開/リムーブ集合を評価不可だった。各要素を matchOneFilter(c=null=CardDef 印字値、
  remove-area cand は removeColorAtLeast L291 同流儀) に委譲。PR132「特徴[警察]がリムーブされた場合」(any) / D06013「【緑】と【白】が1枚以上」
  = and[boundAny{緑},boundAny{白}] で合成。CONDITION_KIND_MAP + cjs CONDS 両登録。 /
  `handUseRestrictFilter` ContinuousModifier field(P05、[card-def.ts](../src/engine/types/card-def.ts))=case card 継続能力
  「自分は〚特徴[X]〛以外のキャラを手札から使用できない」(B05120 探偵/B06109 高校生)。新 helper `handUseCharRestrictAllows`
  ([hand-use-card.ts](../src/engine/flow/main/hand-use-card.ts)) が自 case def の abilities[].continuousModifier.handUseRestrictFilter を
  走査(**type==='continuous' + ability.condition honor**、read/char.ts 同流儀)、**手札の使用 + ネクストヒント両経路**で character-only gate。
  event/効果登場/カットイン/変装/ヒラメキ は別経路ゆえ対象外(公式 Q&A)。★opus 4-lens=**SHIP_WITH_NITS(0 blocker)**。
  NIT対応済=type/condition guard 追加。DEFER=B07002 distinct-color-pair(別 Condition 要) / B06103 カード名+効果登場ban(別 mechanism) /
  UI toCandidate next-hint 候補除外(consumer カード出荷時=card-wave 配線、現状 engine gate+runNextHint throw で server-side enforce 済)。
  詳細 changelog [2026-07-01-02](changelog-entries/2026-07-01-02-engine-additive-wave5.md) / DEFERRED-INDEX「wave engine/wave5-bound-handrestrict」節。
- **wave-4 (8d76aeb3)** — `$self.level` dyn / `drawUpToHandSize` verb / `remove:exit` observer+`removeExitMatches`。詳細 [[reference-engine-additive-wave4-0701]]。
- **wave-3 (80621194)** — 観測 hook `cutin:used`/`misread:performed`/`evidence:removed` + `triggerCutinMatches`。詳細 [[reference-engine-additive-wave3-observer]]。
- **wave-2 (3c0bc702)** — 評価器 `evidenceDiff`/`sceneCountCompare`/`removeColorAtLeast.cardKind`/`$self.sceneColorNot` dyn。詳細 [[reference-engine-additive-wave-0630]]。
- **wave-1 (8f715c92)** — `setNextHintBan`/`nextHintBanned` (turn-flag テンプレ)。

## 次やること: E1 wave-6 (P37 単独 隔離 + 続き)
- ★着手前: 各 primitive を origin/main (7d1e0be2) で実 grep (stale 排除)。**wave-5 で G17 any-match(boundAnyMatchesFilter) / P05 hand-use restrict 出荷済**。
- **最優先 = P37 継続 trait/name grant aura (7枚、要隔離 review)**:「自分の現場のキャラは特徴[X]を持つ」(B06095 全自軍)/「このキャラは特徴[探偵]を持つ」(B05012 self)/
  「特徴[警察]を失い特徴[探偵]を持つ」(B05101 trait変更)。★実装方針 (wave-5 で調査済): apDeltaAura/continuousDelta の **late-bind aura template を trait/name に適用** —
  ContinuousModifier に grantTraits/grantNames field 追加 + read/char.ts に board-scan(recursion guard、auraDeltaSafe 同流儀) + **candidates.matchOneFilter の
  trait/color/cardName 読みを late-bound registerTraitGrant 経由に**(filter-AP=combat-AP と同原則で filter-trait=board-trait)。既存カード未宣言→空→無害。
  ⚠ matchOneFilter は c=null(CardDef only、boundMatchesFilter/removed-area 経由) 呼出が多い→granted trait は board char(uid 既知)時のみ適用。★filter 核心変更ゆえ **opus 4-lens + 専用 decoy test 必須**。
- 他 wave-6 候補 (impact 降順、全 pure-additive、★per-card sole 要 certify、着手前 origin/main grep):
  - **G17 distinct-color pair (B07002)**: bound 集合内 trait[探偵] メンバーの相互 distinct-color 数≥2 = 新 Condition `boundDistinctColorCount`(boundAnyMatchesFilter では表現不可)。
  - TSV E2 structural 群 (batch 一覧参照) は E1 additive 枯渇後。
- genuine-absent E1 残: G16 相対-LP/level は既出荷($self.lp/$self.level)。B04074($revealed-level-any=G17複合)/B08043(sceneMaxLp dyn 不在) は別 primitive / S-tail (TSV 参照)。
- ⚠ wave-5 latent (card-wave 時): B05120/B06109 出荷時に UI toCandidate 配線 + playwright「画面処理=カードテキスト文言」検証。DEFERRED-INDEX「wave5」節 参照。
- ⚠ wave-4/3 latent: remove:exit コスト由来発火裁定 / evidence:removed×ヒラメキ順。DEFERRED-INDEX 参照。

## プロセス共通 (実証済)
- engine 並行 worktree: `git worktree add -b engine/<name> /c/tmp/<dir> origin/main` → PowerShell `New-Item -ItemType Junction`
  で node_modules を main から junction → 作業 → FF push → worktree remove。
- TDD: RED(専用 test、feature-missing fail) → GREEN(最小配線) → 実カード使用形は drain/produce 経路で検証。
  turn-flag 系は `tests/cards/cluster6-event-use-ban-behavioral.test.ts`、条件評価器/dyn は `engine-additive-wave-0630.test.ts`、
  gate 系は wave5 の `engine-additive-wave5.test.ts` が template。⚠ runNextHint は `produce(draft)` 内駆動 (popTop が Immer current() 使用)。
- **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test)。⚠ **worktree 絶対パス明示 + `git -C` 裏取り強制 + 埋め込み diff**
  (reviewer は default で main cwd を grep し「未実装」誤 block ([[feedback-workflow-review-reads-cwd-not-worktree]]))。SHIP_WITH_NITS の NIT は card-wave に持ち越すか即対応か判断。
- 6ゲート: tsc0(両 tsconfig) / vitest(baseline=HEAD件数、現3504pass+1skip、`--exclude _probe_`) / smoke:1000 winsA=498 不変 / 8lint err0。eslint=CI非対象。
  engine-only primitive は card consumer 無 → playwright N/A。
- cond 追加は **CONDITION_KIND_MAP + scripts/taskA-validate-specs.cjs CONDS 両登録必須**(satisfies Record で tsc 強制)。
- **commit**: 自ファイル明示 pathspec + `--no-verify` (pre-commit docs:check は CI除外)。changelog-entry 手書き (`.claude/changelog-entries/<date>-NN-slug.md`)。
- **FF push**: `git fetch origin` → `git rebase origin/main` → `git push origin HEAD:main` → `gh run list -L1` CI green。
- カード全文 helper `.tmp/_fulltext.cjs <ids>`。grounding 中間データ: `.tmp/_grounded.json`(85prim) / `.tmp/_label_to_ids.json` / `.tmp/_consolidated_primitives.json`(P01-55) / `.tmp/_engine_ref.md`(G## taxonomy)。
- Read hook が line1 truncate → Edit は Read 1回で登録 / 全文は Bash cat/sed。OneDrive stale-read 警戒 ([[reference-onedrive-stale-read]])。

## アーカイブ
- 上限調査 [engine-extension-upper-bound-2026-06-29.md](specs/engine-extension-upper-bound-2026-06-29.md) / DEFER [DEFERRED-INDEX.md](specs/DEFERRED-INDEX.md) / bug index.base / memory MEMORY.md。
- 旧 wave (handReveal/setCardCount/certify wave 等) は git log + .claude/sessions/ 参照。
```
