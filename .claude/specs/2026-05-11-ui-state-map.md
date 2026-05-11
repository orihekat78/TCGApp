# GameState スキーマ (2026-05-11)

ゲーム内部状態の TypeScript 型定義。UIマッピング・selector は [ui-state-mapping.md](2026-05-11-ui-state-mapping.md)。

## GameState

```typescript
type GameState = {
  turn: {
    number: number;
    player: 'self' | 'opp';
    phase: 'auto' | 'main' | 'end';
    isFirstPlayerFirstTurn: boolean;  // 先攻1ターン目フラグ
  };
  players: { self: PlayerState; opp: PlayerState };
  pendingEffects: Effect[];           // 効果スタック
  scratchTrace: { self: '未発見' | '発見済'; opp: '未発見' | '発見済' };
  turnState: {
    self: TurnScopedFlags;
    opp:  TurnScopedFlags;
  };
  refreshCount: { self: number; opp: number };
  log: LogEntry[];
  gameResult?: { winner: 'self' | 'opp'; reason: 'evidence' | 'deck-out' };
};
```

## PlayerState

```typescript
type PlayerState = {
  partner: PartnerOnBoard;
  // requiredEvidence: 先攻=7 / 後攻=6 (rules/01)
  case: { cardId: string; status: '事件編' | '解決編'; requiredEvidence: number; colors: string[] };
  scene: SceneCharacter[];     // 最大5
  hand: CardId[];              // 相手のは枚数のみ
  deck: CardId[];
  evidence: EvidenceCard[];
  remove: CardId[];
  file: FileCard[];
};
```

## SceneCharacter

```typescript
type SceneCharacter = {
  cardId: string;
  uid: string;                          // 同名キャラ複数対応
  state: 'active' | 'sleep' | 'stun';
  isNamed: boolean;                     // 名乗り状態
  enterOrder: number;                   // ターン中の登場順 (疾風N用)
  setCards: CardId[];                   // セットされたカード
  stackedCards: number;                 // 下に重ね枚数のみ
  keywordOverrides: {
    granted: string[];                  // 効果で付与された能力
    disabledOriginal: boolean;          // 「元の能力を無効にする」
  };
  apOverride: number | null;            // 「元のAPを0にする」適用時
  lpOverride: number | null;            // 「元のLPを0にする」適用時
  turnEffects: {
    contactImmune: boolean;             // 「コンタクトによってリムーブされない」
    removeOnTurnEnd: boolean;           // ターン終了時リムーブ
    [other: string]: any;
  };
  declaredUseCount: Record<string, number>;  // 【ターン①】【ターン②】用
};
```

## その他の型

```typescript
type PartnerOnBoard = {
  cardId: string;
  state: 'active' | 'sleep' | 'stun';
  location: 'partner-area' | 'file-area' | 'mr-removed';
};

type EvidenceCard = {
  cardId: string;
  faceUp: boolean;
  origin: { turn: number; via: 'reasoning' | 'action-case' | 'effect'; sourceCardId?: string };
};

type FileCard =
  | { type: 'card-back' }
  | { type: 'assisted-partner'; cardId: string };

type TurnScopedFlags = {
  handUseUsed: boolean;
  nextHintUsed: boolean;
  assistedThisTurn: boolean;
  declaredAbilityUseCount: Record<string, number>;
};

type LogEntry = {
  ts: number; player: 'self'|'opp'; turn: number;
  action: string; target?: string; result?: string;
};
```

## 関連

- [ui-state-mapping.md](2026-05-11-ui-state-mapping.md) — UIマッピング表 + selectors
- [ui-overall.md](2026-05-11-ui-overall.md)
