# 🤖 engine public API — namespace 一覧

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `16c30be565c4`

`src/engine/index.ts` から公開されている 12 namespace の自動生成リファレンス。

| namespace | エクスポート数 | 説明 |
| --------- | -------------- | ---- |
| [`read`](read.md) | 8 | 純粋セレクタ（GameState を読むのみ、副作用なし） |
| [`mutate`](mutate.md) | 14 | Immer draft 上の primitive 変更操作 |
| [`invariant`](invariant.md) | 10 | 不変条件チェック（case/partner/stun semantics 等） |
| [`event`](event.md) | 2 | Hook on/emit/queue + EffectStackEntry 自動wrap |
| [`effect`](effect.md) | 4 | Atom dispatcher / DSL Resolver / Validator |
| [`dyn`](dyn.md) | 2 | 動的式評価（$self.ap / $contact.X / $cost.X / $dyn.X） |
| [`target`](target.md) | 8 | 候補抽出 + 選択検証（split-name / distinctNames 含む） |
| [`cost`](cost.md) | 3 | コスト判定（canPay / pay）+ viaCost フラグ管理 |
| [`cond`](cond.md) | 3 | 26 Condition variants 評価 |
| [`resolve`](resolve.md) | 11 | Effect Stack（queue/next/runOne + cancel/replace/lock） |
| [`flow`](flow.md) | 36 | フェイズ制御（setup / auto / main / action FSM / contact / actionCase / guard） |
| [`cards`](cards.md) | 2 | カード定義レジストリ + TSV パーサ |

## 全体構造

`engine` オブジェクトは `src/engine/index.ts` で 12 namespace を統合公開している。

## 関連

- [`.claude/auto/README.md`](../README.md) — 自動生成ドキュメント運用ガイド
- [`HUB.md`](../../../HUB.md) — プロジェクトHUB
