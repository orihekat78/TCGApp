# カード実装 engine ゲート早見表 (frozen engine 検証済)

2026-06-04 pilot で実コードから検証した「**できないこと**」一覧。
catalog-reuse 分類 (`reusable/blocked`) は **超過大評価** と判明 — このゲートで再分類が必要。
出典: `src/engine/cond/eval.ts` / `effect/atom-handlers.ts` / `effect/validate.ts` /
`listeners/triggered.ts` / `target/candidates.ts` / `flow/main/hand-use-card.ts`。

## DEFER トリガ (1節でも該当 → そのカードは実装不可・DEFER)

### トリガ hook が無い
- 【現場リムーブ時】/ leave / 「リムーブされたとき」(味方/相手キャラ) — card-triggerable hook 無し (`leave:*` は internal)
- 「推理したとき」を **別カードが** 反応 — reasoning hook 無し (`reasoning:before-add` は misread 専用)
- 状態変化 active↔sleep を trigger に — `state:change` は internal、card 不可
- card-triggerable hook は **9個のみ**: enter / effect:declared / action:pre-target / action:declare /
  action:guarded / contact:start / case:to-resolved / phase:end:start / evidence:remove-by-action(ヒラメキ) + icon-misread

### condition が無い (declarative)
- 手札枚数 (手札N枚以下/以上) — 専用 condition 無し (custom{} TS のみ)
- リムーブエリア **総枚数** ≥N — color/trait/name 別はあるが総数は無し (custom{} のみ)
- 登場手段の **source レベル** (「レベル3以上の…効果によって登場」) — enter payload は viaEffect/順序のみ、source level 非公開

### verb / 効果が無い or stub
- **イベント自身を証拠にする** (「このカードを表向きのまま証拠として得る」) — event は必ずリムーブ行き。remove/hand→evidence verb 無し
- `charSetAP` / `charSetLP` (元のAP/LPを **N** に / レベル±N) — throw stub。`charOverrideAP/LP`(=0等)のみ可
- continuous で **他キャラを** buff (aura) — continuousModifier は **owner($self) 専用**。「現場の特徴Xを全員AP+N」「別名キャラをAP+N」不可
- dyn: パートナーエリア特徴数の per-card scaling 無し (`$self.sceneTrait.<trait>` は現場のみ、`$self.faceUpEvidence` 等)
- **カットイン保持** で filter (「カットインを持つ黒のカード」) — cutin は ability であり `keywords:[]`。`filter.keyword:'カットイン'` は不一致
- 非キーワード能力テキストの付与 (「『スリープでもガード可』を持つ」) — keyword/expandActionTargets 以外不可
- **パートナーエリアの「特定カード(特徴[ビッグジュエル]等)」参照** — sceneHas(area:'partner-area') は `partner.cardId` 本体しか見ない (GameState に追加 partner-area カード枠なし)。ビッグジュエルは trait 保持カードも存在しない → 永久に発火不能 → DEFER (2026-06-05 B07045 で実機検出)。教訓: code path が在る (area 受理) だけでは不十分、semantics を実機確認せよ。
- **イベントの「特徴」参照** (「特徴[YAIBA]のイベント使用時」等) — data 上 **全イベントが traits:[]** (イベントに特徴情報なし)。trait matcher 永久不発火 → DEFER (2026-06-05 0678 で検出)。イベントの **色** は有るので色 matcher は可 (B07016 で実機検証済)。

## 実装OK 追加検証済パターン (2026-06-05 実機)
- **effect:declared 他イベント反応** (非selfOnly + matcher `engine.cards.get(payload.cardId).colors.includes(色)`): 「自分が色Xのイベント使用時→効果」。B07016 で実機検証 (緑発火/白不発火)。payload=`{kind:'event-use'|'character-use', cardId}`。
- **forEach over:{kind:'all'} + `uid:'$each.uid'`**: 「すべて/全員」一回効果 (全体 sleep/stun 等)。B06071/B02032 で実機検証。`$each` 単体は不可・`.uid` 必須。`over:pick` は throw (player 選択は不可、'all'/'fromBound'/'self' のみ)。
- **自己リムーブ (cost & effect)**: cost=`pay[sleepSelf, removeFromScene{target:{kind:'self'}}]` (【スリープ】〚リムーブエリアに移す〛, B03055/B07007); effect 先頭で `sceneRemove{uid:'$self'}` しても rules/15 で後続 effect 継続 (B03114 で実機検証)。
- matcher/custom filter から `engine.cards.get(cardId)` で任意カード def 参照可 (B02010)。declared の cost は move-enumerator が `canPay` で gate (raw dispatch は迂回)。
- 「上からN枚見て選ぶ」(look-top-N-select) / untargetable(選ばれない) / 手札以外起点の登場 / 任意複数をデッキ下へ
- 可変枚数「好きな枚数」discard→同数 draw — 可変 count atom 無し
- optional 自己犠牲「このキャラをリムーブしてもよい。そうした場合〜」 — atom に `optional` flag 無し・参照実装無し (※ 非optionalの自己リムーブ effect は B03114 で可)
- **multi-target player-pick で各々に per-char 効果**「N枚まで選び、(各)AP±/リムーブ/スリープ/元のAP0」 — apply-pick.ts Pattern A(`uid:'$pick'`)は **単一 pickedUid のみ適用**(pickedUids 無視)、multi 適用は cardIds 系 atom(charStackCard)のみ、forEach over:pick は throw → 0191/0528 DEFER (2026-06-05検証)。例外: 「すべて/全員」(選択無)=forEach over:all 可 / 「N枚まで重ねる」=charStackCard multi可(D08021)。
- discard した札を inspect (「リムーブしたカードが特徴Xの場合」) — discard に bind 無し

## 実装 OK の検証済パターン (参照ファイル)
- enter chain (任意 discard by trait/color/level → 効果) : `D08003.ts` a1 (chain no-apply-break=「そうした場合」)
- 条件付き enter (sceneHas/caseStatus → 効果) : `D08019.ts` a1 / `B07021.ts` a2
- phase:end:start + conditional (turn:self + sceneHas → draw / sceneRemove($self) / sceneSetState($self)) : `D08003.ts` a2 / `B07021.ts` a1
- continuous 自己 AP/LP (dyn `$self.sceneTrait.<trait>` 等) : `D08005.ts` / `D08007.ts`
- continuous キーワード付与 : `D08021.ts` ; ミスリード : `misreadX()` ; カットイン AP+ : `D02012.ts`
- ヒラメキ (draw / char-pick) : `D08013.ts` a2 / `D08019.ts` a2 ; 宣言+コスト : `D08026.ts` a2
- sceneHas は `query.area:'partner-area'` も可 (candidates 対応) ; caseStatus(事件編/解決編) gate 可

## 関連
- [DEFERRED-INDEX.md](DEFERRED-INDEX.md) / [card-condition-catalog.md](card-condition-catalog.md)
- pilot session: [.claude/sessions/2026-06-04-pilot-impl.md](../sessions/2026-06-04-pilot-impl.md)
