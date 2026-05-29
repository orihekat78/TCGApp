# 09 — Phase 10 工程と検証

## Phase 一覧 (~14 日)

| Phase | 内容 | 工数 | 完了 gate |
|---|---|---|---|
| **10-A** | `meta-app/` 骨格 (vite.config.meta.ts / scripts / tsconfig / index.html / main.tsx) | 0.5 日 | `npm run dev:meta` で 5174 緑、空 MetaShell 描画 |
| **10-B** | shared/ プリミティブ TS 移植 (10 components + tokens.ts) | 2 日 | 全 component が demo page で render、tsc エラー 0 |
| **10-C** | data/ + stubs/engineStub.ts + zustand 3 store + persist | 1.5 日 | vitest 全 store + engineStub テスト緑、persist round-trip OK |
| **10-D** | router/ + MetaShell + 280ms フェード遷移 | 0.5 日 | 全ハッシュ遷移動作 + 視認可能なフェード |
| **10-E** | HomeScreen + SetupScreen + ResultScreen | 3 日 | HOME→SETUP→(simulateMatch)→RESULT golden path + history 1 件 |
| **10-F** | DeckEditor + CardsScreen | 3 日 | カスタムデッキ persist → SETUP で選択可能 / カード 47 枚表示 |
| **10-G** | HistoryScreen + ReplayScreen | 2 日 | 履歴リスト + 詳細 → REPLAY 遷移 + 集計表示 |
| **10-H** | TutorialScreen + SettingsScreen + F-audit 反映 | 2 日 | 6 章遷移 + 章 04 + デモ起動 + 設定 persist |
| **10-I** | キーボードショートカット + NavHUD + ヘルプ | 1 日 | 全ショートカット動作 + `?` でヘルプ |
| **10-J** | Playwright e2e + smoke baseline | 1.5 日 | 全画面 e2e 緑 + console error 0 |

各 Phase 完了時に Conventional Commit + `.claude/changelog-entries/2026-MM-DD-phase-10-N-*.md` エントリ。

## F-rule-audit 残課題 担当 Phase

| 修正内容 | Phase | 詳細 |
|---|---|---|
| targetEv 7/6 修正 | 10-E | engineStub.flow.simulateMatch + ResultScreen で `p1Target/p2Target` 表示 |
| チュートリアル章 04 追加 | 10-H | 解決編 + アシスト勝利不可 |
| ヒラメキ図解一般化 | 10-H | 「キャラ1枚をアクティブ」→「カード固有効果」 |
| 用語注釈 (事件カード vs FILE) | 10-H | TutorialScreen + ReplayScreen 注釈追加 |

## 検証手順

### 開発中の自動検証 (各 Phase 完了時)

```bash
# Phase 10-A
npm run dev:meta              # 5174 起動確認
# Phase 10-B
npm run dev:meta              # demo page で各 component 視認
# Phase 10-C
npx vitest run meta-app/src   # 全 store + engineStub unit test
# Phase 10-D
npm run dev:meta              # ハッシュ遷移 10 ルート確認
# Phase 10-J
npm run test:meta:e2e         # Playwright 全 spec
```

### Phase 10 全体の golden path 検証 (Playwright headed, 手動)

#### 既存ゲーム不変保証 (前提)
1. `npm run dev` → `localhost:5173` で既存 GameSetupModal → デッキ選択 → 1 試合通せる
2. 既存 `tests/` 全件 green (`npm test` で確認)
3. `src/` 配下に変更 0 (`git status` で確認)

#### メタ UI 全画面検証
1. 別ターミナルで `npm run dev:meta` → `localhost:5174`
2. HOME 表示 → 「推理開始」 → SETUP
3. デッキ選択 (SAMPLE_DECK) → READY → MATCH 画面で simulateMatch → RESULT 自動遷移
4. RESULT の MVP / 統計表示確認 + p1Target=7 (or 6) 表示
5. HISTORY 画面で記録 1 件確認
6. DECK 編集 → 新規デッキ作成 → 40 枚 + ID制限満たして「保存」 → SETUP で選択可能
7. CARDS で 47 枚グリッド + フィルター動作 + 採用デッキ数表示
8. TUTORIAL 章 04 表示 + ヒラメキデモ起動可能
9. SETTINGS で theme/speed/density 変更 → 再起動後も保持 (persist)
10. キーボード H/D/C/T/S/P/M/R/Y/L/Enter/Esc/? 全動作
11. **console error 0 件 / Playwright network error 0 件**
12. DevTools Application タブで `conan.meta.v1.*` キーのみ書き込みされ、既存ゲームの localStorage キーは無干渉

### Round 4a Phase 6.3 準拠 (CLAUDE.md 要求)

- 1 試合通し検証 (HOME → SETUP → simulateMatch → RESULT → HISTORY) を meta-app で完走
- 静的 screenshot だけでなく click → state 反映を実機で確認
- 各 step で console error 0 確認
- 「画面表示確認 ≠ 機能確認」遵守 (両方必要)

### スモークテスト基準

- `meta-app/tests/e2e/` に 9 画面 × 各 golden path 1 件 = 9 spec を最低限作成
- 各 spec の所要時間 30 秒以内
- 全 spec の合計実行時間 5 分以内

### バグ管理 (Round 4a 運用)

- 統合中に発見したバグは即座に `.claude/bugs/BUG-XXX.md` 起票
- BUG-XXX.md の frontmatter: `id` / `severity` / `category` (UI / engine-stub / persist 等) / `status` / `round: phase-10-X` / `date_found`
- Phase 10 完了時に `.claude/bugs/AUDIT-2026-06.md` (audit) を作成

## 完了基準 (Phase 10 終結時)

- ✅ `.claude/specs/meta-ui/` 配下 11 ファイル (10 spec + INDEX) 完成
- ✅ `meta-app/` 配下 全コード完成、`npm run dev:meta` + `build:meta` 緑
- ✅ `meta-app/tests/e2e/` 9 spec 緑
- ✅ 既存 `src/` 変更 0、既存 `tests/` 全件 green
- ✅ `.claude/specs/INDEX.md` に Phase 10 spec 登録
- ✅ `.claude/changelog-entries/2026-MM-DD-phase-10-meta-app.md` 10 エントリ
- ✅ F-rule-audit 残課題 4 件全消化
- ✅ `.claude/auto/structure.md` 再生成

## 関連
- 前: [08-screens-reference.md](08-screens-reference.md)
- 上位 INDEX: [INDEX.md](INDEX.md) / `.claude/specs/INDEX.md`
