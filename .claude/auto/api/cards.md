# 🤖 engine.cards

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `0ea2e2a7e6c0`

カード定義レジストリ + TSV パーサ

## アグリゲータ (`engine.cards`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `_resetRegistry`
- `all`
- `byColor`
- `byName`
- `byTrait`
- `get`
- `load`
- `register`
- `unload`
- `validate`
- `validateAll`

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `loadSet` | `(setCode: 'CT-D08' \| 'CT-D11'): CardDef[]` | セット内の全 TSV (partner/character/event/case) を読みこみ CardDef[] にする。 abilities は空配列 (Phase 5 Group B-E で共通クラス側から merge する)。 / |
| `parseTsv` | `(text: string, kind: CardDef['kind']): CardDef[]` | ---------- public API ---------- TSV テキスト本文をパースして CardDef[] を返す純粋関数。 テスト容易性のため `loadSet` から分離。 / |

---

## ソース

- [`src/engine/cards/index.ts`](../../../src/engine/cards/index.ts)

