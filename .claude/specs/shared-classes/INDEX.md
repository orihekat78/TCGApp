# cards/_shared/ — 共通クラス INDEX (2026-05-11)

3枚以上で出現したパターン (+ 弾跨ぎ2枚で確実なもの) を共通クラス化。
**破壊的変更禁止** ([CLAUDE.md](../CLAUDE.md))。新パターンは新クラスで対応。

## 確定 9 クラス

| クラス | spec | 出現枚数 | パラメータ | 性質 |
|--------|------|---------|-----------|------|
| partnerColorKeyword | [spec](partnerColorKeyword.md) | 5+ | { color, kw, scope?, additionalCondition? } | continuous |
| ~~cutinFixedAP~~ | 廃止 2026-06-02 | — | カットインは各カードに inline atom で記述 (D08007 同型) | — |
| hiramekiCharStun | [spec](hiramekiCharStun.md) | 4 | { side?='either', n?=1 } | icon-flash |
| hiramekiDraw | [spec](hiramekiDraw.md) | 4 | { n=1 } | icon-flash |
| caseTraitConditioned | [spec](caseTraitConditioned.md) | 4 | { trait, conditionInner } | wrapper |
| caseResolvedHandRemove | [spec](caseResolvedHandRemove.md) | 2 (弾跨ぎ) | { n=1 } | triggered |
| caseDeclaredEvidenceFlip | [spec](caseDeclaredEvidenceFlip.md) | 2 (弾跨ぎ) | { delta, targetFilter, condition? } | declared |
| eventRemoveByAP | [spec](eventRemoveByAP.md) | 2 (弾跨ぎ) | { apMax, side?='either' } | triggered (event) |
| (partnerCommon) | — | 4 | — | **骨格内蔵で OK** (CardDef.abilities=[]) |

## 規約 (CLAUDE.md 整合)

1. **シグネチャ追加変更のみ可** (オプショナル引数追加)
2. **削除・必須化・型変更は禁止** (新クラスを作る)
3. **骨格APIを経由してstate操作** (`engine.read.*` / `engine.mutate.*`)
4. カード本体からの直接 import は OK だが、共通クラス間の循環依存禁止
5. 各共通クラス spec は次セクション必須:
   - シグネチャ
   - 戻り値 (Effect descriptor)
   - 出現カード一覧
   - 互換性 (拡張時の制約)
   - エッジケース (該当ルール参照)

## ディレクトリ構成 (実装時)

```
cards/
├── _shared/
│   ├── partnerColorKeyword.ts
│   ├── (cutinFixedAP.ts — 2026-06-02 廃止: cutin は inline atom 化)
│   ├── ...
│   └── index.ts (re-export)
├── ct-d08/
│   ├── D08001.ts
│   └── ...
└── ct-d11/
    └── ...
```

## 関連

- [../cards-analysis/SHARED-PATTERNS.md](../cards-analysis/SHARED-PATTERNS.md) — 集計元
- [../engine-api-card-abilities.md](../engine-api-card-abilities.md) — AbilityDef 型
- [../CLAUDE.md](../CLAUDE.md) — 共通クラス運用
