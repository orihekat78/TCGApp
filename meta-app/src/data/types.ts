// spec: .claude/specs/meta-ui/02-design-system.md + 05-engine-stub.md
// カード基本型 — design-mockups_v2/06-card-data.jsx の CARD_POOL 構造に対応

export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';
export type CardKind = 'character' | 'event' | 'partner' | 'case';

export interface CardDef {
  /** 印刷番号 (cardNum, 例 D08003)。絵柄違い (パラレル) ごとに異なる。 */
  num: string;
  /** 正規カードID (cardId, 例 0489)。パラレルは同一 id を共有 = ゲーム上「同じカード」。
   *  rules/02-deck-construction.md「絵柄が違っても ID が同じであれば同じカード」。 */
  id: string;
  name: string;
  color: CardColor;
  type: CardKind;
  cost?: number;
  ap?: number;
  lp?: number;
  level?: number;
  rarity?: string;
  features?: string[];
  keywords?: string[];
  effectShort?: string;
}

export interface DeckRecord {
  id: string;
  name: string;
  /** パートナーカード (cardNum)。1 デッキ 1 枚必須 (rules/02)。 */
  partner: string;
  /** 事件カード (cardNum)。1 デッキ 1 枚必須。パートナー1+事件1+キャラ/イベント40 で 1 セット (rules/02)。 */
  case: string;
  cards: { num: string; count: number }[];
  modified: number;
}

export interface MatchRecord {
  id: string;
  recorded: number;
  won: boolean;
  deckName: string;
  oppDeckName?: string;
  mode?: 'solo' | 'observe';
  turns: number;
  duration: number;
  mvp?: string;
  evidGot: number;
  evidLost: number;
  contacts: number;
  hirameki: number;
  misread: number;
  p1Target: 7 | 6;
  p2Target: 7 | 6;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
