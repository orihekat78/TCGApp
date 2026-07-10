---
date: 2026-07-10
type: feat
scope: cards
title: P-spread sweep 39 printings — base 出荷済 + TSV 全列同文の slim clone 一括 + 完了 roadmap 起票
---

残 325 printings の機械 inventory (corpus − shipped − hybrid pool DEFER) で
「base 出荷済 + TSV 全列同文の未 spread P variant 40 枚」の滞留を発見 → 新設
`scripts/gen-p-spread.cjs` (全列同文 機械証明: id/rarity 除く corpus 全 field 一致、
features 区切り揺れ [|,] は集合比較で正規化) で **39 printings** を slim clone
(`{...BASE, id, no, imageUrl, rarity}`、B01009P 正準形) 一括生成 + _reuse 登録。
B05086P のみ実データ差 (base に特徴[公安] 有/P に無) で保守的除外。
Track B G1 gate が B02076P の composition-mismatch を検出 → exceptions.json に
base B02076 と同根 entry 追加 (B09090P 前例)。T0 規約: crosscheck は base 出荷時の
証明を全列同文が推移 (決定表 diff 代替)。gates: tsc0 / vitest 4605+1skip /
smoke 472 exceptions0 baseline OK / 8 lint err0。shipped **1749→1788**、残 286。
併せて 10-15 session 完了計画 [completion-roadmap-2026-07-10.md](../specs/completion-roadmap-2026-07-10.md)
を起票 (在庫の真実: 実作業 163 unit / ride-along P 108 / spread 済 40)。
