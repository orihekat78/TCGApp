## 非MVP 全パッケージの単純カード一括実装 (cutin / keyword / case 249 枚)

**Round/Phase**: 2026-06-04 単純カード一括実装

cards-data 全 19 パッケージ (非MVP含む) の「カットイン能力のみ / 突撃・迅速等のキーワードのみ / 能力テキストなし事件」
カードを実装。ALL_CARDS は 323 → **572 枚** (partner 280 / character 255 / event 4 / case 33)。

- **generator 2 本** (partner generator S249 の前例踏襲、決定論的・再実行可能):
  - `scripts/gen-cards/gen-simple-cards.cjs` → `_generated/simple-cards.ts` (**213 枚**: simple cut-in 157 / keyword-only 25 / case no-ability 31)。固定APカットインは 3 shape (AP+1000/2000/自分ターン中+3000、D08015 同型)、keyword は `partnerColorKeyword`、case は `caseTraits:[]` (公式データに特徴列なし、推測補完しない)。
  - `scripts/gen-cards/gen-complex-cutins.cjs` → `_generated/complex-cutins.ts` (**36 枚**: cardId 別 PLAN テーブルで DSL 翻訳)。条件付きドロー (事件単色 / コンタクト相手の名・特徴・色)、特徴スケーリング、全リムーブ、アクティブ化等。
  - P-variant (絵柄違い) と MVP 同 cardId は base を spread。
- **共通クラス 2 本** (骨格凍結のため engine 無改変): `contactTargetMatches` (custom, `$contact.targetUid` の名/特徴/色一致) / `caseMonoColor` (`not`+`caseColor`)。
- **DEFERRED 5 種** ([BUG-114](../bugs/BUG-114.md)): set-card 操作 verb / discard 札スケール dyn root / 複数カットイン択一 が engine 未対応 → vanilla stub + DEFERRED コメント (カード自体は使用可)。

### 敵対的検証で発見・修正したバグ
- **[BUG-115](../bugs/BUG-115.md) (高)**: generator が features/color 列の comma 区切りを分割せず traits が破損 (`['探偵,高校生,赤井家']`)。trait は engine が完全一致 includes で照合する load-bearing データのため【絆】/特徴フィルタ/特徴スケーリングが silent fail していた。tsc/validate/smoke は通過し検知不能だったが、敵対的検証 (公式テキスト突合) が全 157 枚突合で発見。`split(/[|,]/)` + 色文字抽出に修正し再生成。

検証: tsc clean (両 config) / validateAll **572 枚 0 invalid・id 重複0** / 分類網羅性 cutin193・keyword25・case31 漏れ0 / vitest **1713 pass** (count test 3 本更新 + 新 generated-batch.test.ts) / smoke1000 **例外0・baseline 不変 (10.86/469)** / e2e 65 pass / lint errors=0 (cutin の matcher 警告は D08015 含む既存パターン)。
