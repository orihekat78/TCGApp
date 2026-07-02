# 2026-06-29 — ENGINE0 wave Tier A pilot (校正 + B09096 出荷)

## 成果
- **B09096 / B09096P キャンティ 出荷** (main 29ebc443、engine変更0)。G15 relative-AP filter
  `{apMin/apMax:{dyn:'$self.ap'}}`。probe 4/4 (SAME除去/DIFF残存/0候補/dyn-liveness override)。
  certify-yellow は cluster12 nested-filter-dyn 解禁前の stale (DEFERRED-INDEX L662 が 2026-06-28 既に訂正済)。
- **C04 untargetable 8枚 DEFER** (main 62eaf331、DEFERRED-INDEX): B01006/P B03030/P B03093 B05008/P B05048。
  「相手の能力や効果によって選ばれない」= untargetable-grant が engine 完全不在 (capability-map L607、grep 0)。

## 校正結果 (Tier A pilot)
- 211 ENGINE0 候補 × 既存 certify verdict(367) cross-ref: GREEN&未出荷=**3** / yellow=54 / no-certify=154 / shipped=0。
- 分類器(engine0-vs-extension TSV)は楽観: certify-yellow を ENGINE0 上書き = plan 警告通り。Tier A 10枚→真の engine0=2 printings。
- certify cache 両方向 stale: yellow が解禁済 gate で stale(B09096) / green が再走で yellow・refuted 化
  (B06026/B09022/B09056 を 16枚再 certify → 3 とも yellow/refuted、adversarial verify が楽観 green 捕捉)。
- ⚠ certify agent は main repo cwd を grep。main が stale branch だと過剰 yellow → **clean origin/main で再 certify 必須**。

## 次 vein
- collect-greens adopt 可能 = B09056/P(赤井秀一)のみ。但し choice[conditional,conditional] は今回 refute された
  B03056/B05062(conditional-surfacing gap)と近縁 → human-path probe 必須(次 session)。
- 残 154 no-certify(clean-ENGINE0 138)は clean origin/main で certify 要。

## プロセス
- 隔離 worktree(/c/tmp/wave-e0-tierA、off origin/main)で実装→FF push。node_modules junction +
  欠落 transitive dep(@jridgewell/sourcemap-codec, gen-mapping)を `npm i --no-save` で復元(vitest 起動可)。
- gate: engine-diff 0 / tsc 0 / full vitest 3330 pass / smoke winsA=498(baseline) / 8lint errors=0。
