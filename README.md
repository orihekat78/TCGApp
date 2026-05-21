# 名探偵コナンTCG Web アプリケーション

ローカルで「人間 vs CPU」「CPU vs CPU」が遊べる、
名探偵コナントレーディングカードゲーム（タカラトミー公式）の **個人利用限定** Webアプリ。

> ⚠️ 本プロジェクトは個人利用・私的使用に限定された非公式ファンプロジェクトです。
> 公開・配布は行いません。
> © 青山剛昌／小学館 © TOMY

## 現在の状況（2026-05-20）

**Round 4l 完了** ✅ — UI 4 課題一括対応 (BUG-001 カード拡大 modal + BUG-002 edition tag 隙間 + BUG-010 opp turn 可視化 + B5 観戦モード新機能)。**未着手 BUG ゼロ達成** 🎉。Round 2 (18 バグ全解消) + Round 3 (B4/B7) + Round 4 (engine 重大バグ修正 + RCA + Obsidian Base 化 + driver reactivity + E2E 基盤 + 47 カード E2E 計 6 パターン + engine keyword resolver + データ整合性 + listener gap 検出/修正 + dev-mode bug + test-isolation + Phase 7 gap 登録) + Phase 7 ($pick auto-resolution 完成) + Round 4l (UI 4 課題) で **計 34 連続 commit**:

- Round 2 (commits `e61bb7f` 〜 `d343fde`): startTurn 統一 / TopBar 動的 / 引き直し UI / 手札 UX / picker glow / FILE/証拠/リムーブ モーダル / ログ閉じる + 日本語化 / チュートリアル「次へ」修正
- Round 3a (commits `8161efb` + `d15b495`): 事件 stamp 削除 + edition tag 独立 / 手札 scrollbar 完全削除 / FileArea+modal / 手札 grayscale / next-hint engine bug fix / event カード組込
- Round 3b (`ccdd4b5`): LogPanel を HandZone 同等の fixed overlay + 透明 backdrop click 閉 + scrollbar thin + fade-in + role/aria
- Round 3c (commits `f362175` + `c8118d0`): B7 チュートリアル矢印機構 (border + glow pulse + ▼▲◀▶ + createPortal) + 全 33 step マッピング (25 target + 8 skip)
- Round 4a (`e10b3a4`): **RCA + 水平展開** + 重大バグ engine 3 fix (BUG-008 イベントカード手札残留 / BUG-009 FILE 7+ 解決編移行 / next-hint 水平展開) + リスク・バグ管理 **Obsidian Base** 化 (`.claude/bugs/` + 2 base) + 再発防止 spec (`card-addition-checklist.md` / `dispatch-to-state.test.ts` / CLAUDE.md §セルフレビュー追記)
- Round 4b (`4c64c79`): triggered ability **汎用 listener** 整備 (`src/engine/listeners/triggered.ts` 新規、7 hook 配線、emit payload kind 分離で eventRemoveByAP matcher と整合)
- Round 4c (`d54e328`): **BUG-006 修正** (store.dispatch で same-reference 時 shallow copy 強制 → ContactFlowDriver useEffect を起動) + **`@playwright/test` 実機 E2E 基盤** (`playwright.config.ts` + `tests/e2e/bug-006.spec.ts` + `window.__game` DEV expose) + dispatch-to-state.test.ts に BUG-006 2 case 追加
- Round 4d (`f38268c`): Playwright **headed default** (`headless: !!process.env.CI`) で「真っ白」問題解消 + Round 2 18 件バグを **BUG-011〜BUG-028** に履歴移行 + **BUG-029**「現場カード sleep 反映なし」は Round 4c で副次解消と確定し Vitest 統合 2 + E2E 2 で回帰防止
- Round 4e Phase 1 (`cf3380c`): **tests/e2e/helpers/** 共通基盤 (types/setup/state/assertions/index) + **cutinFixedAP** 共通クラス使用 6 カード (D08015/D08017/D08023/D11017/D11018/D11019) の E2E spec 化、全 pass
- Round 4f Phase 2 (`4eb103a`): **partnerColorKeyword** 共通クラス使用 5 カード (D08009/D08022/D11007/D11009/D11011) を E2E spec 化、6 テスト (5 positive + 1 negative) 全 pass + **BUG-030** (engine `read.char.keywords` が continuousModifier.grantKeywords を resolve しない、Phase 5 未実装) を登録
- Round 4g (`3932d04`): **BUG-030 engine 修正** — `src/engine/read/char.ts` の `keywords()` に continuous modifier resolver を実装、unit test +5、E2E spec 4-layer 拡張。smoke baseline 525/475 (1 game shift、avg turns 10.35→9.85 positive 変化)
- Round 4h (`08621c0`): **caseTraitConditioned** 2 カード (D11003 a2 / D11005 a1) を E2E spec 化、4 テスト (2 positive + 2 negative) 全 pass + **BUG-031** data fix (`src/cards/ct-d11/D11021.ts` の traits に '婚活' 追加、engine データ不整合修正)
- Round 4i (`8d35359`): **eventRemoveByAP** 2 カード (D08025 factory pure / D11020 individual sequence) を E2E spec 化、4 テスト全 pass + dispatch 経路で **engine listener gap 2 件検出** → **BUG-032** (`eventRemoveByAP` trigger.selfOnly 未設定 → opp 手札の同 cardId が誤発動) / **BUG-033** (triggered.ts handleHook が ability.condition 未評価) 登録
- Round 4i-fix (`6a372a9`): **BUG-032/033 engine 修正** — `eventRemoveByAP` factory + D11019/D11020/D08024 a1 に `selfOnly:true` 水平展開、`selfOnlyMatches` の hand 経路に player 比較追加、`triggered.ts handleHook` に condition gate (`evalCond`) 追加
- Round 4j (`4dd2cd8`): **hiramekiDraw** 2 カード shape E2E (3 tests) + **BUG-034** 登録 + **共通パターン spec 5/5 完了** 🎉
- Round 4j-fix (`52f2b61`): **BUG-034 真因再診断** → `useHiramekiFlowDriver` の auto-resolve race が真因 → fixture 反転で test-isolation、hirameki-draw.spec.ts 3 → 7 tests に拡張 + 防御的改善 (globalThis 側 side-channel + engine namespace re-export + misread 水平展開)
- Round 4k (`f50028f`): **hiramekiCharStun** 2 カード E2E (D08019 a2 / D11009 a3) + **BUG-035** 登録 + 共通パターン spec **6/5 拡張**
- Phase 7-1 (`4bf79a1`): BUG-035 hirameki 経路最小修正 + 共通パターン spec 6/6 達成
- Phase 7-2 (`3f50e99`): BUG-035 汎用 $pick substitution 完成 (`resolveEffectPicks` utility) + 9 cards 完全カバー
- Round 4l (本セッション): **UI 4 課題一括** — BUG-002 (edition tag 隙間 1-line CSS fix) + BUG-001 (`CardExpandModal` + `useCardExpandModal` hook + Playmat onExpand 配線、3 zone click で拡大表示) + BUG-010 (OppTurnOverlay action 表示 + MAX_MOVES 安全上限 200 手 明示) + **B5 観戦モード新機能** (`spectatorMode` store field + `useSpectatorTurnDriver` + GameSetupModal 「観戦モード (AI vs AI)」button)。**未着手 BUG ゼロ達成** 🎉

1000戦 smoke は **0 timeout / 0 例外 / 勝率 52.5 vs 47.5 (Round 4g 以降の baseline 525/475 維持、avg 9.85 ターン)**。
残課題: Phase 9-F.2 (MCTS strength tuning) / Phase 9-G.2 (リプレイ UI) / Phase 5 advance UI 残 (Misread UI / Souza Sub-task B+C) / Cleanup (隠れタスク 9 件)。Phase 9-H 計測 + Phase 9-F MCTS infra + Phase 9-G.1 リプレイ engine 側 は完了。

### MVP 実装プラン進捗 ([詳細](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md))

| Phase | 内容 | 状態 |
|------|-----|-----|
| 0-6 | Engine + 47 カード + AI | ✅ 完了 |
| 7 + 7.5 | UI Shell (12 components + cardResolvers + App 統合) | ✅ 完了 |
| 8.1-8.10 + 完全クローズ | hooks / per-step dispatch / Hirameki / 各種 modal / E2E | ✅ 完了 |
| 9-A | 1000戦 smoke baseline ([smoke-2026-05-17.md](.claude/reports/smoke-2026-05-17.md)) | ✅ 完了 |
| 9-B | engine 4 バグ修正 + Heuristic チューニング + hotfix (node:fs 分離) | ✅ 完了 |
| 9-C | カード画像 UI 統合 (CardArt + useCardImage) | ✅ 完了 |
| 9-D | case 向き auto-detect / partner 拡大 / hand 色あせ / Remove 画像 / Evidence↔FILE swap | ✅ 完了 |
| 9-E | deck low-stock / FILE progress-7 完了 / opp 手札 mini back 統一 | ✅ 完了 |
| Phase 5 advance prep | [guardrails spec](.claude/specs/2026-05-17-phase5-advance-guardrails.md) 起草 (`5cdc3bb`) | ✅ 完了 |
| Phase 5 advance: SceneSwitch | rules/20 §スイッチ engine + AI + UI (`6625283` / `1421772`) | ✅ 完了 |
| Phase 5 advance: Hirameki | rules/10 E2E 結合 + listener bug fix (`75fe5f4`) | ✅ engine 完了 |
| Phase 5 advance: Misread | rules/13 §ミスリード E2E (Human defender) + bug fix (`9070556`) | ✅ engine 完了、UI 残 |
| Phase 5 advance: Souza | rules/13 §捜査X engine atom + AI auto-order (`59183f4`) | ✅ engine 完了、Sub-task B/C 残 |
| Round 2 UI/UX 修正 | Human-vs-CPU 18 バグ全解消 (`e61bb7f` 〜 `d343fde`) | ✅ 完了 |
| Round 3a UI 追加修正 | 12 項目中 9 件解消 (B3/B6/B9/B11/B12/A8/A1/A10) (`8161efb` + `d15b495`) | ✅ 完了 |
| Round 3b UI 追加修正 | B4 LogPanel HandZone パターン化 (fixed overlay + 透明 backdrop + scrollbar thin + fade-in) (`ccdd4b5`) | ✅ 完了 |
| Round 3c UI 追加修正 | B7 チュートリアル矢印機構 + 全 33 step マッピング (25 target + 8 skip) (`f362175` + `c8118d0`) | ✅ 完了 |
| Round 4a 重大バグ修正 + RCA | BUG-008/009 + 水平展開 next-hint + Obsidian Base 化 + 再発防止 spec (`e10b3a4`) | ✅ 完了 |
| Round 4b 機構整備 | triggered ability 汎用 listener (7 hook) + emit kind 分離 (`4c64c79`) | ✅ 完了 |
| Round 4c BUG-006 修正 + E2E 基盤 | driver reactivity 修正 (`src/ui/state/store.ts`) + `@playwright/test` 導入 + dispatch-to-state.test.ts BUG-006 2 case (`d54e328`) | ✅ 完了 |
| Round 4d Playwright 可視化 + 履歴移行 + BUG-029 | headed default + BUG-011〜028 履歴化 + BUG-029 回帰防止 (`f38268c`) | ✅ 完了 |
| Round 4e Phase 1: E2E helpers + cutinFixedAP | tests/e2e/helpers/ + cutin-fixed-ap.spec.ts 6 カード集約 (`cf3380c`) | ✅ 完了 |
| Round 4f Phase 2: partnerColorKeyword + BUG-030 | partner-color-keyword.spec.ts 6 テスト + engine 未実装ギャップ登録 (`4eb103a`) | ✅ 完了 |
| Round 4g: BUG-030 engine 修正 | read.char.keywords に continuous modifier resolver 実装 + unit test 5 + spec 4-layer 拡張 (`3932d04`) | ✅ 完了 |
| Round 4h: caseTraitConditioned + BUG-031 | case-trait-conditioned.spec.ts 4 tests + D11021 traits '婚活' data fix (`08621c0`) | ✅ 完了 |
| Round 4i: eventRemoveByAP + BUG-032/033 検出 | event-remove-by-ap.spec.ts 4 tests + listener gap 2 件登録 (`8d35359`) | ✅ 完了 |
| Round 4i-fix: BUG-032/033 engine 修正 | selfOnly 水平展開 + selfOnlyMatches player check + handleHook condition gate + unit/E2E +4 (`6a372a9`) | ✅ 完了 |
| Round 4j: hiramekiDraw shape + BUG-034 検出 | hirameki-draw.spec.ts 3 tests + 共通パターン 5/5 (`4dd2cd8`) | ✅ 完了 |
| Round 4j-fix: BUG-034 真因再診断 + spec 拡張 + misread 水平展開 | fixture 反転で test-isolation + 7 tests + globalThis + engine re-export (`52f2b61`) | ✅ 完了 |
| Round 4k: hiramekiCharStun + BUG-035 登録 | hirameki-char-stun.spec.ts 7 tests + $pick auto-resolution Phase 7 deferred (`f50028f`) | ✅ 完了 |
| Phase 7-1: hirameki 経路 $pick 最小修正 | resolveHiramekiPick + fire test を sleep 検証に upgrade + 共通パターン 6/6 達成 (`4bf79a1`) | ✅ 完了 |
| Phase 7-2: 汎用 $pick substitution + 9 cards 完全カバー | recursive `resolveEffectPicks` utility + triggered.ts/hiramekiResolve retrofit + unit +9 (`3f50e99`) | ✅ 完了 |
| Round 4l: UI 4 課題一括対応 | BUG-001/002/010 + B5 観戦モード新機能 (`5716953`) | ✅ 完了 |
| Phase 7-3: AI policy `chooseAtomTarget` verb 別ヒューリスティック | sceneRemove/sceneSetState/charModifyAP/charModifyLP 別戦術 + unit 14 + E2E 期待更新 (`2b49942`) | ✅ 完了 |
| Phase 9-H: パフォーマンス計測 | `MatchOpts.profile` + `--profile` smoke + `npm run benchmark` + per-turn p50/p95/p99 (`3d6c103`, avg 0.19ms / 100ms target の 200x 余裕) | ✅ 完了 |
| Phase 9-F MVP: MCTSPolicy (rollout-based) | `src/ai/policies/mcts.ts` + MCTS vs Heuristic ベンチ (`3836d65`, ⚠️ 33% vs 63% で AI 強度低下、9-F.2 で tuning 予定) | ✅ MVP 完了 |
| Phase 9-F.2: MCTS strength tuning | UCB1 tree + 静的評価関数 + 並列化 | ⏳ |
| Phase 9-G.1: リプレイ機構 engine 側 | `src/ai/replay/{recorder,player}.ts` + record→replay 完全再現 (本セッション) | ✅ 完了 |
| Phase 9-G.2: リプレイ UI 層 | ReplayPanel / useReplayDriver / GameSetupModal mode | ⏳ |
| Phase 9-G: リプレイ機構 | recorder/player + ReplayPanel UI | ⏳ |
| Phase 5 advance UI 残 | Misread UI / Souza Sub-task B+C | ⏳ |

### テスト状況

- **1511 PASS + 1 skipped / 196 Test Files** (Phase 9-G.1 完了時点、replay/recorder.test.ts +6)
- **E2E 38 pass + 1 skipped** (bug-006 1 + bug-029 2 + cutinFixedAP 6 + partnerColorKeyword 6 + caseTraitConditioned 4 + eventRemoveByAP 5 + hiramekiDraw 7 + hiramekiCharStun 7 = 38)
- **1000戦 smoke baseline 525/475 完全維持** (Round 4g 以降不変、avg turns 9.85、Round 4j で副作用なし)
- 1000戦 AI vs AI smoke (heuristic × heuristic): **0 invariant failure / 0 例外 / 0 timeout / 3.3 s**
  - A 勝率 52.5% / B 勝率 47.5% / 平均 9.85 ターン (Round 4g 以降の **baseline 525/475 を Round 4l も維持**、Round 2-Round 4l 全 34 commit で regression 0)
- `npm run typecheck` 通過 / `npm run docs:check` クリーン
- `npm run dev` で http://localhost:5173/ — 公式 CDN 画像付きの人間 vs CPU が end-to-end でプレイ可能
- リスク・バグ管理: `.claude/bugs/index.base` を Obsidian で開いて全バグ集約 view (Round 4a 導入)
- 骨格凍結原則: Round 4a/4b の engine 修正は §例外「公式ルール準拠のためのバグ修正」に該当

### 調査フェーズ完了済 (実装の前提)

ルール集 (Ver 2.4 + Q&A 30ファイル) / 法務スタンス / カードデータ取得方法 /
アーキテクチャ判断 / UX設計 / チュートリアル設計 / UI仕様 16ファイル /
カード分析 47枚 / 共通クラス候補 9 / Engine API spec 17ファイル

詳細: [.claude/specs/INDEX.md](.claude/specs/INDEX.md), [.claude/research/](.claude/research/)

## プロジェクト要件

- **対象ゲーム**: 名探偵コナントレーディングカードゲーム（タカラトミー公式・2024〜）
- **MVP対象デッキ**:
  - CT-D08「青の古城探索事件」(Case-ThemeDeck 03)
  - CT-D11「千速と重悟の婚活パーティー」(Case-ThemeDeck 06)
- **技術スタック**: TypeScript 5 + React 18 + Vite + Immer + Vitest + Zustand
- **アーキテクチャ**: 純粋ロジック Engine (React 非依存) + Effect Descriptor DSL + Hook 機構
- **CPU AI**: Random / Heuristic 切替（将来 MCTS）
- **将来スコープ**: 全カード対応

## ドキュメント構成

- **[HUB.md](HUB.md)** — 🔍 全ドキュメントへのナビゲーションハブ（Obsidian推奨）
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — プロジェクト規約（骨格凍結原則 / 設計レビュー手順）
- [.claude/memory.md](.claude/memory.md) — 現セッション作業ログ
- [.claude/rules/INDEX.md](.claude/rules/INDEX.md) — 公式ルール集 (Ver 2.4 + Q&A裁定 + フロアルール)
- [.claude/specs/INDEX.md](.claude/specs/INDEX.md) — Engine API / UI / カード分析 全 spec
- [.claude/research/plans/2026-05-11-mvp-implementation/](.claude/research/plans/2026-05-11-mvp-implementation/) — MVP 実装プラン (10 Phase)
- [.claude/sessions/](.claude/sessions/) — 過去セッションのアーカイブ
- [.claude/auto/README.md](.claude/auto/README.md) — 🤖 自動生成ドキュメント運用ガイド（Phase 2以降でAPI/state/flows/progress/mappingを生成）

### Engine ソース ([src/engine/](src/engine/))

`engine.read` / `mutate` / `invariant` / `event` / `effect` / `dyn` / `target` /
`cost` / `cond` / `resolve` / `flow.{setup,runAutoPhase,main,action,contact,actionCase,guard,handUseCard,nextHint,partner,declared,reasoning,endTurn}` の
namespace 構成。詳細は [HUB.md](HUB.md) と [.claude/auto/](.claude/auto/) の自動生成 API ドキュメント参照。

## 法務スタンス（重要）

- **完全ローカル限定運用**（個人PC内のみ）
- カード画像はリポジトリ非同梱・実行時公式サイトから取得・キャッシュ
- 公開ホスティング・GitHub公開（カード画像同梱）禁止
- 詳細: [.claude/research/legal/04-recommendation.md](.claude/research/legal/04-recommendation.md)

## 開発ガバナンス

- 全Markdownファイル 100行以内
- 作業時は `.claude/memory.md` に必ず追記
- 骨格凍結原則: カード効果のための engine 修正禁止 → `cards/_shared/` に共通クラスで吸収
- ユーザーレビュー前に Claude 自身が **セルフレビュー + 水平展開調査** を実施
- 詳細: [.claude/CLAUDE.md](.claude/CLAUDE.md)

## このREADMEの運用

各 Phase 完了時に「現在の状況」テーブルとテスト状況を更新する。
