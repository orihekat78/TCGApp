# Changelog

> ⚠️ このファイルは `scripts/gen-docs/gen-changelog.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:changelog`
> Source hash: `0ea9892bd1bb`

「何ができたか」を時系列で記録する。個別エントリのソースは [`.claude/changelog-entries/`](.claude/changelog-entries/) にあり、Phase / Round 完了時にそこへファイルを追加する。日次の詳細ログは [`.claude/sessions/`](.claude/sessions/) に、現セッション scratchpad は [`.claude/memory.md`](.claude/memory.md) にある。形式は [Keep a Changelog](https://keepachangelog.com/) に準拠 (セマンティックバージョン番号は採用せず Phase/Round 名で区切る)。日付は Asia/Tokyo (YYYY-MM-DD)。

## [Unreleased]

### 残課題

- Phase 9-F.2: MCTS strength tuning (UCB1 tree + 静的評価関数 + 並列化)
- Phase 9-G.2: リプレイ UI 層 (ReplayPanel / useReplayDriver / GameSetupModal mode)
- Cleanup Phase 中/大規模 5 件 — #1 動的式評価括弧 / #2 cost picker / #3 ヒューリスティック / #6 Playmat レスポンシブ / #9 listener 漏れ
- ~~user_request 20260521_01 triage 残 4 件~~ → **全 18 件 完了** (Phase δ + ε で #3 / #12 / #18 解決)
- Phase 5 advance UI 残 — Misread UI / Souza Sub-task B+C

## user_request 20260521_01 triage Phase ε — #18 card audit umbrella (2026-05-22)

commit `9f126c7`。#18「カードごとに個別実装した処理がきちんと機能していない
(umbrella)」を audit。

### 結論

**新規 BUG 起票無し**。Phase α/β/γ (BUG-040/041/045 修正) で実質的に解決済
であることを 3 軸で確認。

### Audit 結果

- **vitest tests/cards/**: 46 test files / 176 tests 全 PASS
- **playwright tests/e2e/patterns/**: 35 pattern tests 全 PASS
- **smoke 1000 戦**: avg 10.64 turn / p95 13 / 0 timeout / 0 exception

CT-D08 27 枚 + CT-D11 22 枚を P1 (declared) / P2 (appear) / P3 (contact-effect)
/ P4 (no-test) で分類、Tier 1 (multi-pattern) 7 枚 / Tier 2 (P1 単体) 9 枚 /
Tier 3 (P2 単体) 8 枚 はすべて既存テスト + smoke で機能確認。

P4 (no-test) 13 枚は全て **絵柄違い variant** (`...DXXXXX` で他カードの def
継承) または **能力なし partner** (D08002)。独立テスト不要であることを確認。

詳細は [.claude/specs/cards-analysis/AUDIT-USER-REQUEST-18.md] 参照。

### user_request 20260521_01 全 18 件 完了 🎉

| Phase | 件数 | 内容 |
|-------|------|------|
| α | 6 件 | #2 / #5 / #6 / #10 / #11 / #14 (公式裁定確認 + 運用 doc 整備) |
| β | 6 件 | #1 / #4 / #7 / #8 / #13 / #15 / #16 / #17 (BUG-037〜044) |
| γ | 1 件 | #9 (BUG-045 1 試合通し E2E + spectator stall) |
| δ | 2 件 | #3 (contact UX) / #12 (spectator HUD + heuristic) |
| ε | 1 件 | #18 (card audit umbrella) |

## user_request 20260521_01 triage Phase δ — #3 contact UX + #12 spectator HUD (2026-05-22)

commits `cc3a605` / `98efb82` / `49a7063` / `4b654fd` / `25589ad` / `f1b3ebc`。
#3 contact UI driver と #12 spectator speed / hand-use heuristic を解決。

### #3 相手ターン中の contact 処理 — verify + UX 改善

- BUG-044 (`5ffed7c`) と BUG-045 (`9169af4`) の修正で構造的に動作することを
  Playwright headed + 既存 vitest (useContactFlowDriver.test.ts) で確定
- `OppTurnOverlay` を強化: activeActionId 中は attacker → target (phase 名)
  を具体表示 (cc3a605)
- E2E spec `tests/e2e/opp-turn-contact.spec.ts` を新規 (98efb82): 3 シナリオ
  (guard modal / cutin modal / case ターゲット表示) で回帰防止

### #12 観戦モード speed + AI 手札使用 改善

- `store.aiSpeedMs` + `SpectatorHUD` 新規: 200/400/800/1500/3000ms の
  5 preset + 現在値表示 (49a7063)
- `store.isAiPaused` + `aiStepCounter` + pause/step ボタン: paused 中は AI
  進行停止、step button で 1 cycle (opp + self) 進める (4b654fd)
- `handUseCard` heuristic を sparse-aware 化: scene < 3 で character を
  AP+LP*1.5 score で優先、scene >= 3 で event 優先 (25589ad)
- E2E spec `tests/e2e/spectator-speed.spec.ts` (f1b3ebc): 3 シナリオ

### Metrics

- smoke 1000 戦: avg 11.19 → 10.64 (アグレッシブ化 / max 19→16 で variance 改善)
  winsA 50% → 51.1% (許容範囲)
- ユニット 1522 PASS / 1 skipped (改修前から +9 tests)
- E2E 48 PASS / 1 skipped (改修前 42 から +6 = 3 opp-turn-contact + 3 spectator-speed)

## Round 4l — UI 4 課題一括対応 (2026-05-22)

commit `5716953`。**未着手 BUG ゼロ達成** 🎉

### Added
- BUG-001 カード拡大 modal: `CardExpandModal` + `useCardExpandModal` hook + Playmat onExpand 配線で 3 zone click で拡大表示
- B5 観戦モード: `spectatorMode` store field + `useSpectatorTurnDriver` + GameSetupModal「観戦モード (AI vs AI)」 button
- BUG-010 OppTurnOverlay action 表示 + MAX_MOVES 安全上限 200 手 明示

### Fixed
- BUG-002 edition tag 隙間 (1-line CSS fix)

## user_request 20260521_01 triage Phase γ — 1 試合通し E2E + spectator stall (2026-05-22)

BUG-045 として user_request #9 + 観察「コンタクトでカットインポップアップで
止まる」を一括対応。E2E で更に engine bug 2 件発覚 → 即修正。

### Added
- `tests/e2e/full-match.spec.ts` — spectator mode で mulligan → 終局 (or
  max-turn) まで一貫検証する 1 試合通し E2E。今後の「Playmat 配線漏れ」
  pattern 予防

### Fixed
- BUG-045 spectator AI vs AI で contact 発生時 cutin/guard modal hang →
  `useContactFlowDriver` に `spectatorMode` 委譲を追加、self も AI 判定
- engine `deckRevealUntil` atom: filter object を function として呼んでいた
  `TypeError: filter is not a function` → TargetFilter → predicate 変換 helper
- engine `discard` atom: target pick query を string[] 扱いで
  `TypeError: ids is not iterable` → 防御 skip (本格対応は別 BUG)

### Notes
- Playwright headed: spectator AI vs AI で turn 12 / winner=self / console
  errors 0 で正常完了
- smoke 1000 maintained: avg 11.19 / 0 timeout / 0 exception
- engine 2 bug は smoke では到達しない atom path、E2E が初めて検出

## user_request 20260521_01 triage Phase α + β (2026-05-22)

ユーザー指摘 18 件のうち **13 件解決**。

### Fixed
- `9567c0c` BUG-037 SceneArea.css animation fill-mode (sleep CSS、#1 / #16)
- `152253d` BUG-038 仕様外 close (BUG-037 で間接解決、#7)
- `d823f7f` BUG-040 Playmat.tsx `declaredTargetCount` ハードコーディング修正 (declared ability、#15)
- `a96f900` BUG-041 `canUse` に switch fallback 追加 (hand-use switch、#13)
- `cd2d161` BUG-043 HandZone 右クリック → CardExpandModal (hand expand、#8)
- `5ffed7c` BUG-044 heuristic に reasoning vs case attack スコア比較、「劣勢時 disruption only」(AI case attack、#4)

### Added
- `db0cd9b` BUG-042 GameSetupModal にデッキ選択 dropdown 追加、`buildDeckPair({selfDeckId, oppDeckId})` 新 API (deck select、#17)

### Changed
- `8d33d03` Phase α 6 件 (#2 #5 #6 #10 #11 #14): 公式裁定確認 + 運用 doc 整備
  - `.claude/docs/user-request-clarifications.md` 新設 (#5 解決編 / #6+#14 NH は公式 PDF p.12-13 引用で「現実装が正しい」と確定)
  - `.claude/specs/DEFERRED-INDEX.md` / `.claude/bugs/README.md` 新設
  - CLAUDE.md「効率より精度」方針追加 (#2)

### Notes
- **主要パターン発見**: BUG-040/041/042/043 すべて「engine + flow + picker は完成しているのに Playmat.tsx の prop 配線漏れで UI 側だけ動かない」同一 pattern (4 件)
- 残 5 件は規模大で別セッション (#3 contact UI driver / #9 E2E / #12 AI speed slider / #18 audit umbrella)

## Phase 7-3 — AI policy verb 別ヒューリスティック (2026-05-21)

commit `2b49942`。

### Changed
- AI policy `chooseAtomTarget` を verb 別ヒューリスティックに分割: sceneRemove / sceneSetState / charModifyAP / charModifyLP 別戦術
- unit test +14、E2E 期待更新

## Phase 9-H — パフォーマンス計測 (2026-05-21)

commit `3d6c103`。avg 0.19ms / 100ms target の 200x 余裕。

### Added
- `MatchOpts.profile` + `--profile` smoke オプション
- `npm run benchmark` + per-turn p50/p95/p99 計測

## Phase 9-G.1 — リプレイ機構 engine 側 (2026-05-21)

commit `6e835f8`。

### Added
- `src/ai/replay/recorder.ts` + `player.ts`
- record → replay 完全再現

## Phase 9-F MVP — MCTSPolicy (rollout-based) (2026-05-20)

commit `3836d65`。⚠️ 33% vs 63% で AI 強度低下、Phase 9-F.2 で tuning 予定。

### Added
- `src/ai/policies/mcts.ts`
- MCTS vs Heuristic ベンチマーク

## Phase 7-2 — 汎用 $pick substitution (2026-05-20)

commit `3f50e99`。BUG-035 を汎用化、9 cards 完全カバー。

### Added
- recursive `resolveEffectPicks` utility

### Changed
- triggered.ts / hiramekiResolve を resolveEffectPicks にリファクタ
- unit test +9

## Phase 7-1 — hirameki 経路 $pick 最小修正 (2026-05-20)

commit `4bf79a1`。共通パターン spec 6/6 達成。

### Fixed
- BUG-035 hirameki 経路最小修正: `resolveHiramekiPick` + fire test を sleep 検証に upgrade

## Round 4k — hiramekiCharStun (2026-05-19)

commit `f50028f`。共通パターン spec **6/5 拡張**。

### Added
- `hirameki-char-stun.spec.ts` 7 tests (D08019 a2 / D11009 a3)
- BUG-035 登録 ($pick auto-resolution Phase 7 deferred)

## Round 4j-fix — BUG-034 真因再診断 + spec 拡張 (2026-05-19)

commit `52f2b61`。

### Fixed
- BUG-034 真因 = `useHiramekiFlowDriver` の auto-resolve race → fixture 反転で test-isolation
- hirameki-draw.spec.ts 3 → 7 tests に拡張
- 防御的改善: globalThis 側 side-channel + engine namespace re-export + misread 水平展開

## Round 4j — hiramekiDraw shape + BUG-034 検出 (2026-05-19)

commit `4dd2cd8`。**共通パターン spec 5/5 完了** 🎉

### Added
- `hirameki-draw.spec.ts` 3 tests
- BUG-034 登録

## Round 4i-fix — BUG-032/033 engine 修正 (2026-05-19)

commit `6a372a9`。

### Fixed
- BUG-032 `eventRemoveByAP` factory + D11019/D11020/D08024 a1 に `selfOnly:true` 水平展開
- `selfOnlyMatches` の hand 経路に player 比較追加
- BUG-033 `triggered.ts handleHook` に condition gate (`evalCond`) 追加
- unit/E2E +4

## Round 4i — eventRemoveByAP + BUG-032/033 検出 (2026-05-19)

commit `8d35359`。

### Added
- `event-remove-by-ap.spec.ts` 4 tests (D08025 factory pure / D11020 individual sequence)
- BUG-032 (`eventRemoveByAP` trigger.selfOnly 未設定 → opp 手札の同 cardId が誤発動)
- BUG-033 (triggered.ts handleHook が ability.condition 未評価)

## Round 4h — caseTraitConditioned + BUG-031 (2026-05-19)

commit `08621c0`。

### Added
- `case-trait-conditioned.spec.ts` 4 tests (D11003 a2 / D11005 a1)

### Fixed
- BUG-031 D11021 traits に '婚活' 追加 (engine データ不整合修正)

## Round 4g — BUG-030 engine 修正 (2026-05-19)

commit `3932d04`。**smoke baseline 525/475** (avg turns 10.35 → 9.85)。

### Fixed
- BUG-030 `src/engine/read/char.ts` の `keywords()` に continuous modifier resolver 実装
- unit test +5、E2E spec 4-layer 拡張

## Round 4f Phase 2 — partnerColorKeyword + BUG-030 検出 (2026-05-19)

commit `4eb103a`。

### Added
- `partner-color-keyword.spec.ts` 6 tests、5 カード集約 (D08009/D08022/D11007/D11009/D11011)
- BUG-030 登録 (engine `read.char.keywords` が continuousModifier.grantKeywords を resolve しない、Phase 5 未実装)

## Round 4e Phase 1 — E2E helpers + cutinFixedAP (2026-05-18)

commit `cf3380c`。

### Added
- `tests/e2e/helpers/` 共通基盤 (types/setup/state/assertions/index)
- `cutin-fixed-ap.spec.ts` 6 カード集約 (D08015/D08017/D08023/D11017/D11018/D11019)

## Round 4d — Playwright 可視化 + 履歴移行 + BUG-029 (2026-05-18)

commit `f38268c`。

### Changed
- Playwright **headed default** (`headless: !!process.env.CI`) で「真っ白」問題解消
- Round 2 18 件バグを BUG-011〜BUG-028 に履歴移行

### Fixed
- BUG-029「現場カード sleep 反映なし」を Round 4c で副次解消と確定し Vitest 統合 2 + E2E 2 で回帰防止

## Round 4c — BUG-006 修正 + E2E 基盤 (2026-05-18)

commit `d54e328`。

### Fixed
- BUG-006 store.dispatch で same-reference 時 shallow copy 強制 → ContactFlowDriver useEffect を起動

### Added
- `@playwright/test` 実機 E2E 基盤 (`playwright.config.ts` + `tests/e2e/bug-006.spec.ts` + `window.__game` DEV expose)
- dispatch-to-state.test.ts に BUG-006 2 case

## Round 4b — triggered ability 汎用 listener (2026-05-18)

commit `4c64c79`。

### Added
- triggered ability **汎用 listener** (`src/engine/listeners/triggered.ts` 新規、7 hook 配線)
- emit payload kind 分離 (eventRemoveByAP matcher と整合)

## Round 4a — 重大バグ engine 3 fix + RCA + Obsidian Base 化 (2026-05-18)

commit `e10b3a4`。

### Fixed
- BUG-008 イベントカード手札残留
- BUG-009 FILE 7+ 解決編移行
- next-hint 水平展開

### Added
- リスク・バグ管理を **Obsidian Base** 化 (`.claude/bugs/` + 2 base)
- 再発防止 spec: `card-addition-checklist.md` / `dispatch-to-state.test.ts`
- CLAUDE.md §セルフレビュー追記

## Phase 5 advance — SceneSwitch / Hirameki / Misread / Souza (2026-05-17 〜 18)

### Added
- SceneSwitch: rules/20 §スイッチ engine + AI + UI (`6625283` / `1421772`)
- Hirameki: rules/10 E2E 結合 + listener bug fix (`75fe5f4`)
- Misread: rules/13 §ミスリード E2E (Human defender) + bug fix (`9070556`)
- Souza: rules/13 §捜査X engine atom + AI auto-order (`59183f4`)

### Notes
- Misread UI (`35a0736`) は MVP デッキで dormant
- Souza Sub-task B/C は MVP デッキで souza 使用カード皆無を確認、公式 defer (`a14b62b`)

## Phase 5 advance prep (2026-05-17)

commit `5cdc3bb`。

### Added
- [guardrails spec](.claude/specs/2026-05-17-phase5-advance-guardrails.md) 起草

## Phase 9-E — UI 細部 (2026-05-17 頃)

### Added
- deck low-stock 表示 / FILE progress-7 完了 / opp 手札 mini back 統一

## Phase 9-D — 表示細部 (2026-05-17 頃)

### Added
- case 向き auto-detect / partner 拡大 / hand 色あせ / Remove 画像 / Evidence ↔ FILE swap

## Phase 9-C — カード画像 UI 統合 (2026-05-17 頃)

### Added
- CardArt component + useCardImage hook

## Phase 9-B — engine 4 バグ修正 + Heuristic チューニング (2026-05-17)

### Fixed
- engine 4 バグ + node:fs 分離 hotfix

### Changed
- Heuristic AI チューニング

## Phase 9-A — 1000戦 smoke baseline (2026-05-17)

[smoke-2026-05-17.md](.claude/reports/smoke-2026-05-17.md)。

### Added
- 1000戦 AI vs AI smoke harness ベースライン

## Round 3c — B7 チュートリアル矢印機構 (2026-05-15 頃)

commits `f362175` + `c8118d0`。

### Added
- チュートリアル矢印機構 (border + glow pulse + ▼▲◀▶ + createPortal)
- 全 33 step マッピング (25 target + 8 skip)

## Round 3b — LogPanel HandZone パターン化 (2026-05-15 頃)

commit `ccdd4b5`。

### Changed
- LogPanel を HandZone 同等の fixed overlay + 透明 backdrop click 閉 + scrollbar thin + fade-in + role/aria

## Round 3a — UI 追加修正 12 項目中 9 件 (2026-05-15 頃)

commits `8161efb` + `d15b495`。B3/B6/B9/B11/B12/A8/A1/A10。

### Added
- FileArea + modal
- event カード組込

### Changed
- 事件 stamp 削除 + edition tag 独立
- 手札 scrollbar 完全削除 + grayscale

### Fixed
- next-hint engine bug fix

## Round 2 — Human-vs-CPU UI/UX 修正 18 件 (2026-05-14 頃)

commits `e61bb7f` 〜 `d343fde`。

### Changed
- startTurn 統一
- TopBar 動的
- 引き直し UI
- 手札 UX
- picker glow
- FILE/証拠/リムーブ モーダル
- ログ閉じる + 日本語化
- チュートリアル「次へ」修正

## Phase 8.1-8.10 + 完全クローズ

### Added
- hooks / per-step dispatch / Hirameki / 各種 modal / E2E

## Phase 7 + 7.5 — UI Shell

### Added
- UI Shell (12 components + cardResolvers + App 統合)

## Phase 0-6 — Engine + 47 カード + AI

### Added
- Engine コア (React 非依存、純関数 + Immer + Effect Descriptor DSL)
- 47 カード実装 (CT-D08 / CT-D11)
- AI policies (Random / Heuristic)

---

## 現在のメトリクス (Round 4l 時点)

- **1511 PASS + 1 skipped / 196 Test Files** (Phase 9-G.1 完了時点)
- **E2E 38 pass + 1 skipped** (bug-006 1 + bug-029 2 + cutinFixedAP 6 + partnerColorKeyword 6 + caseTraitConditioned 4 + eventRemoveByAP 5 + hiramekiDraw 7 + hiramekiCharStun 7)
- **1000戦 smoke baseline 525/475 完全維持** (avg 9.85 ターン、Round 4g 以降不変、Round 2-Round 4l 全 34 commit で regression 0)
- `npm run typecheck` 通過 / `npm run docs:check` クリーン
- リスク・バグ管理: [.claude/bugs/index.base](.claude/bugs/index.base) を Obsidian で開いて全バグ集約 view
