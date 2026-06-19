# カード追加 wave — declared+cost / enter-observer (engine 変更 0、3枚)

**Round/Phase**: 2026-06-19 カード追加 wave 継続。次 wave 候補 B07066 / PR194 / B08075 を
recon → certify (opus grounding→敵対的 verify) → self-review 全句突合で出荷判定。3枚出荷・1族 DEFER。

## 追加カード (3枚、ALL_CARDS 1354 → 1357)

- **B07066 / B07066P 赤井秀一** (赤 L8 AP7000 LP2 FBI|赤井家、SR/SRP):
  - a1【自分ターン中】【ターン1】自分の現場にレベル7以下の〚特徴［赤井家］〛のキャラが登場したとき、
    AP8000以下のキャラを1枚まで選び、リムーブする。= **enter-observer**
    `trigger{hook:'enter', matcherCondition:triggerCharMatches{side:'self', payloadKey:'uid', filter:{trait:赤井家,levelMax:7}}}`
    (NOT selfOnly) + `condition turn:self` + `limit turn1` + `sceneRemove{apMax:8000,max:1,side:either}`。**B04017 完全同型**。
    自身 Lv8 → self-enter は levelMax:7 で自然除外。
  - a2【宣言】【ターン1】〚このキャラか特徴［赤井家］のキャラを1枚スリープ〛: 上から3枚見て赤井家キャラを
    1枚まで手札→残りデッキ下→加えたら手札1リムーブ。cost `sleepChar{pick scene self filter:{trait:赤井家}}`
    (自身が赤井家 = self 包含、B05018/B09082 同型) + deck-look `{maxN:3, chooseMatch:'upTo', filter:{kind:character,trait:赤井家}}`
    → conditional handAdd → deckToBottomBound → conditional discard1 (B05078 同型)。
- **PR194 灰原哀** (青 L2 AP1000 LP1 少年探偵団|科学者、PR):
  - a1【宣言】〚リムーブエリアに移す〛: 上から2枚見てカードを1枚手札に加え、残りをデッキの下に移す。
    cost `removeFromScene{target:{kind:self}}` (B05018「リムーブエリアに移す:」完全同型) +
    deck-look `{maxN:2, filter 省略}` (= match-all = forced first-match = top) → handAdd → deckToBottomBound。**B01048 同型**。
    filter フィールド省略で pure-JSON (`targetFilterToPredicate(undefined) === () => true`)。

## DEFER: B08075 ブライダルは女が主役 (event)「以下から3つまで選んで行う(上から順)」

certify は green を返したが **codegen 前の self-review 全句突合で false-green を検出 → DEFER**。
certify spec は bare `sequence[opt1,opt2,opt3]` (各 option 内部の 0-pick を「選ばない」相当とみなす) で表現したが、
**opt3 (デッキ4枚見て…残りをデッキ下) は 0-take でも top4→bottom の deck 並べ替え副作用がある**。
よって「opt3 を選ばない (deck 不変)」と「opt3 を実行して 0-take (deck scramble)」は非等価 = opt3 が **unskippable**
(fatal、敵対 verifier も見落とした近似)。正しい model = `sequence[optional{opt1},optional{opt2},optional{opt3}]` だが
(a) subset-of-options は本カードが唯一で前例なし、(b) CPU は optional を全 skip = event 完全 no-op、
(c) optional+pick 合成は B09056 系 choice-surface gap の既知 fragility。→ DEFER (proper multi-select-options
engine 機構 or optional+pick 合成の検証後に再訪)。opt2 charGrantKeyword 短縮形 pick は Task D E0 で実装済 = 問題は opt3 のみ。

## 検証

- engine 変更 0 (validate-specs pass = カード + `_reuse/index.ts` + テストのみ)。tsc clean。
- 新規 `tests/cards/wave-declared-cost.test.ts` 13 件: a1 matcherCondition を `evalCond` 直で 1対1
  (自分側 赤井家 L7→true / 赤井家 L8→false (levelMax) / 探偵 L7→false (trait) / 相手側 赤井家→false (side))、
  a1 effect の apMax:8000 decoy (AP9000 必ず残存)、a2 deck-look の kind+trait decoy (赤井家 char→手札 / 赤井家 event→
  kind 違反 / 警察 char→trait 違反)、PR194 の forced-top decoy、descriptor pin。
- full vitest 2686 (+13、回帰 0)。smoke:1000 exceptions=0 / baseline 不変 (avg=11 winsA=498)。
- e2e 回帰 121 passed・1 skip (flake なし)。certify (opus) 3/3 green + verifyOk。
- 非 MVP カード (ct-p07 / pr-01) は MVP deck (CT-D08/D11) に不在 = 実機盤面に出ないため playwright per-card 不適用。
  decoy unit test が実 engine 効果解決経路 (`runEffect`/`evalCond`/drainPicks) を駆動 = BUG-117/118 の
  「engine が filter を実評価する」証跡。

## 学び (恒久)

- **certify GREEN + verify-ok でも codegen 前に shipped exemplar と全句突合必須**。B08075 の bare-sequence は
  「0-pick = 選ばない」近似で deck-reorder 副作用を取りこぼし、敵対 verifier も見落とした。
- enter-observer (「別のキャラが登場したとき」) = `triggerCharMatches{side, payloadKey:'uid', filter}` (NOT selfOnly)。
  enter payload は player を持たないため payloadKey:'uid' 必須、side は scene-scan で導出。
- filterless mandatory-1 deck-look = filter 省略 → forced first-match (=top)。骨格凍結下では engine の唯一の handling
  (chooseMatch は 'upTo' のみ = 0枚可)。player の「N枚から選択」は失うが B01048 既出荷の近似と consistent。
