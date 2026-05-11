# engine.target.* — 対象選択API

「キャラを N 枚まで選び」「相手の現場のレベル7以下の〜」等を宣言的に表現。
rules: [15](../rules/15-abilities-effects.md) §対象指定の解釈

## TargetingRef 型

```typescript
type TargetingRef =
  | { kind: 'self' }                           // 効果発動キャラ自身
  | { kind: 'pick'; query: TargetQuery; n: { min: number; max: number };
      chooser: 'owner' | 'opp' | 'self' | 'opp-of-owner' }
  | { kind: 'all'; query: TargetQuery }        // クエリ条件すべて
  | { kind: 'fromBound'; bindKey: string };    // forEach 内バインド変数
```

## TargetQuery 形

```typescript
type TargetQuery = {
  area?: 'scene' | 'partner-area' | 'hand' | 'deck' | 'remove' | 'evidence' | 'file' | 'case';
  side?: 'self' | 'opp' | 'either' | 'owner' | 'opp-of-owner';
  filter?: TargetFilter;        // AND
  filterAny?: TargetFilter[];   // OR
  excludeSelf?: boolean;        // 効果発動キャラ自身を除外
  state?: ('active'|'sleep'|'stun')[];
  named?: boolean;              // 名乗り状態の限定
  distinctNames?: boolean;      // pick で「カード名が互いに異なる」制約 (G26, D08021)
};

type TargetFilter = {
  cardId?: string | string[];
  cardName?: string | string[];   // 複数名カード対応 (rules/19)
  trait?: string | string[];      // 特徴 (例: [警察], [少年探偵団])
  color?: string | string[];      // 色 (2色は両方持つ)
  keyword?: string | string[];
  apMin?: number; apMax?: number;
  lpMin?: number; lpMax?: number;
  levelMin?: number; levelMax?: number;
  hasSetCards?: boolean;
  custom?: (s, candidate) => boolean;   // 最終手段
};
```

## API

```typescript
engine.target.candidates(state, ref, ctx): Candidate[]
  // クエリを解決し、選択候補を返す (UI表示用)

engine.target.legalCount(state, ref, ctx): { min: number; max: number }
  // 「N枚まで」 → 候補数と比較し実際に選べる範囲を返す
  // 候補0件で n.min=0 なら 0枚選択可 (有効選択肢として通る)

engine.target.resolve(state, ref, ctx, picked?): Candidate[]
  // ref が 'self'/'all' の場合は自動。'pick' の場合は picked を渡す
  // 公式裁定: 「N枚まで」→ 0枚選択可 (rules/15)

engine.target.bind(ctx, key, candidates): EffectCtx
  // forEach の bindKey 用

engine.target.refByName(name): TargetingRef    // 「江戸川コナン」シンボル名
```

## ⚠ 公式裁定の反映 — rules: [15](../rules/15-abilities-effects.md), [19](../rules/19-special-rules.md)

- エリア指定なしの「キャラ」 → `area: 'scene'`
- 「キャラを〜枚まで選び」指定なし → `side: 'either'` (どちらの現場でも)
- 効果発動キャラ自身も選択可 (除外したい場合は `excludeSelf: true`)
- 「N枚まで」 → 0枚を選択可能
- 複数名カード → `cardName` フィルタは分割名すべてマッチ
  - 例: 《江戸川コナン&工藤新一》は `cardName: '江戸川コナン'` でもマッチ
- 同じ「カード名」の重複選択は不可 (rules/19)
  - 例: 《江戸川コナン&工藤新一》と《江戸川コナン》は **両方を同時に下に重ねること不可**
  - `engine.target.resolve` 内で重複チェック

## ヒラメキ / カットイン用の特殊対象

```typescript
engine.target.flashCandidates(state, p, evidenceIdx): CardId|null
  // 証拠 idx がヒラメキ持ちかチェック (rules/10)
engine.target.cutInCandidates(state, p): CardId[]
  // 手札のカットイン持ち。色制限なし (rules/23)
engine.target.disguiseCandidates(state, uid): CardId[]
  // 手札の変装持ち
```

## 関連
- [engine-api-cost.md](engine-api-cost.md)
- [engine-api-conditions.md](engine-api-conditions.md)
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)
