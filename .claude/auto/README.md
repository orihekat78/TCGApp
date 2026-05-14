# 🤖 自動生成ドキュメント

このディレクトリ配下のファイルは **`scripts/gen-docs/`** から自動生成される。
**人手で編集してはならない。** 編集しても次の `npm run docs:*` 実行で上書きされる。

## 現状（2026-05-14）

**Phase 1**: このREADME と [../../HUB.md](../../HUB.md) のみ。スクリプト未実装。
**Phase 2 以降**: 以下のディレクトリが順次追加される。

## 予定される構成

```text
.claude/auto/
├── README.md              # この運用ガイド（手書き、唯一の例外）
├── api/                   # Phase 2: エンジンpublic API reference
│   ├── index.md           # 12 namespace 一覧
│   ├── read.md            # read namespace (turn/player/scene/char/def/game/log)
│   ├── mutate.md          # mutate namespace (13 modules)
│   ├── flow.md            # flow namespace (setup/turn/action FSM)
│   ├── effect.md          # effect DSL runner
│   └── ... (event, invariant, dyn, target, cost, cond, resolve, cards)
├── state/                 # Phase 3: GameState shape
│   └── game-state.md      # Mermaid classDiagram
├── flows/                 # Phase 3: 状態遷移図
│   ├── setup.md           # ゲーム開始フロー
│   ├── auto-phase.md      # オートフェイズ 4-step
│   ├── turn.md            # ターン全体
│   └── action-fsm.md      # 9-phase Action State Machine
├── progress/              # Phase 3: 進捗テーブル
│   ├── cards.md           # CT-D08/D11 実装進捗
│   └── tests.md           # vitest結果サマリ
└── mapping/               # Phase 4: ルール↔コード双方向リンク
    ├── rules-to-cards.md  # ルール → それを参照するカード
    └── cards-to-rules.md  # カード → 参照しているルール
```

## 再生成コマンド

| コマンド | 生成対象 | Phase |
| -------- | -------- | ----- |
| `npm run docs:api` | api/ | 2 |
| `npm run docs:state` | state/ | 3 |
| `npm run docs:flows` | flows/ | 3 |
| `npm run docs:progress` | progress/ | 3 |
| `npm run docs:mapping` | mapping/ | 4 |
| `npm run docs` | 全部 | 3+ |
| `npm run docs:check` | （差分検知のみ、書き込まない） | 4 |

> 現時点で `scripts.docs*` は未実装。Phase 2 以降で `package.json` に追加される。

## 各ファイルのヘッダ

自動生成ファイルの先頭には以下のヘッダが付く（Phase 2以降）：

```markdown
> ⚠️ このファイルは `scripts/gen-docs/gen-XXX.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:XXX`
> Source hash: `<sha>` / 生成日時: `<ISO timestamp>`
```

source hash は元コードの変更を検知するためのもので、CI / pre-commit hook で差分検知に使う。

## なぜ自動生成か

- **同期コスト削減**: コード変更時にドキュメントを手動更新する必要がない
- **正確性保証**: 型定義から直接抽出 = 誤記なし
- **Obsidianとの相性**: 生成物も .md なのでグラフ・バックリンクが効く
- **骨格凍結原則との整合**: ドキュメント生成のためにエンジンコードに手を入れない

詳細プラン: `C:\Users\arumi\.claude\plans\claudecode-structured-peacock.md`（Claude Code側に保管）

## 関連

- [プロジェクトHUB](../../HUB.md)
- [プロジェクト規約 (CLAUDE.md)](../CLAUDE.md)
