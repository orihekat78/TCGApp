# caseMonoColor

「自分の事件が【色】以外の色を持たない場合」= 事件が指定色のみ (他色を1つも持たない) を表す Condition。

`not(caseColor[他の全色])` で表現する (`caseColor` は combine 既定 'or' = いずれか保持を判定するため、
他色を1つも持たない = not)。engine の condition kind 追加は不要 (既存 `not` + `caseColor` の組合せ)。

## シグネチャ

```typescript
export function caseMonoColor(color: string): Condition
// => { kind:'not', c:{ kind:'caseColor', color: <ALL_COLORS 以外の他色配列> } }
```

全色集合 `ALL_COLORS = ['青','赤','黄','緑','白','黒']` (本ゲーム 6 色)。

## 出現カード

| Card | 引数 | 公式 |
|------|------|------|
| B05010 / D10013 / D10014 (0516) | '青' | 事件が【青】以外を持たない場合ドロー |
| B05036 / PR169 / PR239 / PR245 (0540) | '緑' | 〃 緑 |
| B05070 (0570) | '赤' | 〃 赤 |

いずれも `【パートナー色】AP＋1000、事件が単色ならカードを1枚引く` カットインの後段 `conditional{if}` で使用。

## 注意

- 事件は常に 1 色以上を持つため、「他色を持たない」= 指定色の単色。
- 2 色事件 (例 青+緑) では指定色を含んでいても他色 (緑) を持つので false (正しい)。

## 関連
- [card-condition-catalog.md](../card-condition-catalog.md) — caseColor (combine 既定 or)
- src/engine/cond/eval.ts — caseColor は配列 color + 既定 or をサポート
