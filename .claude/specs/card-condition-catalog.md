# condition カタログ (カード実装早見表)

`condition:`(能力ゲート) / `conditional{if}`(効果内分岐) で使う `Condition.kind` の1行スニペット集。

型の権威は [engine-api-conditions.md](engine-api-conditions.md)。本書は使う側の早見表。

## アイコン / 文言 → kind

| 公式 | snippet | 例 |
|---|---|---|
| 【自分/相手ターン中】 | `{ kind:'turn', player:'self' }` | D11016 |
| 【パートナー(色)】 | `{ kind:'partnerColor', color:'青' }` | D08003 |
| 【事件(色)】 | `{ kind:'caseColor', color:'青' }` | — |
| 【事件(特徴)】 | `{ kind:'caseTrait', trait:'婚活' }` | D11003 (factory) |
| 【FILE(X)】 | `{ kind:'fileAtLeast', n:7 }` | — |
| 【事件編/解決編】 | `{ kind:'caseStatus', status:'解決編' }` | D08019 / D08026 |
| 【絆(名)】 | `{ kind:'bond', cardName:'工藤新一' }` | — |
| 現場にXがいる場合 | `{ kind:'sceneHas', query:{ area:'scene', side:'self', filter:{ trait:'少年探偵団' } }, nMin:1 }` | D08003 |
| 重ね数X以上 | `{ kind:'stackedCountAtLeast', ref:{ kind:'self' }, n:3 }` | D08021 |
| リムーブに色X以上 | `{ kind:'removeColorAtLeast', player:'self', color:'黄', n:20 }` | D11019 |
| リムーブに特徴X以上 | `{ kind:'removeTraitAtLeast', player:'self', trait:'神奈川県警', n:3 }` | D11020 |
| bind 有無 | `{ kind:'bound', key:'$matched', presence:'matched' }` | D11019 |
| 論理結合 | `{ kind:'and', cs:[...] }` / `or` / `not` | D11019 / D11021 |
| 独自条件 (最終手段) | `{ kind:'custom', check:(s,ctx)=>... }` | D11013 |

## 使い分け

- 能力全体を ON/OFF → `condition:`（不成立なら rules/17 で「能力を持たない」扱い）。
- 効果列の途中分岐 → `conditional{ if, then, else? }`。`if` には上表の kind を使う。
- 「してもよい / そうした場合」連鎖 → `chain` + step1 `max:1`（skip で break, 例 D08003 a1 / D11007 a3）。

## 新 condition 追加手順

3点同時更新が必須:

1. `src/engine/cond/eval.ts` に kind 追加 + 評価実装。
2. [engine-api-conditions.md](engine-api-conditions.md) の型に追記。
3. 本カタログに行追加（snippet + 例）。

## 関連

- [engine-api-conditions.md](engine-api-conditions.md) — `Condition` 型の権威ソース
- [card-authoring-convention.md](card-authoring-convention.md) — カード実装コーディング規約
