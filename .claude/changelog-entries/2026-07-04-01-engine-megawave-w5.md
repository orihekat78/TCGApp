# engine mega-wave W5 — dyn/cost 3 primitive + exemplar 5 printings

- **統合 `$bound.<key>.<field>` dyn root (r38+r47 共有、dyn/eval.ts resolveBound)**: bind 済み
  Candidate 集合の遅延参照。`count` = 集合枚数 / `level` = 先頭要素の実効レベル (uid=board char →
  charRead.level、B09109 QA1「解決時点の増減後を参照」/ cardId のみ=souza 等 deck bound → printed) /
  `cardName` = 先頭要素のカード名 (uid=実効 names 先頭)。欠損 binding は defensive (0/NaN/'')。
  併せて `resolveDynNumber`/`isDynObject` を dyn/eval.ts に export (cost 層から使うため
  _shared.ts でなくここ — 層違反 import 回避。resolveDeltaToNumber は非改変)。
- **r38 atomEvidenceFlip multi (cardIds 契約) + bind writeback + dyn-max** (B08028 日向幸
  「自分の裏向きの証拠を好きな数選び、表向きにする。この効果によって表向きにした枚数と同じ数まで
  相手の裏向きの証拠を選び、表向きにする」): evidenceFlipDown の①②path を faceDown/flipFaceUp 版で
  clone + 実 flip 分のみ bind + `max:{dyn:'$bound.$flipped.count'}` を handler local で literalize
  (共有 helper hasNorMax/buildShortFormPick は byte 不変 = footgun 封じ込め)。resolved max≤0 は
  pick を出さず no-op。`__declined` は空 bind 書込 (mirror step が正しく 0)。human 経路
  (applyPickAndContinuation) で mirror-count nMax 貫通を実測 pin。
- **r47 TargetFilter `levelIn`+`levelInBound` + atomDeckRevealUntil dispatch-time dyn filter**
  (B04074/P 降谷零 = chain[conditional{bond 風見裕也 → 捜査4/捜査2, bind '$found'},
  sceneRemove levelInBound]): levelInBound は enumerateByQuery が bound 集合の printed level を
  levelIn へ literalize (matchOneFilter は ctx 非依存維持、~20 call site 不変)。levelIn は実効
  level 判定。deckRevealUntil は filter 内 {dyn} を dispatch 時に解決 (resolveFilterDynObj export、
  B09109 a1「そのキャラと同じレベルで同じカード名が出るまで」idiom を probe 実証 — **B09109 card は
  a2 P12 charSetName 不在で DEFER**)。
- **r37 Cost `removeDeckTop.n: number|{dyn}`** (B04088/P スコッチ〚相手の現場にいるキャラ1枚につき、
  デッキのカードを上から2枚リムーブする〛= `{dyn:'$self.oppSceneCount*2'}`): canPay/pay が
  resolveDynNumber で解決 (deck 不足=使用不可・n=0=vacuous true、公式Q&A 2件と整合)。
  costToText に optional resolve 引数 (confirm modal で実数表示、未渡しは汎用文言)。
- **r43 self-latch (B08059) は DEFER** — 設計 workflow 自身が推奨 (T3 / sole 1枚 / touched 6+)。
- probe: tests/cards/engine-megaw5-dyn-cost.test.ts +35 (human/AI/decline 3経路 + mirror-count 上限 +
  chain-vs-sequence negative control pin + 固定 n 回帰)。exemplar B08028/B04074/B04074P/B04088/B04088P。
