# 🤖 ルール ↔ ソース マッピング index

> ⚠️ このファイルは `scripts/gen-docs/gen-mapping.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:mapping`
> Source hash: `ad3d2cfa12fb`

`// rules:` コメントから生成した双方向マッピングのハブ。

## サマリ

- ソースファイル: **1349** (うち `// rules:` 参照あり: **765**)
- 参照総数: **3176**
- 参照されているルール: **31/30**

## マッピング一覧

### ソース → ルール（エリア別分割）

- [`cards-to-rules-cards.md`](./cards-to-rules-cards.md) — カード → ルール マッピング
- [`cards-to-rules-engine-core.md`](./cards-to-rules-engine-core.md) — Engine (types/read/mutate) → ルール マッピング
- [`cards-to-rules-engine-flow.md`](./cards-to-rules-engine-flow.md) — Engine (effect/flow/invariant) → ルール マッピング

### ルール → ソース

- [`rules-to-cards.md`](./rules-to-cards.md) — 各ルールがどのソースから参照されているか

### 俯瞰図 (Mermaid)

- [`graph-rules-engine-core.md`](./graph-rules-engine-core.md) — engine-core (types/read/mutate/event/cards) ↔ rules
- [`graph-rules-engine-flow.md`](./graph-rules-engine-flow.md) — engine-flow (effect/flow/invariant/dyn/target/cost/cond/resolve) ↔ rules
- [`graph-specs.md`](./graph-specs.md) — engine ↔ specs の関係図

### Obsidian グラフビュー連携ハブ

各エンティティを起点に source / rule / spec / namespace をリンクで辿れるハブファイル群。Obsidian で開くとグラフビューがエンジン ↔ ルール ↔ 仕様書の関係を描画する。

- [`by-rule/`](./by-rule/) — 各ルールが起点のハブ（このルールを参照するソース・関連 spec・関連 engine namespace）
- [`by-spec/`](./by-spec/) — 各 spec が起点のハブ
- [`by-engine/`](./by-engine/) — 各 engine namespace が起点のハブ

---

## ソース

- [`src/`](../../../src/)
- [`.claude/rules/`](../../rules/)