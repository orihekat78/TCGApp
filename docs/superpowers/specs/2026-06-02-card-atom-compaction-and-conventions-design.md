# 設計: カード atom 記述のコンパクト化 + 規約制定 (2026-06-02)

## ゴール
公式テキストの動詞列を **1ステップ＝1行 atom（直前行に公式テキスト対応コメント）** へ翻訳する形に全 non-partner カードを統一。土台として (a) コーディング規約 (b) condition カタログ を新規 doc 化し、engine に全 pick 系 atom の短縮形を完備する。

- **対象**: verbose な複数行 atom を持つ全 non-partner カード + リファレンス9枚の再点検
- **対象外**: パートナーカード (D08001/D08002/D11001/D11002, `kind:'partner'`) / `_shared/*.ts` factory 内部 / ability なし vanilla 13行カード
- **不変条件**: 全カードの **ランタイム動作・description・テスト結果は完全不変**（純粋な構造リファクタ + DSL 糖衣）
- **全数内訳**(ct-d08 26 + ct-d11 21 = 47): partner 4(除外) + vanilla 13(作業無) + reference 9 + closure系 1(D08005) + 要reformat 12 + 簡易 8 = 47

## コメント様式（comment-above）
各ステップは 1行目=公式テキスト対応コメント / 2行目=atom 本体（1物理行）。末尾コメント禁止。
```typescript
// 証拠を1つ得る
{ kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
// 自分の証拠を1つ選び、手札に加える
{ kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', n: 1 } },
```
`conditional` は `if`/`then` の意味が分かれる場合、分岐ごとに直前行コメント可。

## 成果物 doc（新規2 + 既存更新）
- **`.claude/specs/card-authoring-convention.md`**（新規, ≤100行）: 1行 atom / comment-above / 短縮形優先 / 冗長 choice 除去 / closure は最終手段 / ability 連番。
- **`.claude/specs/card-condition-catalog.md`**（新規, ≤100行）: 各 `Condition.kind` の1行スニペット + 「公式アイコン/文言→kind」対応 + リファレンス使用例 + 新 condition 追加手順。
- **更新**: `engine-api-conditions.md`(型の権威ソース) / `engine-api-effect-descriptor.md` / `engine-api-atom-verbs.md` / `card-addition-checklist.md` から上記2 doc へ相互リンク。重複記述は持たせない。

## engine 変更（Approach 2 / 動作不変 refactor）
`src/engine/effect/` に **単一の権威テーブル + normalizer** を導入し、短縮形を一本化:
- `ATOM_PICK_SPEC: verb → { defaultArea, mode:'PA'|'PB', needs?:'delta'|'state', sourceSplice? }`
  - 既存移行: `discard`/`evidenceToHand`/`handAddFromRemove`(PB) / `sceneRemove`(PA) / `charModifyAP`(PA,delta)
  - 新規追加: `sceneSetState`(PA,state) / `charModifyLP`(PA,delta) / `sceneEnter`(PA,sourceSplice, from 指定)
- `normalizeAtomShortForm(verb,args,ctx)` がテーブルを引いて `target:{kind:'pick'}` を構築。`resolve-picks.ts`(human/AI walk) と `atom-handlers.ts`(直接呼び) の両方が同一 normalizer を経由。
- `filterAny`(D08024) / `state` フィルタ(D11020) / `side` を短縮形で pass-through。
- 既存 bespoke branch をテーブル経由に置換。**移行前後で生成 pick query が等価**であることを専用テストで保証（骨格凍結原則の「動作不変な内部最適化」に該当）。

## カード再フォーマット（バッチ）
| B | カード | 主作業 |
|---|---|---|
| B0 | リファレンス9枚 (D08003/07/11/13/15/21/26, D11007/19) + D11020(既compact) | comment-above 化 + 規約照合（動作/テキスト不変）|
| B1 | D11016, D11013, D11005, D11015 | 2行atom→1行 / 既存短縮形(sceneRemove/charModifyAP)利用 / 冗長 choice 除去（新 engine 不要分）|
| B2 | D08019, D11003, D11009 | `sceneSetState` 短縮形へ |
| B3 | D11012, D11021(事件) | `charModifyLP` 短縮形 + `charModifyAP` dyn-delta 短縮形 + 真の choice 分岐(LP+1/AP+2000)保持 |
| B4 | D08024, D11014 | `sceneEnter`-from-area 短縮形 + `filterAny` |
| B5 | 簡易カード8枚 (D08009/17/22/23/25, D11011/17/18) | atom 1行化 + comment-above 点検（多くは差分小）|

注: 短縮形は `delta: number | {dyn}` を受け付け、D08026(B0)/D11021(B3) の dyn-delta `charModifyAP` も1行化する。D08005(continuousModifier closure) / D11013(custom check) は atom 化対象外で、動作不変のまま comment-above のみ整える。partner 4枚は全 batch 対象外。

## 検証戦略（動作不変オラクル）
- 各バッチ後: `vitest` 全件(1577+) + `tsc` typecheck + smoke 1000戦 0例外。**既存 per-card テストが主オラクル**。
- engine refactor: `resolveEffectPicks` の出力 pick query が移行前後で等価であることのテストを追加。
- テスト無しカードは effect descriptor の意味等価テストを最小追加。
- 影響大カード(D08024/D11012/D08019)は Playwright で modal→pick→解決を1試合通し確認。
- 水平展開: 同一 verb 使用カードを `ATOM_PICK_SPEC` テーブル起点で横断確認。

## リスク / エッジケース
- **0枚 pick**(`max:1`→0選択 skip): 全 PA verb で `$pick` skip 経路を確認。
- **filterAny / state / side** の取りこぼし（D08024/D11020）。
- **sourceSplice**（remove/evidence→登場/手札で source 除去）の重複登場バグ再発防止。
- **真の choice 分岐**（D11012/D11015）を冗長 choice と誤判定して壊さない。
- **closure 系**（D08005/D11013）を短縮形対象外と正しく分類。
- **リファレンス再点検で動作/テキスト/テストを変えない**（コメント位置のみ）。

## 関連
- 規約: [.claude/specs/card-authoring-convention.md](../../../.claude/specs/card-authoring-convention.md)（新規）
- カタログ: [.claude/specs/card-condition-catalog.md](../../../.claude/specs/card-condition-catalog.md)（新規）
- 既存: `.claude/specs/engine-api-{conditions,effect-descriptor,atom-verbs}.md`, `card-addition-checklist.md`
- 規約遵守: CLAUDE.md「骨格凍結原則」「速度<精度」「Markdown ≤100行」
