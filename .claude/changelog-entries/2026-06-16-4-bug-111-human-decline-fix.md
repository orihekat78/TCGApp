## BUG-111 #2 根本修正 — human-decline 経路の sequence mandatory-tail drop (骨格凍結例外: engine bug 修正)

batch#4 gate5 が捕捉した「関連未解決」を再現テストで RCA 確定し、engine を修正。**B05028 over-fire は誤診断**と判明 (opus 敵対レビュー Lens 2 が 5 シナリオ独立検証)。

### 確定した根本原因 (再現で実証: `tests/engine/effect/bug-111-human-decline-repro.test.ts`)
- `sequence[optional-0-pick, ...mandatory-tail]` の 0-pick を **candidate在で human-decline** すると、pending 破棄とともに
  continuation (= 中断 sequence の残り step) が **一律 drop** され、**mandatory 末尾 step が消える** (skipResolvesAtom=false の全 0-pick)。
- 根本原因: continuation が **sequence / chain の origin を区別しない**こと。AI は greedy で decline しないため
  smoke / certify / 敵対 verify をすり抜け、**human-decline 路のみ**が発火条件 (batch#4 で B09038/B09056 を refute、B05028 を gate5-defer)。

### ⚠ batch#4 記録の訂正
旧記録「chain-gate が効かず B05028 step2 が過剰発火」は **再現せず誤診断**。chain[charRemoveSetCard(0-pick), sceneRemove] を
human-decline すると continuation(sceneRemove) が drop し step2 不発火 = 「そうした場合」gate として**正しく動作** →
**B05028 は engine 修正なしで出荷可能** (誤って DEFER されていた)。

### 修正 (TDD、engine 4 ファイル / 骨格凍結例外)
continuation に origin `kind: 'sequence' | 'chain'` を付与:
- **decline 時**: sequence-origin は remainder を実行 (mandatory 末尾発火、rules/15 独立 step) / chain-origin は drop (rules/25 gate)。
- `applyPickSkipAndContinuation(state, pending, runDeclinedAtom=false)`: sequence-origin decline は declined head atom を
  再実行せず remainder のみ実行 (declined 0-pick = 何もしない。head bind は unbound で後続 conditional が not-matched で正しく skip、
  単数 sceneEnter の `__declined` 未対応による pick 再 push を回避)。
- remainder の multi-step wrap も origin kind で行う (sequence に chain-gate を誤適用しない)。
- 触る engine: `resolve-picks.ts` (continuation 型) / `resolver.ts` (kind 付与) / `apply-pick.ts` (wrap + decline 分岐) / `useEngineDispatch.ts` (human decline 分岐)。**atom-handlers.ts は不変**。

### 水平展開 (blast radius)
決定論 scan で `sequence[0-pick(i<len-1), ...tail]` 該当 = **79 ability (distinct ~49)**。高 severity (mandatory tail が silent drop) に
**MVP D11014 a2 (→draw)** や draw/evidenceGain/mill 系多数。choice/optional-tail の 6 出荷カード (B04080/B07079/B07055/B07031) は
choice が initial walk で eager surface するため my fix の remainder-run は no-op (probe で double-run 無しを実証 = 回帰なし)。

### 解禁 / 残課題
- **B05028 解禁** (修正不要、誤診断) / **B09038 解禁** (修正で sequence mandatory draw が発火) → 後続バッチで card-wave 出荷。
- **B09056 は DEFER 継続**: 末尾が 2択 `choice`。choice-in-continuation の eager-surface (BUG-145 系) が fragile で
  `optional[seq[..,choice]]` 構造の正しさ未検証。choice surface 整備は別 engine 課題。

### 検証
- repro **5/5 GREEN** (chain decline=不発火 2 経路 / sequence[0-pick,draw] decline=draw 発火 RED→GREEN / choice-tail 安全 / AI control)。
- tsc clean (src+scripts) / **full vitest 2540 pass / 1 skip / 0 fail** / smoke:1000 baseline byte 同一 (winsA=498 avg=10.998 0 exception、AI 経路不変) / lint:* 8本 errors=0。
- spec: [.claude/specs/bug-111-human-decline-fix-design.md](../specs/bug-111-human-decline-fix-design.md) / [BUG-111.md](../bugs/BUG-111.md)。
