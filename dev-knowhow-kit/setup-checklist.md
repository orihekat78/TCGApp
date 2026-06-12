# 新プロジェクト立ち上げチェックリスト

このキットを別フォルダのプロジェクトに展開する手順。所要 1〜2 時間。
（番号は推奨順。プロジェクトの性質に合わせて取捨選択可）

## Phase 1: 最小構成（30 分）— どのプロジェクトでも推奨

- [ ] 1. キットのフォルダごと新プロジェクト直下にコピー（または参照用に置く）
- [ ] 2. `templates/CLAUDE-template.md` の {{...}} を埋めて `.claude/CLAUDE.md` に設置
- [ ] 3. `.claude/memory.md`（空）+ `.claude/sessions/` を作成（→ knowhow/09）
- [ ] 4. README.md を「紹介 + 起動 + リンク集」だけの薄い状態で作成
- [ ] 5. MCP: 同一マシンならユーザーレベル設定が既に有効。
      別マシンなら `mcp/mcp-servers.md` のコマンドで再登録（PAT は新規発行）
- [ ] 6. プラグイン: 別マシンなら `/plugin marketplace add` で 3 系統導入（mcp/mcp-servers.md 参照）

## Phase 2: バグ管理 + lint 強制（30 分）— コードを書き始める前に

- [ ] 7. `npm i -D tsx simple-git-hooks typescript @types/node`
- [ ] 8. `.claude/bugs/` を作成し `templates/BUG-template.md` `AUDIT-template.md`
      `index.base` `LESSONS-LEARNED-template.md` をコピー
      （**LESSONS-LEARNED-template.md は `LESSONS-LEARNED.md` にリネーム**して設置 —
      AUDIT-template 内のリンクがこの名前を前提にしている）
- [ ] 9. severity / status / category の enum を自プロジェクト語彙で定義
      （BUG-template と index.base と lint の 3 箇所を同じ値に）
- [ ] 10. `scripts-portable/tsconfig.json` と `lint-bug-frontmatter.ts` を `scripts/` にコピー、
      enum Set を 9 と同じ値に書き換え
- [ ] 11. package.json に npm scripts + simple-git-hooks を設定 → `npx simple-git-hooks`
      （`"postinstall": "simple-git-hooks"` 推奨）
      ⚠ この時点の pre-commit は `npm run lint:bugs` のみにする。
      `docs:check` を入れるのは Phase 4 で gen-docs を導入した後（先に入れると全コミットが失敗する）

## Phase 3: ナレッジベース（プロジェクトのドメインが固まったら）

- [ ] 12. 一次情報源（API 仕様 / 法令 / 公式ルール…）を特定し `.claude/rules/` に
      トピック別抜粋（各 ≤100 行）を作成（→ knowhow/02）
- [ ] 13. INDEX.md（読み順 + 参照原則 + 残課題）と sources.md（出典台帳）を作成
- [ ] 14. 原文との突合再検証パスを 1 回実施（漏れは必ずある）
- [ ] 15. エッジケース 5 分類を自ドメイン向けに定義し CLAUDE.md に記載（→ knowhow/01）

## Phase 4: ドキュメント自動生成（ファイルが 50 個を超えてきたら）

- [ ] 16. `scripts-portable/gen-docs/` を `scripts/gen-docs/` にコピー
- [ ] 17. gen-structure.ts の `EXCLUDE_*` を調整、structure-dictionary.json を 10 件程度で開始
- [ ] 18. `.claude/changelog-entries/` を作成し、`templates/changelog-entries/` の
      `_unreleased.md` / `_footer.md` をコピー（gen-changelog はこの 2 ファイルが無いと失敗する）
- [ ] 19. npm scripts（docs / docs:check / docs:changelog / docs:structure）登録、
      docs:check を pre-commit チェーンに追加

## Phase 5: 検証基盤（UI / ランダム性があるなら）

- [ ] 20. テスト用フック（window.__appTestHook 相当）を dev ビルドに用意
- [ ] 21. E2E helpers（フック待機 + console error collector + 状態注入）を作成（→ knowhow/06）
- [ ] 22. 「バグ 1 件 = 回帰 E2E 1 本」「decoy 検証」を CLAUDE.md のセルフレビューに明記
- [ ] 23. ランダム性があるなら seed 注入式 smoke runner + baseline 判定を導入

## Phase 6: 大規模化したら（任意）

- [ ] 24. コアが安定したら骨格凍結を宣言、capability map + ゲート表 + DEFERRED-INDEX（→ knowhow/07）
- [ ] 25. 均質バックログが数百件あるならエージェントパイプライン（→ knowhow/08）
- [ ] 26. NEXT-SESSION-PROMPT.md 運用開始（templates/ にテンプレートあり）
- [ ] 27. 非開発者向けに start.bat / setup-and-run.ps1 を調整（scripts-portable/ に実例）
- [ ] 28. Obsidian vault 化（HUB.md + PROJECT-MAP.canvas + index.base）

## 最初に決めるべき 3 原則（Phase 2 の前提）

1. **lint は障害駆動で増やす**（先回りで作らない。2 回再発したら 1 本書く）
2. **pre-commit は軽量 grep 系のみ**（重い検査は月次 / CI）
3. **教訓には必ず enforcement 欄**（passive doc で終わらせない）
