# 02. カードJSONスキーマ設計

## 公式JSONの主要フィールド（実データ準拠）

| フィールド | 型 | 例 | 説明 |
|-----------|-----|------|------|
| `id` | number | 1 | DB内部ID（rarity違いで別ID） |
| `card_id` | string | "P001", "0944" | **論理ID（同一カードの判定用）** |
| `card_num` | string | "B01001", "D11019" | 印刷番号（rarity含む） |
| `title` | string | "江戸川コナン" | カード名 |
| `package` | string | "CT-D11 Case-ThemeDeck 06 千速と..." | 収録パッケージ |
| `color` | enum | "青", "赤", "黄", "緑", "黒", "白" | 色 |
| `type` | enum | "パートナー" / "キャラ" / "イベント" / "事件" | 種別 |
| `rarity` | string | "C", "CP", "SEC", "D" | レアリティ |
| `cost` | string\|null | "4" | レベル（手札使用コスト） |
| `ap` | string\|null | "6000" | アタックポイント |
| `lp` | string\|null | "1" | ロジックポイント |
| `feature` | string | 効果テキスト全文 | 主要効果 |
| `cut_in` | string\|null | "【カットイン】AP+1000" | カットイン能力 |
| `hirameki` | string\|null | ヒラメキ効果 | ヒラメキ能力 |
| `henso` | string\|null | 変装効果 | 変装能力 |
| `category1/2/3` | string\|null | "婚活パーティー", "少年探偵団" | 特徴 |
| `difficulty_first` | string\|null | "7" | 先攻必要証拠数（事件のみ） |
| `difficulty_second` | string\|null | "6" | 後攻必要証拠数（事件のみ） |
| `q_a` | string (JSON or text) | 公式Q&A | カード固有裁定 ★貴重 |
| `rcp_limit` | number | 3 | デッキ採用上限 |
| `rcp_sameid_limit` | number | 3 | 同ID上限 |
| `linkto` / `contain` | string\|null | 関連カード参照 | カード間リンク |
| `main_path` / `sub_path` | string | "1743743093420786.jpg" | 画像ファイル名 |
| `release_date` | string\|null | "2024-05-14 00:00:00" | 発売日 |

## TypeScript インターフェース案（簡略版）

```typescript
export type CardType = 'partner' | 'chara' | 'event' | 'case';
export type CardColor = 'blue' | 'red' | 'yellow' | 'green' | 'black' | 'white';

export interface CardMeta {
  cardId: string;         // 論理ID (P001 / 0944)
  cardNum: string;        // 印刷番号 (D11019)
  title: string;
  package: string;        // CT-D11
  type: CardType;
  color: CardColor;
  rarity: string;
  cost: number | null;    // string→number 変換
  ap: number | null;
  lp: number | null;
  features: string[];     // category1/2/3 を配列化
  imageMainPath: string;
  imageSubPath: string;
  // 事件専用
  difficultyFirst?: number;
  difficultySecond?: number;
  // 関連カード
  linkTo?: string[];
  // デッキ制限
  deckLimit: number;
  sameIdLimit: number;
}

export interface CardEffect {
  cardId: string;
  apply(state: GameState, ctx: Context): GameState;
  // ヒラメキ・変装・カットインのフラグも別フィールドで保持
}
```

## メタとロジックの分離

- `cards/<type>/<package>/<cardNum>.meta.json` — 公式から取得した生データ
- `cards/<type>/<package>/<cardNum>.ts` — 効果ロジック（手書き実装）
- `cards/<type>/<package>/<cardNum>.qa.md` — カード固有Q&A（参照用）

## 関連
- [01-card-data-source.md](01-card-data-source.md)
- [04-folder-structure.md](04-folder-structure.md)
