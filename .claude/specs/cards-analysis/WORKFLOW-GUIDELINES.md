---
updated_at: 2026-05-22
status: active
related_bug: BUG-064
---

# カード処理ワークフロー図 作成ガイドライン

`.claude/specs/cards-analysis/<カードID>-workflow.md` 形式でカード固有の処理フローを記述する際の規約。
BUG-064 (D08015-workflow.md a1 抽象度漏れ) の再発防止として導入。

## 目的

新規カード追加 / 既存カード理解の際、「カードが何を実行するか」をカード視点で読めるドキュメントを残す。
**エンジン実装トレースではなく、カード固有の意味の記述。**

## 1. 表現形式: ASCII フロー (推奨)

Mermaid は環境依存で描画失敗する場合があるため (BUG-064 で `Markdown Preview Mermaid Support` での描画不能を確認)、デフォルトは **ASCII フロー** とする:

```text
[ ノード A ]
   │
   ▼
[ ノード B ]
   │
   ▼
[ ノード C ]
```

- ` ```text ` フェンスで囲む (MD040 警告回避)
- box-drawing characters (`│ ▼ │ └ ┘`) で接続
- 分岐がある場合は ` │── Yes ──▶ ` のように分岐ラベル付与

## 2. ノード粒度: カード固有の意味のみ

ノードに書いてよい:

- カードが rules/ のどの規則を実行するか (例: `1 ドロー`、`手札から 1 枚リムーブ`)
- どの atom を使うか (例: `draw` / `discard` / `sceneEnter`)
- カード固有の条件分岐 (例: 【絆 工藤新一】 の有無、自身の AP ≥ 6000 等)

ノードに **書かない**:

- engine internal API 名 (`engine.flow.*` / `mutate.*` / `event.emit` 等)
- listener 配線詳細 (`listeners.triggered.runTriggered` 等)
- atom 内部処理 (例: `draw` atom 内の deck-0 → refresh → defeat → これは engine 責務)
- pick の human/AI 分岐 (`resolve-picks` の責務)
- internal state 表現 (`ax.cutInUsed` 等)
- BUG 番号 (注釈に分離)

## 3. 補足注釈: blockquote で engine 責務・ルール例外を明記

図直後に `>` blockquote で以下を補足:

- engine 内部処理に委ねている部分の明示 (例: 「draw 内 deck-0 処理は draw atom 責務、BUG-036 配線」)
- ルール上の例外 (例: 「変装による登場では enter hook 不発火、rules/09」)
- 集約された登場経路の説明 (例: 「登場経路 4 種は enter hook に集約済み」)

## 4. 思考プロセス: 「描き終わった図が複雑なら集約点を探す」

書き終わった後、以下を自問:

- ノードが 10 個以上ある → どれかは engine 責務では? 削れる?
- 分岐が 3 経路以上ある → どれかは集約できる単一点 (hook 発火点等) では?
- internal API 名がノードに出現している → カード視点で意味のある rules 用語に置換できる?

これに **Yes** が 1 つでもあれば、設計に問題あり。再簡素化する。

## 5. ファイル命名 / 配置

- ファイル名: `<カードID>-workflow.md` (例: `D08015-workflow.md`)
- 配置: `.claude/specs/cards-analysis/`
- 100 行以内 (CLAUDE.md §ファイルサイズ制約)
- 100 行超なら能力単位で分割 (`<カードID>-a1.md` / `<カードID>-a2.md`)

## 関連

- [BUG-064](../../bugs/BUG-064.md) — 本ガイドライン導入のきっかけ
- [D08015-workflow.md](D08015-workflow.md) — 本ガイドラインに準拠した参照実装
- [card-addition-checklist.md](../card-addition-checklist.md) §9 — 新規カード追加時のチェック項目
