## BUG-116 登録: declaredAbility dispatcher で cost が silent skip 可能

**Round/Phase**: 2026-06-05 session レビュー Phase B

session レビュー時に判明した「B06069/B07103 e2e で sleepSelf cost が反映されない」
問題を原因特定し、BUG-116 として登録。

### 原因

`useEngineDispatch.ts` の `declaredAbility` ケースは:

```ts
if (action.cost && action.ctx) {
  engineCost.pay(draft, action.cost, action.ctx);
}
flow.useDeclaredAbility(draft, action.uid, action.abilId, action.ctx);
```

`action.cost` と `action.ctx` の **両方が渡された場合のみ** cost を支払う設計。caller が
両方を渡し忘れると **effect のみ走り cost は silent skip** となる。

### 影響範囲

- **本番 UI**: ActionsPanel 等が cost を action に詰めて dispatch (推定、要検証)
- **AI 経路**: `src/ai/policy.ts:241-256` が `engine.cards.get(cardId).abilities[i].cost` を自分で取得して
  `engine.cost.pay` を呼ぶ → 正しく cost 支払い
- **e2e / 直接 dispatch**: caller が忘れると cost フリーで effect 発火 → engine 仕様検証の信頼性低下

### 推奨修正 (3 案)

- **A (推奨)**: `useDeclaredAbility` 内で `ability.cost && !ctx?.costPaid` を検出して警告 log
- **B**: dispatcher で ability.cost を自動取得 + 自動 pay (AI policy と同ロジック)
- **C**: 現状維持 + e2e ヘルパで cost 自動組立 util を提供

### 現状の影響評価

- 本セッション中の e2e (B06069/B07103) は cost 未払いだが、検証対象 (sceneToHand / charModifyLevel) は
  cost 無関係に正しく動作するため、e2e の合否判定には影響なし
- B08054 e2e は cost なしの状態で動作確認済 (やはり sceneToHand は正しい)
- engine の機能不整合ではなく、**API 設計の落とし穴** (caller の責務違反が silent に通る)

### 修正タイミング

DEFERRED (latent — 本番 UI は正しく動作している前提、AI も問題なし)。次セッション以降で
Option A の warning log 追加を予定。
