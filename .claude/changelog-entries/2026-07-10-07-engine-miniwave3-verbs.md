### engine mini-wave #3: 小粒 verb 3 種 — 3 printings + stale-DEFER 実測 2 件

- **engine additive**: 新 verb `handToDeckBottom` (手札→デッキ下、cardIds contract + short-form +
  shuffleThenDrawMoved composite = B05092「移し、シャッフルする。移した枚数と同じ数引く」の印字順) /
  `filePopToHand` n+gate (all-or-nothing、B03110) / `draw` n:{dyn} 対応。
- **consumer 3 printings**: B03110 / B03133 / B05092。B08057 は真 gap 継続 (filtered remove→bottom pick
  effect + moved-count gate)。
- **stale-DEFER 実測 2 件**: B03133 (handAddFromRemove multi は cluster6 出荷済) / B08057 の dest:'bottom'
  claim (defer-unlock 出荷済) — ただし B08057 は別 blocker 残で DEFER 継続。
- **probe agent が出荷前バグ 2 件検出** (short-form multi-pick collapse class): B03133 max:2 が 1 枚
  collapse / B05092 bind 不達で draw 恒常 0 → cardIds contract + atom 内蔵 composite へ修正して出荷。
  **walk-literalize latent** (初期 walk が plain atom の $bound dyn を bind 前に 0 literalize) を
  DEFERRED-INDEX に記録。
- gates: tsc 0 / vitest 4565→**4579** pass +1 skip / smoke winsA=472 不変 exc0 / 8 lint err0。
