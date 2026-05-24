# 設計仕様書 (specs) INDEX

ブレインストーミング [2026-05-11](../research/decisions/2026-05-11-ui-brainstorm.md) から確定した UI 設計。
`rules/01〜26` 全準拠 + [CLAUDE.md設計レビューチェックリスト](../CLAUDE.md) 適用済み。

## UI 設計ファイル一覧 (2026-05-11)

### 全体構成

- [ui-overall.md](2026-05-11-ui-overall.md) — レイアウト・コンポーネント階層

### 状態管理

- [ui-state-map.md](2026-05-11-ui-state-map.md) — GameState スキーマ (TypeScript型)
- [ui-state-mapping.md](2026-05-11-ui-state-mapping.md) — UIマッピング表 + selectors
- [ui-effect-stack.md](2026-05-11-ui-effect-stack.md) — 効果スタック + 痕跡
- [ui-turn-flags.md](2026-05-11-ui-turn-flags.md) — ターンフラグ + スタン特殊
- [ui-mr-and-special.md](2026-05-11-ui-mr-and-special.md) — MR + セット重ね + 条件アイコン + APタイミング

### 操作フロー

- [ui-action-flows.md](2026-05-11-ui-action-flows.md) — メインフェイズ6行動
- [ui-game-setup-flows.md](2026-05-11-ui-game-setup-flows.md) — マリガン / 先攻決定 / オートフェイズ
- [ui-modal-flows-contact.md](2026-05-11-ui-modal-flows-contact.md) — コンタクト + カットイン + 変装 + ガード
- [ui-modal-flows-other.md](2026-05-11-ui-modal-flows-other.md) — ミスリード / ヒラメキ / 捜査 / スイッチ / 領域展開

### エッジケース

- [ui-edge-cases.md](2026-05-11-ui-edge-cases.md) — 0枚/不可逆/名乗り例外/数値マイナス/複合連鎖

### スタイル・アニメ

- [ui-style-tokens.md](2026-05-11-ui-style-tokens.md) — カラー・テクスチャ・タイポ・サイズ・a11y
- [ui-animation-specs.md](2026-05-11-ui-animation-specs.md) — タイミング・主要アニメ・スキップ

### 互換参照（旧版）

- ui-modal-flows.md / ui-style-anim.md は削除済 (実体は -contact / -other / -tokens)

### モック参考資産 (design-mockups/)

UI 視覚デザイン参考のモック群。実装規範ではなく視覚参照。

- [`design-mockups/01-board-mockup.html`](../../design-mockups/01-board-mockup.html) — **Phase 7 採用レイアウト基準** (盤面ハイファイモック)
- [`design-mockups/`](../../design-mockups/) — ②③④（推理プロト / VS プロト / モーダルカタログ / アニメ検証）は Phase 7 着手時に採否判断
- 詳細: [`design-mockups/README.md`](../../design-mockups/README.md)

## 骨格 (Engine) API 設計ファイル一覧 (2026-05-11)

カード効果のあらゆるパターンを骨格を増やさず表現できる API 群。
詳細INDEX → [engine-api.md](engine-api.md)

- [engine-api.md](engine-api.md) — INDEX + 設計原則
- [engine-api-state-read.md](engine-api-state-read.md) — 読み取りAPI
- [engine-api-state-mutate.md](engine-api-state-mutate.md) — 変更プリミティブ
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md) — Effect Descriptor DSL
- [engine-api-events.md](engine-api-events.md) — イベントHook 一覧
- [engine-api-cost.md](engine-api-cost.md) — コスト評価
- [engine-api-targeting.md](engine-api-targeting.md) — 対象選択
- [engine-api-conditions.md](engine-api-conditions.md) — 条件評価
- [engine-api-flow-control.md](engine-api-flow-control.md) — フロー制御
- [engine-api-resolver.md](engine-api-resolver.md) — 効果スタック解決
- [engine-api-atom-verbs.md](engine-api-atom-verbs.md) — 全 39 atom verb の引数 shape リファレンス
- [engine-api-pick-substitution.md](engine-api-pick-substitution.md) — `$pick` placeholder 置換 (Pattern A/B / side-channel / tryRePickFromAtom)
- [engine-api-card-shape.md](engine-api-card-shape.md) — カード定義
- [engine-api-card-abilities.md](engine-api-card-abilities.md) — 能力定義
- [engine-api-edge-cases.md](engine-api-edge-cases.md) — エッジケースAPI挙動
- [engine-api-invariants.md](engine-api-invariants.md) — 不変条件・凍結ポリシー
- [engine-api-flow-setup.md](engine-api-flow-setup.md) — ゲーム開始フロー (audit追加)
- [engine-api-flow-contact.md](engine-api-flow-contact.md) — コンタクト/事件/ガード (audit追加)
- [engine-api-state-mutate-meta.md](engine-api-state-mutate-meta.md) — フラグ/ログ/結果/MR (audit追加)
- [engine-api-types.md](engine-api-types.md) — 戻り値型・EffectCtx (audit追加)
- [2026-05-17-phase5-advance-guardrails.md](2026-05-17-phase5-advance-guardrails.md) — Phase 5 advance ガードレール (9-B 4件再発防止 / ルール行CL / AI同期PR / smoke dump / listenerテンプレ)

## ブレインストーミング決定一覧

| Q | 決定 |
|---|------|
| Q1 環境 | Desktop only 1920×1080 (最低1280×720) |
| Q2 レイアウト | 公式プレイマット忠実、サイドバーなし、上端フェイズ、相手180° |
| Q3 オーバーレイ | 状態のみ |
| Q4 手札 | 完全フラット (MTGA型) |
| Q5 状態 | 回転+バッジ |
| Q6 証拠UI | クリック展開、自分も裏向き、由来情報のみ可視 |
| Q7 ログ | 下端折りたたみ |
| Q8 対象選択 | クリック+確認 (MTGA型) |
| Q9 確認 | 厳格 (すべての行動で確認) |
| Q10a 視覚 | プレイシート忠実 (ダークネイビー/レンガ壁/KEEP OUT) |
| Q10b アニメ | 標準0.3-0.5秒 + スキップ可 |

## レビュー履歴

| 日付 | 種別 | 内容 |
|------|------|------|
| 2026-05-11 | 自己レビュー1 | 全7ファイル初版作成 |
| 2026-05-11 | ユーザー指摘1 | 名乗り/突撃/迅速・30件の漏れ発見 |
| 2026-05-11 | 自己再audit1 | 14件追加発見・44件総漏れ判明 |
| 2026-05-11 | 設計分割 | 7→13ファイルに機能単位で再分割 |
| 2026-05-11 | 機械audit2 | 全ルール100%覆盖確認 |
| 2026-05-11 | 行数調整 | 3ファイル 100-118行 (機能凝集性優先) |
| 2026-05-11 | ユーザーレビュー | 待機中 |
