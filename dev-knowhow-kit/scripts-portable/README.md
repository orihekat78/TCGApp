# scripts-portable — そのまま流用できる実スクリプト

conan リポジトリから抽出した実働スクリプト。**配置場所の前提** に注意。

## 配置と調整

| ファイル | 新プロジェクトでの配置先 | 調整箇所 |
|----------|------------------------|----------|
| tsconfig.json | `scripts/tsconfig.json` | extends 先（ルート tsconfig）を確認 |
| lint-bug-frontmatter.ts | `scripts/` | ALLOWED_* の enum Set、BUGS_DIR パス |
| bug-trend.ts | `scripts/` | CLUSTERS の再発クラスタ定義（conan の 5 クラスタを自プロジェクト語彙に全置換） |
| gen-docs/（フォルダごと） | `scripts/gen-docs/` | **`<ルート>/scripts/gen-docs/` 配置が前提**（PROJECT_ROOT = 2 つ上を解決） |
| gen-docs/gen-structure.ts | 同上 | EXCLUDE_DIRS 等の除外リスト、OUTPUT_PATH |
| gen-docs/structure-dictionary.json | 同上 | 説明辞書（最小雛形を同梱、自由に追記） |
| gen-docs/gen-changelog.ts | 同上 | ENTRIES_DIR（`.claude/changelog-entries/` が前提）、ヘッダ説明文 |
| start.bat + setup-and-run.ps1 | リポジトリ直下 + `scripts/` | dev サーバコマンド・ポート番号（Vite 5173 前提） |

## index.ts について

同梱の dispatcher は汎用 2 generator（structure / changelog）のみ登録済み。
conan には他に 5 本（api / state / flows / progress / mapping — ts-morph による
型抽出系）があるが、プロジェクト固有のため非同梱。必要なら conan の
`scripts/gen-docs/` を参照して同じインターフェースで追加する（→ knowhow/05）。

## npm scripts 登録例

```jsonc
"scripts": {
  "typecheck": "tsc --noEmit && tsc --noEmit -p scripts/tsconfig.json",
  "lint:bugs": "tsx scripts/lint-bug-frontmatter.ts",
  "docs": "tsx scripts/gen-docs/index.ts all",
  "docs:check": "tsx scripts/gen-docs/index.ts check",
  "docs:structure": "tsx scripts/gen-docs/index.ts structure",
  "docs:changelog": "tsx scripts/gen-docs/index.ts changelog"
},
"simple-git-hooks": { "pre-commit": "npm run docs:check && npm run lint:bugs" }
```

⚠ `docs:check` を pre-commit に入れるのは gen-docs を導入した後にすること
（導入前に入れると全コミットが失敗する。→ setup-checklist Phase 2/4 の順序）。

依存: `npm i -D tsx simple-git-hooks typescript @types/node` → `npx simple-git-hooks`
