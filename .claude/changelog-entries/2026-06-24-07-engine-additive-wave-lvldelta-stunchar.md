# engine — additive wave: continuous lvlDelta + stunChar cost (2026-06-24)

**Round/Phase**: 2026-06-24 engine additive wave。骨格凍結原則の **additive 例外** で wave event-choose3 由来 DEFER
(continuous level / stun cost) の engine gate を解禁。並行 card-session と engine/card 分離。全変更 additive
(既存カードは新 field/cost 未宣言 → 回帰0)。spec: `.claude/specs/engine-additive-wave-2026-06-24.md`。commit a206e9dc。

## Gap1 — `ContinuousModifier.lvlDelta` (継続レベル修正)

- `apDelta`/`lpDelta` と完全対称に `lvlDelta?: ContinuousDelta` を1 field 追加 (`card-def.ts`)。
- honor site は **2つだけ** (BUG-117 原則 filter-level==combat-level): `read.char.level()` +
  `candidates.matchOneFilter()`。`continuousDelta`/`continuousDeltaSafe` の `which` union を拡張。
- 再帰は既存 module-level `_inContinuousDelta` guard が which 非依存で depth-2 終端 (B08059 自己参照条件でも無限ループ無し)。
- out of scope: play-level (`hand-use-card`/`next-hint` の静的 `d.level`) は不変 (B08050 QA「現場以外はレベル4」と一致)。
- 「【自分ターン中】レベル+1」(B08059) / 「【解決編】レベル+3」(B08050) 型を card-session へ解放。

## Gap3 — Cost `stunChar`

- `sleepChar` 対称の新 Cost kind 〚アクティブ状態の[X]を1枚スタンさせる〛(B08004)。
- honor site: Cost union (`effect.ts`) / `canPay` (active 候補要求) / `pay` (active のみ stun + **n.max honor**) /
  UI `costToText` / validate-specs COSTS whitelist。AI は `canPay` で generic gate 済。
- n.max honor で「1枚」を faithful に守る (sleepChar 由来の over-pay を新規側で回避)。B08004 を card-session へ解放
  (errata 2026-03-02 現場条件追記は card 側)。

## Gap2 — carrier-reuse は **stale DEFER 訂正** (engine変更0)

- B08023/B08033 の「1 pick→2 atom 同キャラ」は **2026-06-12 出荷済** の `bind:'$picked'`+`uid:'$picked.uid'`
  機構 (BUG-130 / Task D E0) で実装可能。出荷 exemplar B02040 が同一 shape、test pick-bind.test.ts 有り。
- DEFERRED-INDEX を訂正し **B08023 を解放**。⚠ B08033 a2 は別 gate (set-card-removal COST) 併発で依然 DEFER。

## 検証 (additive ゲート)

- `tsc` 0 / `vitest` **3054 pass** (+exemplar test 2: lvldelta 9 / stunchar 6) / `smoke:1000` winsA=498 不変
  exceptions=0 baseline OK / eslint・8 lint 群 0err。
- 各 gap を **opus 4 lens / 3 lens 敵対 review**。no-blocker。review が surfacing した pre-existing 欠陥を
  [BUG-156](../bugs/BUG-156.md) (sleepChar/stunChar cost over-pay) / [BUG-157](../bugs/BUG-157.md)
  (read.char.ap/lp 無 guard 相互再帰) として記録 (本 wave 非起因、別 commit で unified 修正予定)。
