// spec: .claude/specs/meta-ui/02-design-system.md + 05-engine-stub.md
// カード基本型 — design-mockups_v2/06-card-data.jsx の CARD_POOL 構造に対応

export type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';
export type CardKind = 'character' | 'event' | 'partner' | 'case';

export interface CardDef {
  num: string;
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
  partner: string;
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
