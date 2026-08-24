# condition カタログ (カード実装早見表)

`condition:`(能力ゲート) / `conditional{if}`(効果内分岐) / `trigger.matcherCondition`(triggered 発火ゲート) で使う `Condition.kind` の1行スニペット集。

型の権威は [engine-api-conditions.md](engine-api-conditions.md)。評価実装は `src/engine/cond/eval.ts` (`evalCond`)。本書は使う側の早見表。

## ability.condition / conditional.if 用 kind

| 公式 / 用途 | snippet | 例 |
| --- | --- | --- |
| 常に真/偽 | `{ kind:'true' }` / `{ kind:'false' }` | — |
| 論理結合 | `{ kind:'and', cs:[...] }` / `{ kind:'or', cs:[...] }` / `{ kind:'not', c:... }` | D11019 / D11021 |
| 【自分/相手ターン中】 | `{ kind:'turn', player:'self' }` | D11016 |
| 【パートナー(色)】 | `{ kind:'partnerColor', color:'青' }` | D08003 |
| 【事件(色)】 | `{ kind:'caseColor', color:'青', combine?:'and' }` | — |
| 【事件(特徴)】 | `{ kind:'caseTrait', trait:'婚活パーティー' }` | D11003 (factory) |
| 【FILE(X)】 | `{ kind:'fileAtLeast', n:7 }` | — |
| 【事件編/解決編】 | `{ kind:'caseStatus', status:'解決編' }` | D08019 / D08026 ⚠ |
| 【絆(名)】 | `{ kind:'bond', cardName:'工藤新一' }` | — |
| 現場にXがいる場合 | `{ kind:'sceneHas', query:{ area:'scene', side:'self', filter:{trait:'警察'} }, nMin:1 }` | D08003 |
| AP/LP が X以上 | `{ kind:'apAtLeast', ref:{kind:'self'}, n:6000 }` / `lpAtLeast` | — |
| 証拠X以上 | `{ kind:'evidenceAtLeast', player:'self', n:6 }` | D11015 |
| FILE 最上面が種別X | `{ kind:'fileTopType', type:'character' }` | — |
| 重ね数X以上 | `{ kind:'stackedCountAtLeast', ref:{kind:'self'}, n:3 }` | D08021 |
| リムーブに色X以上 | `{ kind:'removeColorAtLeast', player:'self', color:'黄', n:20 }` | D11019 |
| リムーブに特徴X以上 | `{ kind:'removeTraitAtLeast', player:'self', trait:'神奈川県警', n:3 }` | D11020 |
| リムーブに名X以上 | `{ kind:'removeNameAtLeast', player:'self', cardName:'…', n:1 }` | — |
| 痕跡[発見済/未] | `{ kind:'scratchTrace', player:'self', v:true }` | — |
| turnState フラグ | `{ kind:'flag', player:'self', key:'…', v:true }` | — |
| 宣言回数 X未満 | `{ kind:'declaredUseUnder', uid:'…', abilityId:'a1', max:1 }` | — |
| bind 有無 | `{ kind:'bound', key:'$matched', presence:'matched' }` | D11019 |
| bind が filter 一致 | `{ kind:'boundMatchesFilter', bindKey:'$entered', filter:{cardName:'萩原千速'} }` | D11014 |
| 独自条件 (最終手段) | `{ kind:'custom', check:(s,ctx)=>… }` | D11013 |
| カットイン相手が名/特徴/色一致 | `contactTargetMatches({names?,traits?,colors?})` (cards/_shared, custom 包み) | B06041/B06092/B07009/PR087 |
| 事件が指定色の単色 | `caseMonoColor(color)` (cards/_shared, not+caseColor) | B05010/B05036/B05070 |

## trigger.matcherCondition 用 kind (triggered 発火ゲート)

⚠ `trigger.matcher` の closure は `(payload, state)` のみで **`card.uid` を参照不可**。
「自分が当事者か」「このターンN番目か」を判定するなら closure でなく下記 matcherCondition を使う (ctx.source.uid / 正しい payload フィールドを見る):

| 公式 | snippet | 例 |
| --- | --- | --- |
| 【疾風 N】(このターンN番目に登場) | `{ kind:'enterOrderEquals', n:1 }` | D11014 ✅ (D11003/D11009 は誤、後述) |
| このキャラがガードしたとき | `{ kind:'guardedBySelf' }` | D11016 |
| 自分が高APとコンタクト時 | `{ kind:'contactOpponentApHigher' }` | D11007 |

## 使い分け

- 能力全体を ON/OFF → `condition:`（不成立なら rules/17 で「能力を持たない」扱い）。
- 効果列の途中分岐 → `conditional{ if, then, else? }`。
- triggered 発火条件 → `trigger.matcherCondition`（closure matcher より優先、自己照合可能）。
- 「してもよい / そうした場合」連鎖 → `chain` + step1 `max:1`。⚠ binding/除去結果に依存する後段条件は **`sequence` でなく `chain`**（sequence は pick で pause せず未解決盤面で評価する）。

## ⚠ 既知の enforcement gap (2026-06-03 MVP Lens F 監査、要修正)

| gap | 影響カード | 対処 |
| --- | --- | --- |
| **declared ability の `condition` が engine 未評価** (canDeclaredAbility は対象存在+limit のみ判定、condition を evalCond しない) | D08026 a2 / D11003 a2 / D11021 a2 の【解決編】等が未 gate で宣言可能 | engine 修正待ち (triggered は発火 gate 済、declared が未配線) |
| 疾風 を closure matcher で **累積 `enterOrder`** 判定 (turn-local `enterOrderThisTurn` が正) | D11003 a1 / D11009 a2 が現場残存キャラで誤判定 | `matcherCondition:{kind:'enterOrderEquals',n}` に置換 (D11014 が正) |
| `sequence` が pick で pause しない | D08024 a1 / D11014 a2 / D11020 a1 の後段条件が pick 前盤面で評価 | binding/除去依存は `chain` に |

## 新 condition 追加手順 (3点同時)

1. `src/engine/cond/eval.ts` に kind + 評価実装。
2. [engine-api-conditions.md](engine-api-conditions.md) の型に追記。
3. 本カタログに行追加（snippet + 例）。

## 関連

- [engine-api-conditions.md](engine-api-conditions.md) — `Condition` 型の権威ソース
- [card-authoring-convention.md](card-authoring-convention.md) — カード実装コーディング規約
