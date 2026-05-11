# 骨格 (Engine) API スペック INDEX (2026-05-11)

カード効果のあらゆるパターンを **骨格を増やさず** 表現できるよう、
骨格APIを過剰なくらい豊富に定義する。
本ファイルは INDEX。詳細は機能別ファイルへ。

## 設計原則

1. **骨格凍結原則** ([CLAUDE.md](../CLAUDE.md#修正範囲を最小化する運用骨格凍結原則))
   - 公式ルール変更・骨格バグ・性能改善以外で骨格APIを変更しない
   - カード効果のために動詞を増やすことを **禁止**
   - 全動詞は事前にここで定義する
2. **Effect Descriptor (DSL) ファースト**
   - カード効果は JSON シリアライズ可能な Descriptor で表現
   - 骨格は Descriptor を解釈する Resolver を持つ
   - 例外的に TypeScript 関数で書く場合のみ `customResolver` を使う
3. **state へは Mutation API 経由のみ**
   - カード/共通クラスから `state.xxx = ...` 直接代入禁止
   - 必ず `engine.mutate.*` API を経由 (Immer 内部使用)
4. **イベントは Hook で受ける**
   - 「〜したとき」「〜するたび」は Hook 登録で表現
   - Hook 一覧は事前に固定 (新Hookの追加は骨格修正)
5. **対象選択・コスト・条件は宣言的に分離**
   - `targets` / `cost` / `conditions` を Descriptor 内で別キーに分離
   - 骨格は順序通り (条件→対象→コスト→効果) に処理
6. **公式ルールへの逆引き**
   - 全API は対応する `rules/NN-*.md` 参照コメントを持つ

## ファイル構成

| # | ファイル | 内容 |
|---|----------|------|
| 01 | [engine-api-state-read.md](engine-api-state-read.md) | 全state読み取りAPI (selector/query) |
| 02 | [engine-api-state-mutate.md](engine-api-state-mutate.md) | 全state変更プリミティブ |
| 03 | [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md) | 効果記述DSL (JSON Descriptor) |
| 04 | [engine-api-events.md](engine-api-events.md) | イベントhook 一覧 (40+ 種類) |
| 05 | [engine-api-cost.md](engine-api-cost.md) | コスト評価・支払いAPI |
| 06 | [engine-api-targeting.md](engine-api-targeting.md) | 対象選択API |
| 07 | [engine-api-conditions.md](engine-api-conditions.md) | 条件アイコン評価API |
| 08 | [engine-api-flow-control.md](engine-api-flow-control.md) | フェイズ/アクション/コンタクト制御 |
| 09 | [engine-api-resolver.md](engine-api-resolver.md) | 効果スタック・解決順制御 |
| 10 | [engine-api-card-shape.md](engine-api-card-shape.md) | カード定義シェイプ (CardDef) |
| 11 | [engine-api-card-abilities.md](engine-api-card-abilities.md) | 能力定義 (AbilityDef) |
| 12 | [engine-api-edge-cases.md](engine-api-edge-cases.md) | エッジケース別API挙動 |
| 13 | [engine-api-invariants.md](engine-api-invariants.md) | 不変条件・凍結ポリシー |
| 14 | [engine-api-flow-setup.md](engine-api-flow-setup.md) | ゲーム開始フロー (mulligan/先攻決定) |
| 15 | [engine-api-flow-contact.md](engine-api-flow-contact.md) | コンタクト中行動・アクション[事件]・ガード |
| 16 | [engine-api-state-mutate-meta.md](engine-api-state-mutate-meta.md) | ターン跨ぎフラグ/ログ/結果/MR遷移 |
| 17 | [engine-api-types.md](engine-api-types.md) | 共通戻り値型・EffectCtx・HookName union |

## 名前空間規約

```typescript
import { engine } from '@/engine';

engine.read.*       // 読み取り (純粋関数)
engine.mutate.*     // 状態変更プリミティブ
engine.effect.*     // Effect Descriptor builder/resolver
engine.event.*      // Hook 登録/発火
engine.cost.*       // コスト評価/支払い
engine.target.*     // 対象選択クエリ
engine.cond.*       // 条件評価
engine.flow.*       // フェイズ/アクション/コンタクト遷移
engine.resolve.*    // 効果スタック解決制御
engine.invariant.*  // 不変条件 assert
```

## Out of Scope (本MVP)

| 項目 | rules | 理由 |
|------|-------|------|
| 禁止/制限カード検証 | 27 | 本MVPはカジュアル運用。実装時はカードDB側で禁止フラグを持たせるが、デッキビルダーでは無視 |
| 時間制限・ロジック勝負 | 29 | 1人運用想定。BO1/30分・先攻ターン/後攻ターン延長・ロジック勝負は実装しない |
| 不適切ゲーム進行ペナルティ | 30 | 同上。現場6枚以上は invariant 例外で十分 |
| 観客助言・買収行為 | 29.5 | オフライン1人運用 |
| 物理マーカー (事件編/解決編) | 06 | デジタルUIで自動表示 |

## 完了基準 (v1)

- [ ] CT-D08 + CT-D11 全34枚の効果が **骨格修正なし** で表現できる
- [ ] [rules/01〜26](../rules/INDEX.md) 全項目について該当 API が存在する
- [ ] 全 API が TypeScript 型 + ルール参照コメント + 使用例を持つ
- [ ] エッジケース (0枚/スタン特殊/変装引継ぎ/MR重複/同時発火) が表現可能

## レビュー履歴

| 日付 | 種別 | 内容 |
|------|------|------|
| 2026-05-11 | 初版 | 12ファイル骨格API定義 |
| 2026-05-11 | 自己audit (5観点) | rules/01-30 網羅性・GameState完備性・型一貫性・水平展開・UI整合性 |
| 2026-05-11 | ギャップ修正 | flow-setup/types/mutate-meta/flow-contact 追加・Trigger→TriggerRef・out-of-scope明記 |
| 2026-05-11 | ユーザーレビュー | 完了 |
