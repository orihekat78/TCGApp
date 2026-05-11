# engine.* — AbilityDef (能力定義)

カード能力1件 = 1 AbilityDef。
カード本体は [engine-api-card-shape.md](engine-api-card-shape.md) 参照。

## AbilityDef

```typescript
type AbilityDef = {
  id: string;                              // カード内一意 ("a1", "a2")
  name?: string;                           // 表示名
  type: AbilityType;                       // 6種
  condition?: Condition;                   // 条件アイコン (rules/17)
  cost?: Cost;                             // 宣言能力時のみ (rules/21)
  trigger?: TriggerDef;                    // type='triggered' 時
  scope?: AbilityScope;                    // 「いつ有効か」
  limit?: AbilityLimit;                    // 【ターン①】等
  effect?: Effect;                         // Descriptor (DSL) — continuous 以外
  continuousModifier?: ContinuousModifier; // type='continuous' 時のみ (G23)
  description: string;                     // 公式テキスト (エラッタ後)
  ruleRefs?: string[];
};

// G23: 常時有効型の selector 計算
// engine.read.char.ap/lp/keywords 等が selector 経由で動的に合算する
type ContinuousModifier = {
  apDelta?: (s, ctx: { uid: string }) => number;
  lpDelta?: (s, ctx: { uid: string }) => number;
  grantKeywords?: (s, ctx: { uid: string }) => string[];
  customSelectorPatch?: (s, uid, base: SceneCharacter) => Partial<SceneCharacter>;
};
// 例: D08005「自分の表向き証拠1つにつきAP+1000」
//   continuousModifier: { apDelta: (s,c) =>
//     1000 * engine.read.player.evidence(s,'self').filter(e=>e.faceUp).length }
```

## AbilityType

```typescript
type AbilityType =
  | 'continuous'      // 「〜の場合 〜限り、AP+X」 常時有効 (rules/24, 25)
  | 'triggered'       // 「〜したとき」 条件発動
  | 'declared'        // 【宣言】 宣言能力 (rules/21)
  | 'icon-cutin'      // カットイン
  | 'icon-flash'      // ヒラメキ
  | 'icon-disguise';  // 変装
```

| Type | 発動 | コスト | 効果切れ |
|------|-----|-------|---------|
| continuous | 自動 (条件成立中) | なし | 条件外で即失効 |
| triggered | Hook 発火 | なし | 通常 (scope による) |
| declared | プレイヤー宣言 | あり (rules/21) | scope による |
| icon-cutin | コンタクト中宣言 | 手札→リムーブ | コンタクト終了時 |
| icon-flash | 証拠リムーブ時 | なし (任意発動) | 解決後 |
| icon-disguise | コンタクト中宣言 | 手札→入替 | 引継ぎ仕様 (rules/23) |

## TriggerDef

```typescript
type TriggerDef = {
  hook: HookName;                          // engine.event 一覧 [engine-api-events.md]
  matcher?: (payload, state) => boolean;
  selfOnly?: boolean;                      // 自分のキャラに対する発火のみ
  ignoreCostInduced?: boolean;             // viaCost: true を無視 (rules/21, 25)
};
```

## AbilityScope

```typescript
type AbilityScope =
  | 'on-scene'           // 現場にいる間 (デフォルト)
  | 'on-partner-area'    // パートナーエリアでも (MR系 rules/18)
  | 'on-hand'            // 手札時 (例: 一部カットイン)
  | 'on-evidence'        // 証拠時 (ヒラメキ rules/10)
  | 'always';            // どこでも (デバッグ用)
```

## AbilityLimit

```typescript
type AbilityLimit =
  | { kind: 'turn'; n: 1 | 2 }       // 【ターン①/②】 (rules/17)
  | { kind: 'game'; n: number }
  | null;
```

⚠ 効果が解決失敗 (対象0等) でも **発動扱い** — limit カウントは進む (rules/24)

## 共通クラス利用パターン

```typescript
// cards/_shared/draw.ts
export const drawN = (n: number): Effect => ({...});

// cards/CT-D08/B08004.ts
import { drawN } from '../_shared/draw';
abilities: [{
  id: 'a1', type: 'declared',
  cost: { kind: 'sleepSelf' },
  effect: drawN(2),
  description: '【宣言】 自身をスリープ: カードを2枚引く',
  ruleRefs: ['rules/21-declared-ability-cost.md']
}]
```

## 関連
- [engine-api-card-shape.md](engine-api-card-shape.md)
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)
- [engine-api-conditions.md](engine-api-conditions.md)
- [CLAUDE.md 共通クラス運用](../CLAUDE.md#共通クラス運用)
