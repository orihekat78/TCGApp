# cluster16 G2 follow-up — 桃井恵子 (B07051) 出荷 (deckReveal filterAny)

**Round/Phase**: 2026-06-18 cluster16 G2 fast follow-up (`cards/wave2-cluster16-momoi-b07051`)。
セッション⑲ の残 follow-up として残った B07051 を certify→出荷。

## 出荷 1枚 (ALL_CARDS 1341→1342、engine 変更 0)

| rep | 内容 |
|---|---|
| **B07051** (桃井恵子、白/Lv4/AP4000/LP1/特徴[高校生]) | a1 = `【宣言】【スリープ】：デッキ上1枚公開。〚カード名[怪盗キッド]〛か〚特徴[高校生]〛のキャラなら手札、それ以外はデッキ下` |

## certify: 出荷済 B03016 の文字単位 twin

- B07051 は出荷済 **B03016 円谷光彦** と **文字単位で同型**。leaf literal 2 箇所のみ差替:
  - cardName `阿笠博士` → `怪盗キッド` (同 pkg B07035 で実出荷済の literal)
  - trait `少年探偵団` → `高校生` (本カード自身の特徴。多数の出荷カードで使用)
- DSL 構造は B03016 a1 と byte-identical: `deckRevealUntil{maxN:1, filterAny:[{cardName,kind:'character'},{trait,kind:'character'}], bind:'$revealed', bindMatch:'$matched'}`
  → `conditional(bound $matched matched)→handAddFromDeck` → `deckToBottomBound($revealed)`。
- 「…のキャラの場合」= 両 OR 枝に `kind:'character'` (event は非該当)。chooseMatch 無し = forced (「〜する」必須, rules/15)。

## 検証

- **専用 gate5 テスト 9 pass** (`tests/cards/B07051-momoi-deckreveal.test.ts`): filter 実評価を outcome で 1対1 証明
  (怪盗キッド名/高校生特徴/split-name複合名 → 手札 ✓ / 怪盗キッド*event*・高校生*event* (kind違反)・探偵character (両枝非該当) → デッキ下 ✓) +
  非match top の only-top-1 reveal pin + cost sleepSelf 検証 + descriptor pin。
- **敵対的 certify (opus 1 lens)**: B03016 との diff が意図した2 leaf swap のみであること・kind:character 強制・mutual exclusion ($revealed/$matched split)・
  quantifier 必須・refresh は engine 層 out-of-scope を独立検証 → **equivalent:true / ship:true / blocker 0**。
- tsc EXIT0 / vitest 全 pass (5222、baseline 減なし) / smoke baseline **winsA=498 不変・0 exception** / **engine変更0**。
- playwright は非MVPカードのため gate5 vitest で「画面処理=テキスト文言」を代替 (cluster15/16/⑲ と同方針)。
