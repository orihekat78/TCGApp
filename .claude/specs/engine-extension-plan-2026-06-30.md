# エンジン拡張 実行計画 (engine-first フェーズ, 2026-06-30)

ユーザー方針: **エンジン拡張のみ先に全部 → 完了後にカード追加フェーズ**。本ファイルが driver。
85 primitive を 11 subsystem batch で grounding (workflow wf_f151a3b3、opus 11agent/3wave)。
per-primitive 全データ = [engine-extension-plan-2026-06-30.tsv](engine-extension-plan-2026-06-30.tsv)
(batch/label/member/sole/additive/effort/stale/vocab/plug/**cardTextPattern**/**representativeQuote**)。

## ⚠ 必読 caveat (grounding は stale checkout)

- grounding は **local HEAD 73bfe1bd** (= origin/main より **5 commit 遅れ**) で実施。
  欠く commit: b34d33cc(on-set-host) / 011dbb31(additive wave 0629d)。
- → **top additive の一部が origin/main で既出荷なのに「未実装 ADD」と誤判定**:
  `costRemovedMatches`(G36) / `on-set-host`(P01 READ) / `souzaBind`(P04) / sceneLpSum / oppSceneCount /
  enterCountAtMost / canCutIn は **origin/main に在り**。
- **各 primitive は実装着手前に origin/main で再 grep 必須** (eval.ts/effect.ts/char.ts/cost 直読)。
  TSV の sole/effort は上振れ得る ([[reference-onedrive-stale-read]] / [[feedback-workflow-review-reads-cwd-not-worktree]])。

### 再検証結果 (2026-06-30、origin/main 実 grep)

E1 上位4件が **既出荷判明** (plan sole 過大、計53枚消滅 → 将来 card phase で ENGINE0):
- **P01** set-card rider = SHIPPED (`on-set-host` READ+triggered+WRITE 配線、char.ts:221/triggered.ts)
- **G36** cost除去分岐 = SHIPPED (`costRemovedMatches` filter=full TargetFilter、AND-only/OR は Condition 合成)
- **P04** 捜査 binding = SHIPPED (`souzaBind`)、**P46** opp AP-debuff aura = SHIPPED (`apDeltaAuraOpp`)
E1 genuine-absent 最大群 = **P37/P23/G17 (各7)**、次 P05/P06 (各6)、G16/P44 (各4)。残 ~25 primitive は S-tail。
→ wave-1 候補 = **restriction-flag family** (P05 手札使用禁止6 / P06 ネクストヒント禁止6 / cutin抑止窓3 / P08 refresh証拠抑止1 / P09 色制限bypass1 ≈17枚、全 pure-additive flag+check+reset、canCutIn 0629d 先例)。

## 結論 (additive-safety × impact)

| 区分 | primitive | sole-unlock | 方針 |
|------|-----------|-------------|------|
| **STALE 既出荷** | 10 | 14 | engine work 不要 → **card phase で ENGINE0 author** |
| **E1 pure-additive** | 41 | ~140 | 骨格凍結原則最良。impact 順 wave で先行 |
| **E2 structural** | 31 | ~104 | GameState/core loop に触れる。慎重 |
| **E3 risky/rewrite** | 3 | ~20 | alt勝敗書換 (P10) / partner全色+cap (P11)。最後 |
| 計 | 85 | 278 | (561未実装中、複数gate要カードは sole 外) |

実行順 = **E1 (additive) → E2 (structural) → E3 (rewrite) → MR (G42 別サブシステム)**。
各 phase 内は sole-unlock 降順。挙動不変ゲート (tsc/vitest/smoke winsA=498/8lint) を毎 commit。

## Phase E1 — pure-additive (先行、impact 順)

> ★印 = stale-checkout 疑い、origin/main 再検証で sole 減・既出荷の可能性。

| prim | sole | eff | 何のカードテキスト用か (詳細 TSV) |
|------|-----:|----|--------------------------------|
| ★P01 set-card→host rider | 26 | M | 「このイベントがセットされてるキャラは〚突撃〛を持つ/AP+2000/リムーブされない」(on-set-host READ は既出荷、WRITE/rider 拡張が残) |
| ★G36 cost除去カード分岐 | 19 | S | 「〚X〛をリムーブして: …そのカードがレベルN以下なら」(costRemovedMatches 既出荷、kind/level/name 軸の残検証) |
| P37 継続 特徴/名 grant aura | 7 | M | 「自分の現場のキャラは特徴［少年探偵団］を持つ」等の trait 付与 aura |
| P23 カットイン使用 observer | 7 | M | 「相手がカットインを使用したとき〜」反応 hook |
| G17 $revealed 色読み n>1 | 7 | M | 「公開した(複数)カードの色につき〜」(boundMatchesFilter bound[0]のみ→n>1) |
| ★P04 捜査『発見された』binding | 6 | M | 捜査Xの公開集合を後続効果/条件で参照 (souzaBind 既出荷、参照/計数の残) |
| P05 手札使用禁止 flag | 6 | M | 「相手は[名/特徴]のカードを手札から使用できない」 |
| P06 ネクストヒント禁止 flag | 6 | S | 「相手はネクストヒントを使用できない」 |
| G16 relative-LP/level filter | 4 | M | 「このキャラのレベル以下のキャラを選ぶ」 |
| P44 draw-up-to-hand-size | 4 | S | 「手札がN枚になるまで引く」 |
| …残 S-tail (P27/P28/P29/P42/P39/P41/P54/P31/G13/G19/P08/P12/P48/P26/P25c/P43/P03/P20/P24/G04/G05/G09) | ~50 | S | TSV 参照 |

## Phase E2 — structural (GameState/core loop)

observer (P21 味方被選択/P22 手札名公開/P19 イベント使用source/G06) / keyword-turn-track
(P15 疾風発動済/P16 疾風override/P17 acted-this-turn/G32 filtered-keyword) / verb (P18 効果でイベント使用/
P47 startContact/P40/P38) / leave (P02 離場置換/P03) / cond (G14 self-count latch/P36/P52) /
P14 同名deckReveal / P45 auto-phase aura / P49 遅延登場 / P53 全証拠特徴計数→敗北。詳細 TSV。

## Phase E3 — risky / rewrite + data-model (最重、最後)

- **P10 alt勝敗書換** (15, RISK): パートナー事件解決能力の書換 / 「相手はゲームに敗北する」/ 証拠隠滅 keyword。gameResult 固定の改変。
- **G39 partner-area カード枠** (24, STRUCT-L): GameState に PA カードスロット無 (ビッグジュエル等)。最多だが data-model 改変。
- **G37 scope 配列** (15, STRUCT-L): 宣言/反応が on-scene+on-partner-area 併記。
- P11 partner全色+現場cap5→4 (RISK) / G40 イベント特徴 / G34 group-choice / G38 per-side-quota / G31 revive。
- **G42 MR partner-area サブシステム** (設計済 [[project-mr-partner-area-design-2026-06-23]])。最後に独立 phase。

## 実行手順 (per primitive、card-wave/engine並行 worktree)

1. **origin/main 再 grep** で stale 解消 (既出荷なら skip→card phase へ)。
2. `git worktree add -b engine/<prim> /c/tmp/<dir> origin/main` 隔離。
3. TDD: 実カード使用形 probe test (unit でなく drain 経路で false-green 回避) → 実装 (additive のみ)。
4. **opus 4-lens 敵対 review** (semantic/additivity/dsl-trap/edge-test)。
5. 6ゲート: tsc0 / vitest(baseline不変) / smoke:1000+winsA=498 / 8lint+eslint。
6. FF push (fetch→rebase origin/main→push HEAD:main) → CI green。changelog-entry 手書き。
7. **複数 primitive をまとめて 1 wave = 1 commit** (additive 同系を束ね、session67/68/69 の additive-wave 方式)。

## 想定アウトカム

- E1 完了 ≈ +140 card 解禁 (additive、低risk)。E2 ≈ +104。E3 ≈ +20。stale 14 は即 card phase。
- 各 primitive の真の remaining は origin/main 再検証後に確定 (top3 は既出荷で目減り見込み)。
- 全 phase 完了 → 骨格凍結 → card phase で 561 を均一 author。

## compiler demand-signal 反映 (2026-07-02 Track B、origin/main 8ae3f56f 再採寸済)

真の engine gap は 4 family のみ (ids・降格根拠 = [compiler-demand-signal-2026-07-02.md](compiler-demand-signal-2026-07-02.md)):
**P10 事件解決 rewrite+証拠隠滅 = 同一8枚** (E3 最大単一 family) / **G39 PA card slot 4+3** /
**「アクション中のキャラ」TargetFilter 軸 4** (小 additive、E1 相当で先行可) / **G34 multi-select 4**。
降格 (出荷済→card-phase): MR PA 宣言/発動 24 (mr-partner-area core は bef3adad で出荷済、TSV/auto-mem の「未実装」stale) /
set-event family ~15 (fromSelf+on-set-host) / keyword turn-grant ~13 / 事件緑＆白 4。

## 関連
- 上限調査: [engine-extension-upper-bound-2026-06-29.md](engine-extension-upper-bound-2026-06-29.md)
- per-card verdict: [engine0-vs-extension-2026-06-29.tsv](engine0-vs-extension-2026-06-29.tsv)
- DEFER: [DEFERRED-INDEX.md](DEFERRED-INDEX.md) / 骨格凍結: [CLAUDE.md](../CLAUDE.md)
