# 名探偵コナンTCG Web アプリケーション

ローカルで「人間 vs CPU」「CPU vs CPU」が遊べる、
名探偵コナントレーディングカードゲーム（タカラトミー公式）の **個人利用限定** Webアプリ。

> ⚠️ 本プロジェクトは個人利用・私的使用に限定された非公式ファンプロジェクトです。
> 公開・配布は行いません。
> © 青山剛昌／小学館 © TOMY

## 現在の状況（2026-05-20）

**Round 4i-fix 完了** ✅ — BUG-032 / BUG-033 engine 修正 (selfOnly 水平展開 + triggered.ts condition gate)。Round 2 (18 バグ全解消) + Round 3 (B4/B7) + Round 4 (engine 重大バグ修正 + RCA + Obsidian Base 化 + driver reactivity 修正 + E2E 基盤 + 47 カード E2E 計 4 パターン + engine keyword resolver + データ整合性修正 + listener gap 検出 + listener gap 修正) で **計 28 連続 commit**:

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
- Round 4i-fix (本セッション): **BUG-032/033 engine 修正** — `eventRemoveByAP` factory + D11019/D11020/D08024 a1 に `selfOnly:true` 水平展開、`selfOnlyMatches` の hand 経路に player 比較追加、`triggered.ts handleHook` に condition gate (`evalCond`) 追加。unit test +3 / E2E +1 / smoke 525-475 完全維持

1000戦 smoke は **0 timeout / 0 例外 / 勝率 52.5 vs 47.5 (Round 4g 以降の baseline 525/475 維持、avg 9.85 ターン)**。
残課題: Round 4j (hiramekiDraw) / Round 4k (hiramekiCharStun) / Round 4l+ UI (BUG-001/002/010 + 旧 B5 観戦モード) / origin push (本セッション末で sync 予定)。

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
| Round 4i-fix: BUG-032/033 engine 修正 | selfOnly 水平展開 + selfOnlyMatches player check + handleHook condition gate + unit/E2E +4 (本セッション) | ✅ 完了 |
| Round 4j+: 残り共通パターン | hiramekiDraw / hiramekiCharStun | ⏳ |
| Round 4c UI 残 | BUG-001 拡大表示 / BUG-002 edition tag 隙間 / BUG-010 opp turn 可視化 + 旧 B5 観戦モード | ⏳ |
| 9-F〜H | AI 強化 (MCTS) / リプレイ / パフォーマンス計測 | ⏳ |

### テスト状況

- **1467 PASS + 1 skipped / 192 Test Files** (Round 4i-fix 完了時点、unit test +3 = BUG-032 1 + BUG-033 2)
- **E2E 24 pass + 1 skipped** (bug-006 1 + bug-029 2 + cutinFixedAP 6 + partnerColorKeyword 6 + caseTraitConditioned 4 + eventRemoveByAP 5 = 24)
- **1000戦 smoke baseline 525/475 完全維持** (Round 4g 以降不変、avg turns 9.85、Round 4i-fix の engine 修正で副作用なし)
- 1000戦 AI vs AI smoke (heuristic × heuristic): **0 invariant failure / 0 例外 / 0 timeout / 3.3 s**
  - A 勝率 52.5% / B 勝率 47.5% / 平均 9.85 ターン (Round 4g 以降の **baseline 525/475 を Round 4i + 4i-fix も維持**、Round 2-4i-fix 全 28 commit で regression 0)
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
