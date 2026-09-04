// Candidate 型定義
// rules: 07-action-flow.md, 08-contact.md, 11-reasoning.md

export type Candidate =
  | { kind: 'char'; uid: string; cardId: string; cardName?: string; player: 'self' | 'opp' }
  | { kind: 'partner'; player: 'self' | 'opp' }
  | { kind: 'card'; uid?: string; cardId: string; area: string; player: 'self' | 'opp'; index?: number; hostUid?: string; setCardInstanceId?: string; occurrenceWitness?: string }
  | { kind: 'evidence'; player: 'self' | 'opp'; index: number; occurrenceWitness?: string }
  | { kind: 'file'; player: 'self' | 'opp'; index: number };
