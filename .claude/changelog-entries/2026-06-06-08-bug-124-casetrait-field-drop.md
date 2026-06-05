## BUG-124 (engine, 中) — caseTrait condition が CardDef.traits を参照 (事件特徴 caseTraits 未参照)

**Round/Phase**: 2026-06-06 session — タスク C disguise-hook unit の多エージェント adversarial review 水平展開で検出。

`engine/cond/eval.ts` の `caseTrait` condition が事件特徴を **`CardDef.traits`** (キャラ特徴用) から読んでいた。
事件の特徴は専用フィールド **`caseTraits`** に格納される (D08026=`caseTraits:['古城']`/`traits:[]`) ため、
caseTraits のみに特徴を持つ事件で【事件古城】等が永久 false の field-drop (BUG-117/118/122/123 と同族)。

- D11021(婚活) が婚活を traits・caseTraits **両方**に冗長保持していたため 婚活 gating (D11003/D11005) は偶然成立し、
  バグは latent (古城 gating カードは現状 0 件)。ただし冗長データ修正で 婚活 gating が静かに壊れる脆さがあった。
- 修正: `caseTrait` を `caseTraits + traits` の union で評価 (strictly more permissive → 既存挙動保持 + 古城系解禁)。
- 水平展開: 全 36 case カード突合 (非空 caseTraits は D08026/D11021 のみ) / caseTrait 利用は caseTraitConditioned
  (婚活) + B09101(犯人, 該当 case 0) のみ → fix は無影響 or 解禁のみ。
- 検証: eval.test.ts に caseTrait 3 ケース追加 / 全 vitest **1818 pass / 0 fail** (+3, 回帰0) / case-trait e2e 4 pass /
  typecheck clean。詳細: [.claude/bugs/BUG-124.md](../bugs/BUG-124.md)。
