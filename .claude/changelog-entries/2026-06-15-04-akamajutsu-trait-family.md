## 赤魔術 trait データ補完 + 赤魔術 family 実装 (engine変更0)

needsManual 5件 closure の調査を起点に、`赤魔術` が **構造化 trait としてデータに存在する**ことを公式 API で確認し
(従来 stale 結論「赤魔術 はどのカードにも無い」を是正)、trait を per-card 補完して family を解禁。

- **根本原因**: cards-data の TSV 抽出が **event/case の `category1/2/3` (= 特徴) を全件 drop** していた
  (event.tsv/case.tsv に features 列が無い、field-drop で BUG-124 同族)。一次 API (`_raw/*.json`) の
  `category` フィールドが特徴の正本で、`赤魔術` は B07055/B07058 (event)・B07062 (case) に実在。
- **データ補完 (per-card、骨格凍結維持)**: B07062/P に `caseTraits:['まじっく快斗','赤魔術']`、
  B07055/P・B07058/P に `traits:['赤魔術']` を投入 (D08026 caseTraits と同流儀の手書き)。
- **needsManual 5件 closure**: B06101/B08020/B09008/D10011 は既に出荷済 (公式テキスト⇔DSL 1対1突合で
  全て意味等価を確認)。残る B07052 は data-gate (赤魔術 trait 不在) で defer されていたが、本補完で解禁し実装。
- **解禁カード (5枚)**:
  - **B07052 ルシュファー** (char): a1=`caseTraitConditioned(赤魔術)` の continuous grantKeywords['突撃']
    (事件が赤魔術を持つ間のみ突撃) / a2=forced reveal-until `filter:{trait:'赤魔術',kind:'event'}` → 手札 →
    残りデッキ下 → シャッフル (B05017 a1 同型)。
  - **B07055/P 紅の盟約** (event): and[caseTrait赤魔術, partnerColor白] + clause1 sceneRemove apMax8000 +
    clause2 `optional{chain[charRemoveSetCard n:2, sceneRemove apMax6000]}`。
  - **B07058/P 「私が…」** (event): caseTrait赤魔術 + sceneEnter(remove,白L3,bind:$entered) →
    conditional → entered へ charModifyAP+3000(turn)/charGrantKeyword('突撃[キャラ]',turn)/charSetCard(fromDeckTop)。
- **発見した engine 契約 (test で実証)**: PA短縮形 pick の **強制ちょうど N 枚は `n:N` (number)**。
  `n:{min,max}` (object) は `hasNorMax` (number 判定) を通らず pick 未生成 → 無音 0枚。B07055 clause2「合わせて2枚」
  は `n:2` で実装 (当初 `n:{min:2,max:2}` で 0枚除去になり test で検出 → 修正)。
- **gate**: tsc / validate-specs 73-0 (engine変更0) / full vitest **2160** (+12 専用 test) /
  smoke:1000 = baseline 不変 (winsA=498) / playwright 119。ALL_CARDS 1166→**1171**。
- 専用 test `tests/cards/akamajutsu-trait-family.test.ts` (12件): trait 補完 / B07052 a1 caseTrait突撃 gate
  (赤魔術事件→突撃 / 非赤魔術→無) ・a2 reveal-until (赤魔術event を手札 / 不在で全公開) / B07055 forced-2
  (set 2枚除去+bonus / 0枚で chain break) / B07058 reanimate chain (AP+3000・突撃[キャラ]・set 1枚)。
- **known-gap (記録のみ)**: (1) TSV 抽出の event/case category-drop は赤魔術以外の【事件特徴】/event-trait filter
  にも波及する latent (DEFERRED-INDEX)。(2) charRemoveSetCard `n:N` は候補<N 時に available へ clamp する
  (「合わせて2枚」を 1枚しか持たず opt-in した場合の挙動は公式 Q&A 未裁定)。
