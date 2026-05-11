# 次セッション計画 (post 2026-05-11)

カード効果分析 47枚完了 + TSV メタ集約後の段取り。

## 直近 To-Do (優先順)

### 1. engine-api 追加ギャップ G23-G30 取り込み (~30分)

カード分析中に検出した追加ギャップ。設計フェーズなので「過剰なくらい豊富」原則で取り込む:

| ID | 修正先 | 内容 |
|----|-------|------|
| G23 | engine-api-card-abilities.md | continuous 用 `continuousModifier` フィールド (selector 計算) |
| G24 | engine-api-types.md / targeting.md | 動的式バインド (`$dyn.X`, `$self.ap` 等) を `EffectCtx.dyn` で評価 |
| G25 | engine-api-effect-descriptor.md | atom verb `evidenceToHand` |
| G26 | engine-api-targeting.md | TargetQuery `distinctNames: true` 制約 |
| G27 | engine-api-conditions.md | Condition `stackedCountAtLeast` |
| G28 | engine-api-flow-control.md | flow.action 強制指定モード `mustBeTargeted` フラグ |
| G29 | engine-api-flow-control.md | flow.action 対象拡張 plug-in 機構 |
| G30 | engine-api-effect-descriptor.md | atom verb `handAddFromRemove` |

### 2. 共通クラス cards/_shared/ 設計 (~1.5時間)

[SHARED-PATTERNS.md](cards-analysis/SHARED-PATTERNS.md) で確定した9件を仕様化:

- `partnerColorKeyword.ts`
- `cutinFixedAP.ts`
- `hiramekiCharStun.ts`
- `hiramekiDraw.ts`
- `caseTraitConditioned.ts`
- `caseResolvedHandRemove.ts` (格上げ)
- `caseDeclaredEvidenceFlip.ts` (格上げ)
- `eventRemoveByAP.ts` (格上げ)
- (partnerCommon は骨格内蔵で OK)

各クラスの spec を `.claude/specs/shared-classes/` に作成。
**破壊的変更禁止 (CLAUDE.md)**。シグネチャは将来カードのオプショナル拡張で対応。

### 3. 公式テキスト未取得カードのフェッチ (~30分)

- D11007/08 松田陣平: 続テキスト不明 (高APコンタクト時の効果)
- D11014 横溝重悟: 萩原千速登場時の追加効果
- D11021 千速と重悟の婚活パーティー: 神奈川県警条件の続文
- D11018 佐藤美和子: cutIn の括弧書き省略の確認

### 4. writing-plans skill で MVP 実装プラン作成 (~2時間)

[engine-api](engine-api.md) + [cards-analysis](cards-analysis/INDEX.md) + [SHARED-PATTERNS](cards-analysis/SHARED-PATTERNS.md) を入力に、
**writing-plans skill** で実装プランを作成:

- フェイズ1: 骨格 (engine.* 全 namespace) 実装 + ユニットテスト
- フェイズ2: 共通クラス (cards/_shared/*) 実装 + ペアテスト
- フェイズ3: 個別カード (47枚) 実装 + 自動プレイテスト 1000戦
- フェイズ4: UI 実装 (ui-* specs 群)
- フェイズ5: AI (Random / Heuristic) 実装
- フェイズ6: 動作確認・チュートリアル

### 5. ユーザーレビュー → 実装フェーズ移行

## メタ参照

- 設計仕様: [.claude/specs/INDEX.md](INDEX.md) (UI 16 + Engine API 17 + cards-analysis + cards-data)
- 直近の議事録: [sessions/2026-05-11.md](../sessions/2026-05-11.md)
- ルール: [.claude/rules/INDEX.md](../rules/INDEX.md)
- プロジェクト規約: [.claude/CLAUDE.md](../CLAUDE.md)

## このプランを編集・破棄する場合

本ファイルは「次セッション開始時の起点」を示す。
実装方針が変わった場合は本ファイルを更新するか、writing-plans 出力で上書きすること。
