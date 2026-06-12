# 04. 規約のスクリプト強制 — lint 群 + pre-commit

「教訓を必ず機械チェック化し pre-commit に配線する」運用。conan では lint 7 本 + docs:check が pre-commit で稼働中。

## コアパターン

```
バグ発生 → BUG-XXX.md に RCA → 横断 audit で「教訓」に昇格
→ 教訓に必ず「→ enforcement: <script 名 or passive doc>」を明記
→ 能動化できるものは scripts/lint-*.ts として実装し pre-commit へ
```

- **人間/AI の注意力に頼る規約は必ず破られる** が前提
- 先回りで lint を作らない。**実際に 2 回再発した failure だけ** を lint 化する（形骸化防止）
- 各スクリプト冒頭に「どの教訓 / バグの enforcement か」をコメント必須

## simple-git-hooks による pre-commit チェーン

```jsonc
// package.json
"simple-git-hooks": { "pre-commit": "npm run docs:check && npm run lint:bugs && npm run lint:test-pair" },
"scripts": { "lint:bugs": "tsx scripts/lint-bug-frontmatter.ts", ... }
```

- `npm i -D simple-git-hooks tsx typescript @types/node` → `npx simple-git-hooks` で有効化
  （チェーン変更のたびに再実行が必要 → `"postinstall": "simple-git-hooks"` が安全）
- husky より軽量、設定が package.json 1 箇所で完結
- **pre-commit は数秒で終わる grep 系のみ**。重い検査（coverage / 大量シミュレーション）は月次 / CI へ
- 緊急回避: `SKIP_SIMPLE_GIT_HOOKS=1`

## zero-dependency lint スケルトン（同梱 lint-bug-frontmatter.ts が実例）

- node:fs のみ使用（外部依存ゼロ）。`walk(dir)` 再帰 → 正規表現チェック（AST 不使用）
- `type Issue = { file, msg, level: 'error'|'warn' }` → error のみ `process.exit(1)`
- 出力: `[ERROR]/[WARN]/[OK]` + 末尾サマリ行 `[script名] N files / errors=X / warns=Y`
- **AST パーサを書かない理由**: チェック追加の心理的障壁が上がると「教訓→スクリプト化」の
  ループが回らなくなる。雑な regex でも誤検知を warn 留めにすれば実用十分
- scripts/tsconfig.json（同梱）を持ち、ルートの typecheck に
  `&& tsc --noEmit -p scripts/tsconfig.json` を追加 — **lint スクリプト自体も型検査**
  （チェックスクリプト自身のバグも実際に起きた: 連番ファイルの文字列 sort 誤り）

## warn → error の段階導入 + allowlist

- 新規約は **warn スタート**（いきなり error だと既存違反でコミット全滅し導入が頓挫）
- 移行完了 or 期限で error 昇格。昇格条件は LESSONS-LEARNED の表に書く
- 正当な例外は `const ALLOWLIST = new Set([...])` をスクリプト先頭に置き、
  **各エントリに日付 + 理由コメント必須**（設定ファイル分離より diff レビューに乗りやすい）
- ヒューリスティック系は「永久 warn」と割り切り `// warn only — never exit 1` と明記

## staged-diff-aware lint（ratchet 方式）

- `git diff --name-only --cached --diff-filter=A` で **このコミットで増える分だけ** 検査
  （例: 新規 src ファイルに対応する tests/*.test.ts pair があるか）
- 既存負債に阻まれず即日導入できる「これ以上悪化させない」歯止め
- commit message のキーワード（checklist 完了宣言）でも通過できる escape hatch を用意

## baseline JSON + check スクリプト（閾値のデータ化）

- 重い検証は「実行 script」（→ JSON レポート）と「判定 script」（baseline と比較し exit code）に分離
- 閾値は `.claude/reports/*-baseline.json` に `{ expectations, thresholds }` で保存
  （回帰の定義はコードでなくデータ。閾値変更が lint の diff から分離される）
- 例: 1000 戦自動対戦の exceptions>0 → fail、平均ターン ±20% → warn。coverage は
  vitest の json-summary reporter → total.*.pct を読んで閾値比較
- 罠: レポートファイル名の連番 sort は必ず数値比較で書く（文字列 sort で 13 < 2 になる実バグあり）

## ブートストラップ手順（1 時間で骨格）

1. `npm i -D tsx simple-git-hooks typescript @types/node`
2. scripts-portable/ の tsconfig.json と lint-bug-frontmatter.ts をコピー、enum を書き換え
3. npm scripts 登録 + simple-git-hooks 設定 + `npx simple-git-hooks`
4. LESSONS-LEARNED.md（templates/）を設置
5. 以降はバグ再発のたびに lint を 1 本追加してチェーンに連結

最初に決めるのは 3 原則だけ: **lint は障害駆動で増やす / pre-commit は軽量 grep のみ / 教訓には必ず enforcement 欄**。
