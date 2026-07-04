# CARD PHASE step12 batch3 — B06085 touch-up + compiler T0/T1 harvest 22枚 (2026-07-04)

- **B06085 松田陣平 出荷** (DEFER 筆頭解消): engine touch-up = `evidenceGain` atom に `faceUp` arg 1-arg 素通し
  (atom-handlers/core.ts、既定 false 不変)。a1 =【宣言】sequence[evidenceToDeckBottom (B03084同型) →
  sceneToEvidence 短縮形 apMax8000 bind→ conditional boundIsMr→evidenceGain{opp,1,faceUp}] / a2 = ヒラメキ sleep
  (PR144 同型)。probe 8件 (production dispatch 経路、MR① redirect→相手PA + bonus gain 実測込)。
- **compiler T0/T1 batch 21枚 一括出荷** (Track B B4 param-compilable 刈り取り):
  - **P/P2 parallel 7枚 = spread 生成** (B02088P/B03046P/B08014P/B09004P/B09070P/B09090P/B09090P2)。
    compiler 経由にしない裁定: B09090 base が closure matcher 持ち = compile 再現不能で、param rule が
    別 exemplar 由来の異形 DSL を生成 (挙動同値だが base と乖離)。spread は挙動同一を構造保証。
  - **同文 twin 裏取り済 8枚** (D10006→D10005 / PR281→D08003 / PR282→D09004 / PR283→D09008 /
    PR293・PR299→B03119 / PR301→B03123 / PR303→B09045): compile 出力が shipped twin と canonical
    deep-equal (決定論 diff、id/description 除外)。
  - **NO_TWIN 6枚 = T1 lens 通過** (B04093 コルン inContact / PR029・PR033 白鳥 cutin:used observer /
    PR286 ハイウェイの堕天使 case setShippuWaive / PR294・PR300 怪盗キッド cutin): sonnet5 意味等価 lens。
  - **PR302 (vanilla case) は DEFER**: REUSE_CARDS 規約 (abilities>0) 対象外 → gen-simple-cards rerun 管轄。
- **compiler 修正 2点** (Track B lane 持ち帰り分):
  - productions.cjs: exact line rule の emit に description 転記追加 (mine.cjs:130 の約束が未実装だった gap。
    validate-specs「missing description」で顕在化)。
  - exceptions.json: B09090P/B09090P2 追加 (G1 oracle が spread 登録後に非再現検出 → 恒久 refuse)。
- **BUG-174 修正 (骨格バグ修正 exception)**: PA 短縮形の side 引数に絶対 player を渡す二重相対化 —
  sidesForQuery は query.side を owner 相対解釈するため owner='opp' (CPU 所有) で対象 side が反転し
  自陣を「相手」として pick していた (char.ts 4 site + scene.ts 5 site 一括修正、side='either' 固定
  site は対称で影響なし)。**混成 lens 割れ (sonnet BLOCK / opus SHIP) を probe 実測で裁定** — sonnet の
  runtime 再現が正。W3 混成 review が「現出荷カード未踏」と latent 記録していた既知 gap の顕在化。
  owner='self' では恒等 → 既存挙動不変 (smoke 同値で証跡)。owner='opp' pin test 収録。
- 検証: vitest 4140+1skip (batch3 probe +9、BUG-174 pin 込) / smoke winsA=472 不変 exceptions=0 /
  8 lint err0 / crosscheck 14/14 / validate-specs 14/14 / tsc 0。playwright は tier 規約
  (T3/新UI部品型のみ) 対象外 — 全カード shipped exemplar family の clone で決定表 diff 代替。
