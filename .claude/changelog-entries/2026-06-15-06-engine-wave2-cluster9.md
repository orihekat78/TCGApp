# engine拡張 wave#2 cluster9 — setcard:leave hook 解禁 5枚

**Round/Phase**: 2026-06-15 engine拡張 wave#2 cluster9 (`cards/wave2-cluster9-setcard-leave`)。
赤魔術 family残で DEFER した B07034/PR231 a1 +（既出荷 a2-only の）B02020 a1 を、新 hook
`setcard:leave` を additive 実装して解禁。次クラスタ選定は engine-ext triage (opus, 4 lens) で
A/B/C 比較 → A (setcard:leave) が唯一 ready-now・smoke 影響実証ほぼ0・最高 score で選定。
engine 設計は opus 3-lens 敵対設計レビュー = **GO / 0 blockers** 判定後に実装。

### 新 engine 機構 (additive・不在時 no-op)

- **新 HookName `setcard:leave`** (`types/hooks.ts`)。per-occurrence (「1枚…離れるたび」)。
  payload `{ player(=host owner), hostUid, hostCardId, setCardId, faceUp, cause }` / source `{ player, uid, cardId }`。
- **`TRIGGERED_HOOKS` に追加** (`listeners/triggered.ts`)。default `handleHook` 登録 (特別 handler 不要)。
  set card 自体は ability を持たず、listener は in-play キャラ → emit-before-splice で host が
  listener 自身でも collectCardsInPlay に残る。side 判定は `triggerPlayerIs` (file:pop 同型)。
- **emit 配線** — `mutate/scene.ts`: 共通 helper `emitSetCardLeaves` を removeToRemove / toDeck / toHand の
  **host splice 前**に per-entry 呼び出し (removeToRemove は rules/30 misplay-overflow を除外)。
  `mutate/char.ts`: removeOneSetCard (B08034 path、host 在場) で1枚除去ごとに emit。
  変装用 toDeckBottom は set card を引き継ぐため emit 無し (rules/09/23)。
- **whitelist 同期**: `scripts/taskA-validate-specs.cjs` HOOKS に `setcard:leave` 追加 (sync-taskA-whitelists gate)。

### 解禁カード 5枚 (ALL_CARDS 1174→1177)

- **B07034 / B07034P / PR231 小泉紅子** (白 lv7/ap5000/lp1, 高校生/魔女):
  - a1【事件赤魔術】【自分ターン中】【ターン2】自側キャラの裏向きセットが1枚離れるたび1ドロー
    (setcard:leave side:self + caseTrait赤魔術 + turn:self + limit n:2)。
  - a2【宣言】【スリープ】〚手札1枚リムーブ〛→ デッキ上端を $self に裏向きセット + レベル7以下1枚までリムーブ。
- **B02020 / B02020P 大岡紅葉** (緑 lv6/ap5000/lp1, 高校生): a1【自分ターン中】【ターン1】相手側キャラの
  セットが離れたとき、自側1枚までにデッキ上端を裏向きセット + 1ドロー (setcard:leave side:opp + limit n:1)。a2 は既出荷。

### 検証 (全 gate green)

- tsc 0 / sync-taskA-whitelists 5/5 / validate-specs pass 73 fail 0 / **full vitest 2181** (+9, regression 0)。
- 専用 behavioral テスト `tests/cards/cluster9-setcard-leave.test.ts` 9件: FIX-1 self-leave pin
  (emit-before-splice 不変条件) / sibling / removeOneSetCard / per-occurrence 2→2・3→2上限 /
  caseTrait・自分ターン中 gate / side:self·side:opp 判定。
- **smoke:1000 baseline 完全一致** (winsA=498 / avg≈11.00 / timeouts0 / exceptions0)。MVP デッキ
  CT-D08/CT-D11 は charSetCard 0 枚 = emit ループ非実行 = 構造的 no-op を grep で実証。
- eslint (変更ファイル) 0 error / CI lint 8本 errors=0 / lint:icon-abilities OK (shipped=1177)。
- playwright 回帰 suite green。

### known-gap (DEFERRED-INDEX cluster9 セクション、本カード起因ではない engine 制約)

faceUp filter は vacuous 等価 (face-up set card 0枚) / cross-char 同時離場は順序依存 (leave:to-remove 同様の
engine-wide 性質) / selfToDeckBottom コスト経路は emit 対象外 (併用カード0) / stacked-under は path 不在。

### 設計記録

- triage: engine-ext-triage workflow (A/B/C + landscape 19 gate ランク)。
- design-review: setcard-leave-design-review workflow (rules-edge/engine-soundness/regression-redteam 3 lens + synth)。
