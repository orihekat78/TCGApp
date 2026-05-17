---
aliases:
  - HUB
  - ナビゲーションハブ
  - プロジェクトハブ
tags:
  - hub
  - navigation
  - project/conan-tcg
status: phase-8-closed
phase: 8
last_updated: 2026-05-17
related:
  - "[[PROJECT-MAP.canvas]]"
  - "[[README]]"
---

# 🔍 名探偵コナンTCG プロジェクト — ナビゲーションハブ

このファイルは Obsidian の `Cmd/Ctrl + O` から開ける**プロジェクト中央の出発点**。
ルール / 研究 / 設計 / 実装計画 / セッションログ全てへ1ホップで届くように再構成。

> [!tip] 視覚マップあり
> 6つの主要ドキュメント群の関係を一望したい場合は [[PROJECT-MAP.canvas|プロジェクトマップ Canvas]] を開いてください。

---

> [!important] 現在のフェーズ: Phase 8 完全クローズ達成 ✅
> Commit 1〜6 完了 ／ 直近: `038a331` (NEXT-SESSION-PROMPT を Phase 9 へ)
> Engine: 1377 tests GREEN ／ 182 files ／ TypeCheck Clean ／ docs:check Clean
> 次: Phase 9 Polish / Phase 5 advance (実カード追加)

## 🚀 まず最初に読む

- [README.md](README.md) — プロジェクト全体像 + 進捗
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — 開発規約（Claude Code 必読）
- [.claude/memory.md](.claude/memory.md) — 現セッション作業ログ
- [.claude/research/obsidian-setup.md](.claude/research/obsidian-setup.md) — Obsidian 操作ガイド

## 📜 公式ルール (32ファイル)

- **[rules/INDEX](.claude/rules/INDEX.md)** — ルール総目次
- [rules/sources](.claude/rules/sources.md) — 公式PDFと一次/二次情報源

### 基本ルール (01–21)

- [01 勝利条件](.claude/rules/01-victory-conditions.md) ｜ [02 デッキ構築](.claude/rules/02-deck-construction.md) ｜ [03 エリア/状態](.claude/rules/03-field-areas.md)
- [04 ゲーム開始](.claude/rules/04-game-setup.md) ｜ [05 ターン進行](.claude/rules/05-turn-phases.md) ｜ [06 カード種別](.claude/rules/06-card-types.md)
- [07 アクション](.claude/rules/07-action-flow.md) ｜ [08 コンタクト](.claude/rules/08-contact.md) ｜ [09 カットイン/変装](.claude/rules/09-cutin-disguise.md)
- [10 アクション[事件]](.claude/rules/10-action-event.md) ｜ [11 推理](.claude/rules/11-reasoning.md) ｜ [12 ネクストヒント](.claude/rules/12-next-hint.md)
- [13 キーワード](.claude/rules/13-keywords.md) ｜ [14 リフレッシュ](.claude/rules/14-refresh.md) ｜ [15 能力と効果](.claude/rules/15-abilities-effects.md)
- [16 セット/重ねる](.claude/rules/16-card-set.md) ｜ [17 アイコン](.claude/rules/17-icons.md) ｜ [18 MR](.claude/rules/18-mr.md)
- [19 特殊ルール](.claude/rules/19-special-rules.md) ｜ [20 色/スイッチ](.claude/rules/20-color-and-switch.md) ｜ [21 宣言能力](.claude/rules/21-declared-ability-cost.md)

### エッジケース Q&A (22–26)

- [22 アクション/コンタクト](.claude/rules/22-qa-action-contact.md) ｜ [23 変装/カットイン](.claude/rules/23-qa-disguise-cutin.md)
- [24 名乗り/スタン](.claude/rules/24-qa-naming-stun.md) ｜ [25 効果解決](.claude/rules/25-qa-effects-resolution.md) ｜ [26 リフレッシュ](.claude/rules/26-qa-deck-refresh.md)

### 競技規定 (27–30)

- [27 カード制限](.claude/rules/27-card-restrictions.md) ｜ [28 エラッタ](.claude/rules/28-errata.md)
- [29 フロアルール時間](.claude/rules/29-floor-rule-timing.md) ｜ [30 不適切プレイ](.claude/rules/30-floor-rule-misplay.md)

## 🧠 研究 — 設計判断のための調査

- [research/legal](.claude/research/legal.md) — 法務・著作権スタンス確定
- [research/data](.claude/research/data.md) — カードデータ取得・スキーマ・画像
- [research/arch](.claude/research/arch.md) — アーキテクチャ全般 (10ファイル)
- [research/ux](.claude/research/ux.md) — 対戦UX/UI設計 (動画解析含む)
- [research/ui](.claude/research/ui.md) — プレイマット由来UIレイアウト
- [research/tutorial](.claude/research/tutorial.md) — チュートリアル学習設計
- [research/decisions](.claude/research/decisions.md) — UIブレインストーミング決定事項
- [research/rules/commmune-wiki-map](.claude/research/rules/commmune-wiki-map.md) — コミュニティWiki構造

★ **UX準拠ソース**: [ux/14 公式UIモックアップ観察](.claude/research/ux/14-official-ui-mockup.md)

## 🏗️ 設計仕様 (specs)

- **[specs/INDEX](.claude/specs/INDEX.md)** — UI + Engine API 全仕様目次

### UI 設計 (16ファイル、2026-05-11)

- [全体構造](.claude/specs/2026-05-11-ui-overall.md) ｜ [state-map](.claude/specs/2026-05-11-ui-state-map.md) ｜ [state-mapping](.claude/specs/2026-05-11-ui-state-mapping.md)
- [効果スタック](.claude/specs/2026-05-11-ui-effect-stack.md) ｜ [ターンフラグ](.claude/specs/2026-05-11-ui-turn-flags.md) ｜ [MR/特殊](.claude/specs/2026-05-11-ui-mr-and-special.md)
- [アクションフロー](.claude/specs/2026-05-11-ui-action-flows.md) ｜ [ゲーム開始](.claude/specs/2026-05-11-ui-game-setup-flows.md)
- [モーダル/コンタクト](.claude/specs/2026-05-11-ui-modal-flows-contact.md) ｜ [モーダル/他](.claude/specs/2026-05-11-ui-modal-flows-other.md)
- [エッジケース](.claude/specs/2026-05-11-ui-edge-cases.md) ｜ [スタイルトークン](.claude/specs/2026-05-11-ui-style-tokens.md) ｜ [アニメ仕様](.claude/specs/2026-05-11-ui-animation-specs.md)

### Engine API 設計

- **[engine-api](.claude/specs/engine-api.md)** — API 設計総括 + 設計原則
- [read](.claude/specs/engine-api-state-read.md) ｜ [mutate](.claude/specs/engine-api-state-mutate.md) ｜ [events](.claude/specs/engine-api-events.md)
- [resolver](.claude/specs/engine-api-resolver.md) ｜ [card-shape](.claude/specs/engine-api-card-shape.md) ｜ [edge-cases](.claude/specs/engine-api-edge-cases.md)
- [invariants](.claude/specs/engine-api-invariants.md) ｜ [flow-setup](.claude/specs/engine-api-flow-setup.md) ｜ [flow-contact](.claude/specs/engine-api-flow-contact.md)
- [mutate-meta](.claude/specs/engine-api-state-mutate-meta.md)

### カード分析・共通クラス

- [cards-analysis/INDEX](.claude/specs/cards-analysis/INDEX.md) — CT-D08+CT-D11 全47枚分析
- [cards-analysis/SHARED-PATTERNS](.claude/specs/cards-analysis/SHARED-PATTERNS.md) — 共通パターン抽出
- [shared-classes/INDEX](.claude/specs/shared-classes/INDEX.md) — 共通クラス8件設計

## 🛠️ 実装計画

- **[plans/INDEX](.claude/research/plans/2026-05-11-mvp-implementation/INDEX.md)** — MVP 実装フェーズ 0–9
- Phase 0: [bootstrap](.claude/research/plans/2026-05-11-mvp-implementation/phase-0-bootstrap.md)
- Phase 1: [types-state](.claude/research/plans/2026-05-11-mvp-implementation/phase-1-types-state.md)
- Phase 2: [read-mutate](.claude/research/plans/2026-05-11-mvp-implementation/phase-2-read-mutate.md)
- Phase 3: [effect-resolver](.claude/research/plans/2026-05-11-mvp-implementation/phase-3-effect-resolver.md) ✅
- Phase 4: [flow](.claude/research/plans/2026-05-11-mvp-implementation/phase-4-flow.md) ✅
- Phase 5: [cards](.claude/research/plans/2026-05-11-mvp-implementation/phase-5-cards.md) ✅
- Phase 6: [ai](.claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md) ✅
- Phase 7: [ui-shell](.claude/research/plans/2026-05-11-mvp-implementation/phase-7-ui-shell.md) ✅ (12 components + cardResolvers + App 統合)
- Phase 8: [ui-interactions](.claude/research/plans/2026-05-11-mvp-implementation/phase-8-ui-interactions.md) ← 次 (layout pivot から開始予定)
- Phase 9: [polish](.claude/research/plans/2026-05-11-mvp-implementation/phase-9-polish.md)

## 📓 セッション履歴

- **[sessions/README](.claude/sessions/README.md)** — セッションログ運用ルール
- [2026-05-10](.claude/sessions/2026-05-10.md) — 法務調査・ルール抽出
- [2026-05-11](.claude/sessions/2026-05-11.md) ｜ [-2](.claude/sessions/2026-05-11-2.md) ｜ [-3](.claude/sessions/2026-05-11-3.md) ｜ [-4](.claude/sessions/2026-05-11-4.md) ｜ [-5](.claude/sessions/2026-05-11-5.md)
- [2026-05-12](.claude/sessions/2026-05-12.md) — Phase 4 完了 + Phase 5 完了
- [2026-05-14-2](.claude/sessions/2026-05-14-2.md) — Phase 5 fix + Phase 6 + Obsidian 統合
- [2026-05-14-2](.claude/sessions/2026-05-14-2.md) — Obsidian × Engine 統合 (meta-tooling)
- [2026-05-15](.claude/sessions/2026-05-15.md) — **Phase 7 UI Shell 完了** (12 components / 1132 tests / Claude Design dual-track 6 pilots)

## 🤖 自動生成ドキュメント

エンジン構造・進捗・フロー図を **コードから自動生成** して `.claude/auto/` に配置。
人手で書く仕様書とは別に「実際のエンジンが今どう動いているか」をObsidianで確認できる。

- **[auto/README](.claude/auto/README.md)** — 運用ガイド・再生成コマンド一覧
- **[auto/api/index](.claude/auto/api/index.md)** — ✅ Phase 2: エンジン 12 namespace の public API reference（ts-morph 抽出済）
  - [`read`](.claude/auto/api/read.md) ｜ [`mutate`](.claude/auto/api/mutate.md) ｜ [`invariant`](.claude/auto/api/invariant.md) ｜ [`event`](.claude/auto/api/event.md) ｜ [`effect`](.claude/auto/api/effect.md)
  - [`dyn`](.claude/auto/api/dyn.md) ｜ [`target`](.claude/auto/api/target.md) ｜ [`cost`](.claude/auto/api/cost.md) ｜ [`cond`](.claude/auto/api/cond.md) ｜ [`resolve`](.claude/auto/api/resolve.md)
  - [`flow`](.claude/auto/api/flow.md) ｜ [`cards`](.claude/auto/api/cards.md)
- **[auto/state/game-state](.claude/auto/state/game-state.md)** — ✅ Phase 3: GameState shape（Mermaid classDiagram）
- **auto/flows/** — ✅ Phase 3: 状態遷移図
  - [setup](.claude/auto/flows/setup.md) ｜ [auto-phase](.claude/auto/flows/auto-phase.md) ｜ [turn](.claude/auto/flows/turn.md) ｜ [action-fsm](.claude/auto/flows/action-fsm.md)
- **auto/progress/** — ✅ Phase 3: 実装/テスト進捗
  - [cards](.claude/auto/progress/cards.md) ｜ [tests](.claude/auto/progress/tests.md)
- **[auto/mapping/index](.claude/auto/mapping/index.md)** — ✅ Phase 4: ルール ↔ コード 双方向マッピング + Spec / Engine namespace 連携ハブ
  - **テーブル**: [rules-to-cards](.claude/auto/mapping/rules-to-cards.md) ｜ [cards-to-rules-cards](.claude/auto/mapping/cards-to-rules-cards.md) ｜ [engine-core](.claude/auto/mapping/cards-to-rules-engine-core.md) ｜ [engine-flow](.claude/auto/mapping/cards-to-rules-engine-flow.md)
  - **俯瞰図 (Mermaid)**: [engine-core ↔ rules](.claude/auto/mapping/graph-rules-engine-core.md) ｜ [engine-flow ↔ rules](.claude/auto/mapping/graph-rules-engine-flow.md) ｜ [engine ↔ specs](.claude/auto/mapping/graph-specs.md)
  - **Obsidian グラフビュー連携ハブ**: [by-rule/](.claude/auto/mapping/by-rule/) ｜ [by-spec/](.claude/auto/mapping/by-spec/) ｜ [by-engine/](.claude/auto/mapping/by-engine/) — 各エンティティから source / rule / spec / namespace を辿れるハブ

> ⚠️ `.claude/auto/` 配下は **編集禁止**（`npm run docs:*` で再生成）。

## 🔗 リンク形式方針

| 場所 | 形式 | 理由 |
| ---- | ---- | ---- |
| 既存175件のドキュメント | 相対パス `[name](path.md)` | GitHub互換、現状維持 |
| `.claude/auto/`（自動生成） | 相対パス | diff安定 |
| この HUB.md・今後の新規ハブ | 相対パス + wikilink `[[name]]` 併用可 | Obsidianグラフ最適化、追加方式（移行しない） |

→ 既存リンクの **wikilink移行は不要**。新規ノートで wikilink を **併用** するのは推奨。Obsidianは両形式を解析。

---

**Tips**: Obsidian で `Ctrl/Cmd + G` でグラフビュー、`Ctrl/Cmd + O` でファイル検索、各ファイル右上の「リンク」アイコンでバックリンク確認。
**INDEX 経由でフォルダ内のファイル同士の関係も追えるよう、各サブディレクトリに INDEX.md を整備済み。**
