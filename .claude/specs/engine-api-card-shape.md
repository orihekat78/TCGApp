# engine.* — カード定義シェイプ (CardDef)

カード1枚 = 1ファイル (`cards/<set>/<id>.ts`)。
全カードは以下のシェイプを返す。**骨格はこのシェイプ以外を読まない**。
能力 (AbilityDef) の詳細は [engine-api-card-abilities.md](engine-api-card-abilities.md) 参照。

## CardDef 共通

```typescript
type CardDef = {
  id: string;                              // 例: "B08004"
  no: string;                              // 例: "0001/B08004"
  kind: 'character' | 'event' | 'partner' | 'case';
  names: string[];                         // 複数名カードは複数 (rules/19)
  colors: string[];                        // 1〜2色 (rules/20)
  level?: number;                          // event/character (パートナー除く)
  ap?: number;                             // character のみ
  lp?: number;                             // character/partner
  traits: string[];                        // 特徴 (例: [警察], [少年探偵団])
  rarity: string;                          // R/SR/MR/PR ...
  isMR?: boolean;                          // MR フラグ (rules/18)
  flavor?: string;
  imageUrl: string;                        // ローカル運用 (rules: 法務スタンス)
  abilities: AbilityDef[];                 // [engine-api-card-abilities.md] 参照
  ruleRefs: string[];                      // 例: ["rules/11-reasoning.md §LP≤0"]
                                            // ファイル冒頭にも必須コメント (CLAUDE.md)
};
```

## 種別ごとの拡張

```typescript
type PartnerDef = CardDef & {
  kind: 'partner';
  // パートナー共通能力 (アシスト・事件解決) は engine 側に組込済
  // 個別能力のみ abilities に記述
};

type CaseDef = CardDef & {
  kind: 'case';
  caseLevel: number;                  // 必要証拠数の基準 (実際は先攻7/後攻6)
  caseTraits: string[];               // 例: ["古城", "婚活"]
};

type EventDef = CardDef & {
  kind: 'event';
  // 使用後リムーブは engine が自動処理
  // カットイン能力は abilities に icon-cutin で記述
};

type CharacterDef = CardDef & {
  kind: 'character';
  ap: number; lp: number; level: number;
  // 名乗り例外キーワード (迅速/突撃/突撃[X]) は keywords で表現
  keywords: string[];
};
```

## 登録 / 参照

```typescript
engine.cards.register(def: CardDef): void
engine.cards.get(id): CardDef|undefined
engine.cards.all(): CardDef[]
engine.cards.byTrait(trait): CardDef[]
engine.cards.byColor(color): CardDef[]
engine.cards.byName(name): CardDef[]                // 複数名カードもマッチ (rules/19)
```

## バリデーション

```typescript
engine.cards.validate(def): ValidationResult
  // - effect は engine.effect.validate を通す
  // - ability id 重複チェック
  // - ruleRefs が rules/ 配下に存在するか
  // - kind と必須プロパティ整合 (例: character の ap/lp/level)
  // - 複数名カードの命名規則 ('&' / '『 』' / '( )' のみ rules/19)
engine.cards.validateAll(): ValidationResult[]
  // 起動時バッチ。エラーがあれば boot 中断
```

## ID と複数名カード

- `id` は印刷物の通し番号 (例: `B08004`)
- `names` 配列は **すべての分割名** を含む (rules/19)
  - 例: 《江戸川コナン&工藤新一》 → `['江戸川コナン&工藤新一', '江戸川コナン', '工藤新一']`
- 同一カードでも絵柄違いはエラッタ等で `id` 異なる場合あり
- デッキ構築の「同じカード3枚まで」判定は **id 単位** (rules/02)

## 関連
- [engine-api-card-abilities.md](engine-api-card-abilities.md) — AbilityDef 詳細
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)
