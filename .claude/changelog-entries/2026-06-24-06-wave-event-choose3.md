# cards — wave event-choose3 (B08075/B08075P、engine変更0)

**Round/Phase**: 2026-06-24 カード追加 wave (engine変更0)。novel-template green候補を classify workflow で
仕分け → 実 engine 型を直読して false-green を排除 → 真に出荷可能な 1 rep (+P) を手書き出荷。

## 出荷 (ALL_CARDS +2、engine変更0)

- **B08075 / B08075P ブライダルは女が主役** (黄 lv5 event): 「以下から3つまで選んで行う（上から順に）」=
  `triggered scope:on-hand trigger{effect:declared, selfOnly, matcher kind==='event-use'}` (exemplar B08029) →
  `seq[optional①, optional②, optional③]`。
  - ① 〚佐藤美和子〛1枚まで→active = `sceneSetState{uid:$pick, state:active, target pick scene/self cardName n{0,1}}` (B06060/D04010)
  - ② 〚高木渉〛1枚まで→ターン終了まで〚突撃[キャラ]〛 = `charGrantKeyword{uid:$pick, kw:'突撃[キャラ]', scope:turn, target pick}` (D02013/D09027)
  - ③ デッキ上4枚→〚佐藤美和子/高木渉〛1枚まで手札, 残りデッキ下 = `deckRevealUntil{upTo, filterAny[2名 kind:character], maxN:4, bind/$matched}` → `conditional(bound $matched → handAddFromDeck)` → `deckToBottomBound` (B08020 / filterAny B03016・B07020)
  - **各 option を `optional` 包装** (B09065)。③は take-0 でも deck 並び替えの副作用 → option 単位 skip 必須 (「3つまで選んで」忠実)。

## 候補仕分け (classify workflow + engine 型直読)

- 残 green候補を full-text 棚卸 → **127 novel rep** (既出荷の絵柄違いクローンは 0 = easy twins 枯渇)。
- classify workflow (7 scout, opus high) で 38 rep 仕分け (session limit で 5 agent 中断、GREEN 9/GATED 21/RISKY 8)。
- GREEN 9 のうち **7 を engine 型直読で reject** (classify agent の false-green を排除):
  - `ContinuousModifier` に **level field 無し** (apDelta/lpDelta/grantKeywords のみ) → B08059/B08050 の継続「レベル+N」は GATED。
  - **「1 pick → 2 atom(同キャラ)」の carrier-reuse exemplar 0件** (BUG-130 由来の bind 脆弱性) → B08023/B08033 (set+buff 同一 pick) DEFER。
  - **stun cost kind 無し** (sleepChar のみ) → B08004 の cost「スタンさせる」GATED。加えて B08004 は errata (2026-03-02 現場条件追記) リスク。
  - B08019: `scope` 単値で `on-scene`+`on-partner-area` 併記不可 (非MR char は partner-area 不達=under-faithful) + 「&」名/cutin → DEFER。
  - B08092/B09004: classify agent が「exemplar=自身(出荷済)」と循環誤認 (実際は未出荷、reveal-trigger/【現場リムーブ時】filter 依存) → reject。

## 検証 (engine変更0 ゲート)

- **engine変更0 証跡**: `git diff src/engine` 空 (手書きカードのため validate-specs 非対象、git diff で機械保証)。touched = src/cards のみ。
- `tsc` 0 / `vitest` 全 green (+構造忠実 decoy test 2、本 wave) / `smoke:1000` winsA=498 exceptions=0 baseline OK / eslint・lint 群 0err。
- decoy test: event-use matcher 実評価 (event-use→true / declared・undefined→false) + 3-optional 構造 + filterAny 2名 + B08075P=B08075 ability 一致 (matcher 除く骨格)。
- ※ B08075 は MVP デッキ外で smoke 非経由 → runtime は matcher 評価 + atom 各 exemplar の既存テストで担保 (BUG-132 教訓)。

## DEFER 追記

- DEFERRED-INDEX へ: 継続レベル修正 (continuousModifier level 不在) / 1pick→2atom carrier-reuse / stun-cost の 3 engine gate を記録予定。
