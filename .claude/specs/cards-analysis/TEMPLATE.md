# カード効果分析テンプレート (TSV参照型)

各カード1ファイルで作成。**メタデータは TSV ([cards-data/](../cards-data/INDEX.md)) を権威ソース** とし、本ファイルは **テキスト効果のみ** を扱う。

## ファイル形式

```markdown
# DXXNNN カード名 [(別印刷: DYYY)]

## メタ + 公式テキスト
TSV: [cards-data/<set>/<kind>.tsv](../cards-data/<set>/<kind>.tsv) row=DXXNNN
(色/AP/LP/レベル/特徴/効果/カットイン/ヒラメキ/変装テキストは TSV 行を参照)

## abilities

### a1 (短い名)

- type: continuous | triggered | declared | icon-cutin | icon-flash | icon-disguise
- condition: ……
- cost: ……
- trigger: ……
- scope: on-scene | on-partner-area | on-hand | on-evidence | always
- limit: 【ターン①/②】等
- effect (Descriptor): JSON
- ruleRefs: rules/NN, …

## patterns
- pattern-name: 短い説明 / 出現枚数想定

## エッジケース
- ……

## 関連
- 同 effect 別印刷: DYY (TSV row 別)
- 共通候補: cards/_shared/xxx.ts
- ルール: rules/NN-…
```

## ✅ 必須チェック

- [ ] メタデータは TSV 参照のみ (md内の重複禁止)
- [ ] 公式テキストは原文ママ (エラッタ後)
- [ ] effect が骨格APIで完全表現できる (custom 不使用)
- [ ] エッジケース最低1件考慮
- [ ] 同パターン他カードを水平展開で確認 (3枚以上で共通クラス化)
- [ ] ruleRefs 必須

## 注意

- **メタデータは TSV のみ**: 色/AP/LP/レベル/特徴/レアリティ/画像/難易度/フラグ
- **テキストは md のみ**: 効果テキスト/能力分解/パターン/エッジケース
- 既存の D08001-D11005 等 md は「メタ重複あり」状態だが、新規はこのテンプレに従う

## 関連
- [INDEX.md](INDEX.md) — 47枚進捗トラッキング
- [../cards-data/INDEX.md](../cards-data/INDEX.md) — TSV メタデータ INDEX
- [../engine-api-card-shape.md](../engine-api-card-shape.md) — CardDef 型
- [../engine-api-card-abilities.md](../engine-api-card-abilities.md) — AbilityDef 型
