# 設計: 全パートナーカード生成 (generator) (2026-06-03)

## ゴール
cards-data の全 partner.tsv (~280枚) のうち、**未作成の 276 枚** を `src/cards/<pkg>/<cardNum>.ts` (CardDef, `abilities:[]` stub) として generator で生成し、registry に登録する。

- **スコープ**: 非MVP 17 パッケージ (ct-d01〜07/09/10, ct-p01〜09, pr-01)。MVP (ct-d08/ct-d11、4枚) は不変。
- **変種**: parallel art variant (B01001 / B01001P / B01001Sec1 …) も **別 cardId = 別ファイル**。
- **個別能力**: 今回は全て `abilities:[]` stub (~22枚の個別能力ありは後回し、TODO コメント)。

## データ前提 (検証済)
- 全 partner: features 空 (`traits:[]`) / 単色 / cardNum は有効な TS 識別子 / cardNum 重複なし。
- TSV 列: `cardNum, cardId, title, color, lp, rarity, features, imagePath, effect, illustrator, qAndA`。partner では `effect` は共通能力のみ → 使わない。

## Generator
`scripts/gen-cards/gen-partners.cjs`:
1. `.claude/specs/cards-data/*/partner.tsv` を全件読む (ct-d08/ct-d11 はスキップ)。
2. 各行 → `src/cards/<pkg>/<cardNum>.ts` を生成 (D08001.ts と同型):
   ```typescript
   // cards/<pkg>/<cardNum> <title> (パートナー) — auto-generated
   import type { CardDef } from '@/engine/types';
   export const <cardNum>: CardDef = {
     id: '<cardNum>', no: '<cardId>/<cardNum>', kind: 'partner',
     names: ['<title>'], colors: ['<color>'], lp: <lp>, traits: [],
     rarity: '<rarity>', imageUrl: '<imagePath>',
     abilities: [], // TODO: 個別能力 (ct-p05 / pr-01 の一部) は後日
     ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
   };
   ```
   文字列は single-quote 用に escape (`\` と `'`)。
3. 集約 barrel `src/cards/_generated/partners.ts` を生成 (全 import + `export const GENERATED_PARTNERS: CardDef[] = [...]`)。

## Registration
`src/cards/index.ts` に 1 行追加: `import { GENERATED_PARTNERS } from './_generated/partners.js';` し、`ALL_CARDS` に `...GENERATED_PARTNERS` を spread。`registerAll()` は不変 (ALL_CARDS をループ)。

## 検証
- tsc clean / 重複 id 検出 (registry register が同一 id 上書きしないこと = ユニーク) / `ALL_CARDS.length` が +276 / vitest 全件 PASS / smoke 1000 (MVP 決着不変、新 partner は deck 未使用で影響なし)。
- 既存 MVP partner (D08001/02, D11001/02) は不変。

## 注意 / トレードオフ
- 生成 276 ファイルは大半が parallel art の重複 + deck を組めない orphan (character/event 未実装)。将来 deck を組むには各パッケージの character/event/case も必要。
- generator は再生成可能 (TSV 更新 → 再実行)。生成物は commit する (既存カードと同じ運用)。
