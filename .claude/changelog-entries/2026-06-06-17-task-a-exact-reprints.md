## タスク A: 完全一致再録カード 11 枚 (engine 変更 0)

**Round/Phase**: 2026-06-06 session #8 — engine 変更 0 カードバッチ (タスク A) 着手 / batch #1。
既存実装カードと公式テキスト byte 一致の色違い・パラレル・再録のみを刈り取り。

### 再サーベイ (実データ裏取り)

- 全カタログ **2049 枚**、実装済 **967** (= ALL_CARDS)、**残 1082 枚** (character 867 / event 157 / case 58) を実データで確定。
- 残 1082 の signature (effect+cutIn+hirameki+henso) クラスタ分析: vanilla 0 / **既存実装と byte 一致の再録 11** /
  その他 1071 (= **661 distinct signature**、うち 288 singleton + 373 multi-cluster で 783 枚をカバー)。
- 最大クラスタ B05118×10 は「パートナー【事件解決】能力 書き換え」= D 高リスク。自動分類は過大評価しやすいため
  確実 🟢 のみを batch 化。

### 対応カード (11 枚、spread パターン)

既存実装カードを `{ ...Base, id, no, rarity, imageUrl }` で spread (B01028P 既存 idiom)。abilities 完全流用 = engine 不変:

- B02004P (←B02004) / B02043 (←D06012) / B03006・B03006P (←D08021) / B03122 (←D07019) /
  B03129P・PR055 (←B03129) / B04081・B04081P (←D11012) / B05029P (←B05029) / PR057 (←D01013)。
- 全 11 枚で name/color/level/AP/LP/kind が twin と一致 (差分は rarity と cardId/imageUrl のみ) を実データ検証済。
- twin は全て faithful 実装 (DEFERRED/空 abilities/TODO 無) を確認。

### 検証

- typecheck clean / 全 vitest **1851 pass / 1 skip / 0 fail** (回帰 0) / eslint (新規 12 ファイル) 0 errors / docs:check 同期。
- `tests/cards/registry.test.ts` の `engine.cards.all().length === 47 + GEN` (idempotent 登録) が通過 →
  11 枚の id 一意・登録成功を保証 (重複 id なら fail する設計)。GEN は配列由来で自動追従のためテスト改変不要。
- 機能変更 0 (metadata-only clone of test-verified twins) のため Playwright text-faithfulness 検査は twin から継承
  (新規 engine 挙動なし)。
- ALL_CARDS 967 → **978**。touched files: `cards/` 12 + `_reuse/index.ts` (engine 不変)。
