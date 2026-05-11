# engine.resolve.* — 効果スタック・解決順制御

`pendingEffects` の管理と解決順の制御。
rules: [15](../rules/15-abilities-effects.md), [22](../rules/22-qa-action-contact.md), [25](../rules/25-qa-effects-resolution.md)

## EffectStackEntry

```typescript
type EffectStackEntry = {
  id: string;                       // 一意ID
  source: { uid?: string; cardId?: string; player: 'self'|'opp' };
  triggeredBy: { hook: HookName; payload: any };
  triggeredAt: { turn: number; phase: string; nano: number };
  effect: Effect;                   // Descriptor
  resolveGuard?: Condition;         // 解決時再評価する条件
  ownerChosenOrder?: number;        // 同タイミング内の所有者選択順
  state: 'pending' | 'resolving' | 'resolved' | 'cancelled';
};
```

## API

```typescript
engine.resolve.queue(state, entry): void
  // pendingEffects に追加。即時解決例外は queue 通さない (rules/15)
engine.resolve.next(state): EffectStackEntry|null
  // 次に解決すべきエントリを返す (順序ルールに従う)
engine.resolve.runOne(state, entry): void
  // 1件解決。解決中に発生した効果は queue (rules/15 「未解決」)
engine.resolve.runAllUntilEmpty(state): void
  // メインフェイズ進行可能になるまで全解決
engine.resolve.cancel(state, entryId): void
  // 「無効にする」効果用 (rules/15 即時例外)
engine.resolve.replace(state, entryId, newEffect): void
  // 「代わりに〜」効果用 (rules/15 即時例外)
engine.resolve.peek(state): EffectStackEntry[]
  // UI 表示用 (順序未確定でも可視化)
```

## 解決順のルール — rules: [15](../rules/15-abilities-effects.md), [25](../rules/25-qa-effects-resolution.md)

```text
[同タイミング発火セット] が複数発火したら:

  1. 同一プレイヤー所属効果 → 所有者が好きな順で解決
     - UI: 所有者に順序選択モーダル
     - 1件ずつ解決し、その間も新たな効果が積まれうる
  2. 両プレイヤー所属効果 → ターンプレイヤー側を全て先に
     → 終わったら非ターンプレイヤー側
  3. 「〜の場合」「〜してもよい」を含む → 解決時に参照/選択
     - resolveGuard を解決直前に再評価
```

## 即時解決例外

以下は `pendingEffects` に積まず **発動時に即解決**:

- 「〜とき、(中略) **代わりに** 〜」 → `engine.resolve.replace`
- 「〜とき、(中略) **無効にする**」 → `engine.resolve.cancel`

## 失敗扱いの裁定 — rules: [24](../rules/24-qa-naming-stun.md)

- 効果が発動したが解決できなかった場合でも **発動した扱い**
  - 例: 「相手の現場のレベル7以下を1枚引く」で対象が0
  - 【ターン①】等の回数制限はカウント済みになる
  - 実装: `engine.resolve.runOne` 内で対象0件でも `flag:declared-use:incr` を emit

## 解決中の状態ロック

```typescript
engine.resolve.lock(state, reason): void           // UIState.lockedForResolution = true
engine.resolve.unlock(state): void
engine.resolve.isLocked(state): boolean
```

- 解決中はプレイヤー操作を受け付けない (UI: [ui-effect-stack.md](2026-05-11-ui-effect-stack.md))

## バッチ処理 / トランザクション

```typescript
engine.resolve.transaction(state, fn): void
  // fn 内の mutation を 1 LogEntry に集約
  // 失敗時 (例: invariant 違反) は state を戻す
engine.resolve.snapshot(state): GameState           // ロールバック用
engine.resolve.restore(state, snap): void
```

## 同名・同時発動と順序選択

```typescript
engine.resolve.requestOwnerOrder(entries[]): Promise<EffectStackEntry[]>
  // 同所有者の同タイミング効果群について順序を所有者に問い合わせ
  // UI: <ResolveOrderPicker> 表示
```

## 行動完了後の解決ポイント

| 完了タイミング | 解決ポイント |
|--------------|-------------|
| 推理完了後 | reasoning:end → resolve all |
| アクション/コンタクト完了後 | action:end → resolve all |
| 宣言能力解決後 | effect:resolve:end → resolve all |
| ターン終了直前 | phase:end:cleanup → resolve all |

## 関連
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)
- [engine-api-events.md](engine-api-events.md)
- [ui-effect-stack.md](2026-05-11-ui-effect-stack.md)
