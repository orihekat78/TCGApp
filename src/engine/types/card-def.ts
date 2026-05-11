// CardDef 型定義
// rules: 02-deck-construction.md, 06-card-types.md, 13-keywords.md

export type CardDef = {
  id: string;
  no: string;
  kind: 'character' | 'event' | 'partner' | 'case';
  names: string[];        // 複数名カード対応 (rules: 19-special-rules.md)
  colors: string[];
  level?: number;
  ap?: number;
  lp?: number;
  traits: string[];
  rarity: string;
  isMR?: boolean;         // rules: 18-mr.md
  flavor?: string;
  imageUrl: string;
  abilities: unknown[];   // AbilityDef は Phase 5 で詳細化
  ruleRefs: string[];
};
