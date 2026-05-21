# Changelog エントリ

このディレクトリは [CHANGELOG.md](../../CHANGELOG.md) の **ソースデータ** を保持する。
[scripts/gen-docs/gen-changelog.ts](../../scripts/gen-docs/gen-changelog.ts) が読み取って CHANGELOG.md を組み立てる。

## ファイル命名規則

```
YYYY-MM-DD-NN-<slug>.md
```

- `YYYY-MM-DD` — 完了日 (Asia/Tokyo)
- `NN` — 同日内の連番 (2 桁)。**大きい番号ほど CHANGELOG 上で上 (新しい) に並ぶ**
- `<slug>` — 自由なケバブケース ID

特殊ファイル (アンダースコア prefix):

- `_unreleased.md` — `## [Unreleased]` セクションの本文
- `_footer.md` — CHANGELOG.md 末尾 (現在のメトリクス等)
- `README.md` — 本ファイル (生成対象外)

## ファイル形式

各エントリは **`## ` から始まる完全なセクション**。フロントマッターは使わない。

```markdown
## Round 4m — XYZ 対応 (2026-06-01)

commit `abc1234`。一文サマリ。

### Added
- 何か

### Fixed
- 何か
```

## 追加方法

Phase / Round 完了時:

1. このディレクトリに新しいエントリファイルを作成
2. `npm run docs:changelog` を実行 → CHANGELOG.md が再生成される
3. `npm run docs:check` で drift がないか確認 (pre-commit hook が自動実行)

## なぜこの方式か

- CHANGELOG.md の手書き編集による merge conflict を避ける
- エントリ単位での追加・削除・並び替えが容易
- 既存の [scripts/gen-docs/](../../scripts/gen-docs/) パターンに統一
- Towncrier / changie 等の業界標準と同型
