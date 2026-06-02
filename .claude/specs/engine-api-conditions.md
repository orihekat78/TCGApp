# engine.cond.* — 条件評価API

条件アイコン (rules/17) と「〜の場合」型条件を宣言的に評価。
**条件不成立 → そもそもその能力/効果を持たない扱い** (rules/17 Point)。

## Condition 型

```typescript
type Condition =
  | { kind: 'true' } | { kind: 'false' } | { kind: 'not'; c: Condition }
  | { kind: 'and'; cs: Condition[] } | { kind: 'or'; cs: Condition[] }
  // 条件アイコン
  | { kind: 'turn'; player: 'self' | 'opp' }                  // 【自分/相手ターン中】
  | { kind: 'partnerColor'; color: string | string[] }        // 【パートナー(色)】
  | { kind: 'caseColor'; color: string | string[]; combine?: 'or' | 'and' }
                                                              // 【事件(色)】単色 or & (rules/17)
  | { kind: 'caseTrait'; trait: string }                      // 【事件(特徴)】
  | { kind: 'fileAtLeast'; n: number }                        // 【FILE(X)】 (アシスト中含む)
  | { kind: 'caseStatus'; status: '事件編' | '解決編' }       // 【事件編】【解決編】
  | { kind: 'bond'; cardName: string | string[] }             // 【絆 (カード名)】
  // 状態系
  | { kind: 'sceneHas'; query: TargetQuery; nMin?: number }   // 「現場にXがいる場合」
  | { kind: 'apAtLeast'; ref: TargetingRef; n: number }       // 「APが N 以上の場合」
  | { kind: 'lpAtLeast'; ref: TargetingRef; n: number }
  | { kind: 'evidenceAtLeast'; player: 'self' | 'opp'; n: number }
  | { kind: 'fileTopType'; type: 'card-back' | 'assisted-partner' }
  | { kind: 'scratchTrace'; player: 'self' | 'opp'; v: '発見済' | '未発見' }
  // ターン跨ぎ
  | { kind: 'flag'; player: 'self' | 'opp'; key: keyof TurnScopedFlags; v: boolean }
  | { kind: 'declaredUseUnder'; uid: string; abilityId: string; max: number }
                                                              // 【ターン①/②】判定
  // バインド変数参照 (G19)
  | { kind: 'bound'; key: string; presence?: 'exists' | 'matched' }
                                                              // 例: deckRevealUntil で bindMatch があるか判定
  // リムーブエリア集計 (G20)
  | { kind: 'removeColorAtLeast'; player: 'self'|'opp'; color: string|string[]; n: number }
                                                              // 例: D11019「自分のリムーブに【黄】20枚以上」
  | { kind: 'removeTraitAtLeast'; player: 'self'|'opp'; trait: string|string[]; n: number }
                                                              // 同種頻出予想で追加
  | { kind: 'removeNameAtLeast'; player: 'self'|'opp'; cardName: string|string[]; n: number }
  // 重ね数閾値 (G27, D08021)
  | { kind: 'stackedCountAtLeast'; ref: TargetingRef; n: number }
  | { kind: 'custom'; check: (s, ctx) => boolean };
```

## API

```typescript
engine.cond.eval(state, c, ctx): boolean
engine.cond.evalAll(state, cs[], ctx): boolean[]
engine.cond.describe(c): string                  // UI 説明文用 (例: "事件が青のとき")
```

## ⚠ 重要な裁定 — rules: [17](../rules/17-icons.md), [24](../rules/24-qa-naming-stun.md), [25](../rules/25-qa-effects-resolution.md)

### 1. 条件不成立時の扱い

- 条件を満たしていない場合 **その能力/効果を持っていない扱い**
  - 「〜したとき」条件を満たしても発動しない
  - 宣言能力なら使用できない
  - イベント/カットインなら **使えるが何も起こらない**
- 実装: Hook 登録時に `condition` を渡し、発火時に `engine.cond.eval` を通す

### 2. 常時有効型 (「〜の場合」型) の挙動

- 条件成立中は **自動的に効果を持つ**
- 条件成立から外れた瞬間 **効果も失われる**
  - 例: 「APが6000以上の場合、突撃を持つ」 → AP低下で突撃失効
- ただし **既に開始したアクションは継続** (rules/22, 24)
  - 実装: アクション開始時の能力スナップショットを `actionContext.snapshot` に保存

### 3. 解決時参照

- 効果発火→解決の間に発動キャラが現場を離れても効果は無効にならない (rules/15, 22)
- 「〜の場合」「〜してもよい」を含む未解決効果 → **解決時** に参照/選択 (rules/15)
  - 実装: `engine.resolve.evalGuard(effectId, state)` を解決直前に呼ぶ

### 4. 同時リムーブと条件参照 — rules: [25](../rules/25-qa-effects-resolution.md)

- 解決時の盤面を参照 → 同時リムーブで両方消えていれば条件不成立
  - 実装: 解決前に `engine.cond.eval(currentState, ...)` で再評価

### 5. 【絆】の例外

- パートナーは【絆】条件を満たさない (rules/17)
- 実装: `cond.bond` の判定で `area === 'scene'` のみ対象

## 関連
- [engine-api-events.md](engine-api-events.md) — Hook の condition フィールド
- [engine-api-resolver.md](engine-api-resolver.md)
- [card-condition-catalog.md](card-condition-catalog.md) — カード実装の condition 早見表
