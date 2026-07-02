# 次セッション再開プロンプト — Track A: engine 拡張 (2026-07-02 二Track化)

> ★Track B (カード追加ツール = text→DSL compiler) は **別 session・別プロンプト** → [NEXT-SESSION-PROMPT-TRACK-B.md](NEXT-SESSION-PROMPT-TRACK-B.md)。
> 本 session は engine 拡張専任 (直近: E2 structural **起点** wave-7 出荷 actedCharThisTurn + exemplar B08049 ジョディ)。

> モデル方針: `claude-fable-5` agent 不可 → 本体・難判断とも **opus 最初から**。⚠ 応答は日本語。
> Caveman mode 有効 (出力簡潔、コード/コミットは通常文)。Ultracode 有効。

---

```text
名探偵コナンTCG MVP。まず CLAUDE.md → README → CHANGELOG → .claude/auto/structure.md → memory.md を読む。

## 方針 (2026-06-30、ユーザー決定)
- **engine 拡張のみ先に全部 → 完了後にカード追加フェーズ** (engine-first)。骨格凍結到達が目標。
- 認識合意: 計画 (E1+E2+E3+MR) 完了 = 現561枚に対しエンジン拡張完了。±5/軽微touch-up/将来セットは別。

## ★★方針改定 (2026-07-02、ユーザー決定 — 速度リバランス)
- 「速度<精度 一律」撤回 → **リスク連動 3-tier ゲート** ([specs/speed-rebalance-2026-07-02.md](specs/speed-rebalance-2026-07-02.md))。
  T1 (pure-additive/clone)=機械ゲート+probe のみ・review 0-1 lens / T2=2 lens / T3 (hot-path/core/MR)=従来フル。
- wave 大型化: T1 は 10-15 prim or 20-40 card / 1 commit、1 session 複数 wave 可 (context 60% まで)。
- **全カード完了計画** = [specs/all-cards-completion-plan-2026-07-02.md](specs/all-cards-completion-plan-2026-07-02.md)
  (残535枚。**Track A** = engine A1-A5 10-12 session / **Track B** = compiler B0-B3 5-9 session、計 ~15-21・並行で暦上 ~10-13 slot)。
- engine wave には **exemplar カード 1-2 枚を同 commit 同梱** (E2E 生きたテスト + clone 原器、再certify 二度手間排除)。
- **text→DSL compiler 採用 (2026-07-02 ユーザー決定)**: silent 誤訳の源=AI 即興翻訳を whitelist 文法で構造排除。未知句 refuse→DEFER。
- **★二 Track 並行 (2026-07-02 ユーザー決定)**: 本 prompt = **Track A (engine 拡張専任)**。compiler/文法/oracle/bulk author は
  **Track B 専任** ([NEXT-SESSION-PROMPT-TRACK-B.md](NEXT-SESSION-PROMPT-TRACK-B.md) / driver [specs/compiler-track-plan-2026-07-02.md](specs/compiler-track-plan-2026-07-02.md))。
  Track A の対 B 義務 = **exemplar カード 1-2 枚を wave 同 commit 同梱のみ** (B の oracle 入力 + 新 primitive の機械可読 spec。
  production rule 登録は B へ移管、A は書かない)。A は src/engine+exemplar / B は scripts/compiler+bulk のみ。
  B の bulk は「1 wave 以上前に出荷済 primitive の family」限定 (barrel 衝突なし)。

## 現在地
- ★開始時 `git ls-remote origin main` + `gh run list -L1` で remote HEAD / CI 確認。
- **main = ef63cd9b** (E2 structural **wave-7**: P17 actedCharThisTurn char filter + exemplar B08049。直前=df9460d0 Track B compiler B0 / 9f9ea043 wave-6)。vitest baseline=**3567 pass +1 skip** (ef63cd9b、Track B B0 test 込み。自 wave 分は +15)。
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

## 直近 wave 出荷済
- **wave-7 (ef63cd9b)** — E2 structural **起点** P17 (actedCharThisTurn char filter) + exemplar **B08049 ジョディ** 同梱 (新方針の生きた E2E):
  `actedCharThisTurn?: boolean` TargetFilter 軸 = 「このターン中にアクション[キャラ]した」board char。**記録**=[state-machine.declare](../src/engine/flow/action/state-machine.ts) が `action:declare` emit 後 `target.kind==='char'` の時 actor へ `setTurnEffect`(アクション[事件] は除外、rules/22 宣言時確定)。**参照**=[matchOneFilter](../src/engine/target/candidates.ts) が board char の turnEffects flag を honor (**全 filter-eval site が委譲**→単一挿入で全 site honor、c=null fail-closed、hasSetCards と同 `!== undefined` symmetric)。**清掃**=[clearTurnEffects('turn')](../src/engine/mutate/char.ts)('action'/'contact' は残す)。**3-way sync**(型/FILTER_FIELDS/TARGET_FILTER_KEYS)+ pre-existing `colorNot` 漏れ修正。exemplar B08049: a1=ターン終了 FBI≥4 draw / a2=宣言 sleepSelf→今ターン acted FBI を active化。
  ★sceneSetState PA 短縮形の宣言 dispatch は `resolveEffectPicks` 不可 (bespoke await-path)→ test は production `candidates()` + `cost.canPay` で検証。opus 4-lens 全 SHIP・0 blocker。詳細 [[reference-engine-additive-wave7-acted-this-turn]] / changelog [2026-07-02-02](changelog-entries/2026-07-02-02-engine-additive-wave7-acted-this-turn.md) / DEFERRED-INDEX「wave7-acted-this-turn」節。
- **wave-6 (9f9ea043)** — 純 additive 1件 (P37 継続 trait/name grant、**単独隔離 + opus 4-lens** 済):
  `grantTraits` / `grantNames` ContinuousModifier field ([card-def.ts](../src/engine/types/card-def.ts))。self-scope 継続
  「現場にいるこのキャラは〚特徴/カード名[X]〛を持つ/としても扱う」。[read/char.ts](../src/engine/read/char.ts) `grantWalk`
  (自身 continuous ability を condition + inPA gate 走査、grantKeywords 対称) → `traits()`/`names()` が **印字∪granted** を返す。
  [candidates.ts](../src/engine/target/candidates.ts) `traitNameGrantSafe` late-bind + `_inTraitNameGrant` 再帰 guard
  (continuousDeltaSafe 同 posture、depth-2 終端)。**matchOneFilter trait/cardName/cardNameNot** + read.char.traits/names +
  **cond/eval bond** の 5 honor site が **board char (c?.uid 既知) のみ** effective 集合を honor。c===null (hand/deck/remove/
  bound=cardId) は印字のまま (公式 Q&A「現場にいなければ有効でない」B07053/B08063)。`effectiveNameComponents` export で bond と
  matchOneFilter が同一 name 解決 (BUG-117 一貫性)。→ 解禁 (card-wave): **B05012 恩田遼平 / B07053 ロボット黒羽快斗 /
  B08063 黒田兵衛** (self trait/name、B08063 は自己計数)。★grounding で sole=7 は clean 3 枚に収束。
  **DEFER**: B06095 (全8エリア turn aura=別機構) / B05101 (permanent applied trait 変更+変装引継=mutate verb 要、removeTraits 未追加)。
  opus 4-lens=semantic/edge SHIP_WITH_NITS + additivity/dsl SHIP (**0 blocker**、NIT は opp-side/co-grant/stacking テスト追加で対処)。
  詳細 changelog [2026-07-01-03](changelog-entries/2026-07-01-03-engine-additive-wave6-trait-name-grant.md) /
  DEFERRED-INDEX「wave engine/p37-trait-name-aura」節 (latent 4件記録) / [[reference-engine-additive-wave6-p37-trait-name]]。
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

## 次やること: wave-8 (E2 structural 継続)
- ★着手前: 各 primitive を origin/main (**ef63cd9b**) で実 grep (stale 排除)。**wave-7 で P17 actedCharThisTurn 出荷済**
  (TargetFilter 軸 + declare write + clearTurnEffects + 3-way sync)。**E1 additive は wave-1〜6 で枯渇、E2 structural に移行済**。
- **wave-8 = E2 structural 継続** (wave-7 P17 済。以下 影響降順、★per-card sole 要 certify・非 sole 多数注意):
  - ⚠ **E2 structural の残 P-item は多くが非 sole** (DEFERRED-INDEX「wave7-acted-this-turn」節参照)。単独 exemplar が出せる item を優先。
  - **G17 distinct-color pair (B07002)** [E1 additive 残・0解禁]: 新 Condition `boundDistinctColorCount` (bound 集合内 trait[探偵] の相互 distinct-color 数 ≥2)。
    ★B07002 は **cutin/変装 turn-scoped ban** (P05-P09) と 2-gate ゆえ **その ban primitive とペア**で出す (単独では 0 解禁)。cond/eval.ts 自己完結 evaluator = wave-2/5 テンプレ。
  - **E2 structural 群** (TSV batch=keyword-trait-turn-tracking-grant 等、E1 additive 枯渇後の本命): 影響降順で
    **P15 疾風-発動済 per-turn tracking** (B09072/B09070、TurnScopedFlags に shippuFiredUids + reset + Condition/TargetFilter 軸) /
    **P17 acted-this-turn char filter** (B08049、SceneCharacter.turnEffects に actedCharThisTurn + action:declare 書込 + TargetFilter 軸) /
    **P16 疾風条件 override** (B09090、one-shot armed flag)。structural は state-shape 追加ゆえ additive でなく **挙動不変 gate 設計 + reset 配線**が要点。
  - ★per-card sole 要 certify (`.tmp/_fulltext.cjs`)、TSV の sole/effort は上振れ。
- genuine-absent E1 残: G16 相対 LP/level は既出荷 ($self.lp/$self.level)。B04074 ($revealed-level-any=G17 複合) / B08043 (sceneMaxLp dyn 不在) は別 primitive / S-tail (TSV)。
- ⚠ wave-6 latent (card-wave 時): B08063 自己計数 (継続付与ゆえ latch 不要、matchOneFilter.trait effective 化で成立) / 変装は cardId 変わり印字 continuous 非引継 (Q&A) /
  distinctNames dedup は印字名基準 / read.char.names raw union (非展開) / removedFilter snapshot に grant 非適用。DEFERRED-INDEX「wave engine/p37-trait-name-aura」節 latent 4件 参照。
- ⚠ wave-5 latent: B05120/B06109 出荷時に UI toCandidate 配線 + playwright 検証。wave-4/3 latent: remove:exit コスト由来発火 / evidence:removed×ヒラメキ順。DEFERRED-INDEX 参照。

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
