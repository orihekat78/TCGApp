# engine.types.* — 共通戻り値型・コンテキスト型カタログ

各 API ファイルで参照される共通型を集約。

## EffectCtx — 効果実行コンテキスト

```typescript
type EffectCtx = {
  source: {                       // 効果発動源
    cardId?: string;
    uid?: string;                 // 現場キャラ識別子
    abilityId?: string;
    player: 'self' | 'opp';
    area: 'scene'|'partner-area'|'hand'|'evidence'|'file'|'remove'|'case';
  };
  bindings: Record<string, Candidate[]>;  // forEach / deckRevealUntil の bindKey 用
  picked?: Candidate[];                    // pick の選択結果
  viaCost?: boolean;                       // コスト由来フラグ (rules/21, 25)
  costPaid?: Record<string, any>;          // コスト支払結果 (例: flipFaceUpEvidence.count)
                                           // effect 側で `$cost.flipFaceUpEvidence.count` 等として参照
  triggerPayload?: any;                    // 発火 Hook の payload
  contact?: ContactCtx;                    // コンタクト中効果用バインド (G21)
  dyn?: Record<string, any>;               // 動的式評価結果 (G24)
                                           //   $self.ap → ctx.dyn.self.ap
                                           //   $dyn.shogtanteiCount → ctx.dyn.shogtanteiCount
                                           //   evaluator は engine.dyn.eval(s, expr, ctx)
  rng?: () => number;                      // 確率系効果用
  parent?: EffectCtx;                      // ネスト効果の親参照
};

type ContactCtx = {
  byUid: string;          // アクションした側 (攻撃)
  targetUid?: string;     // 対象 (キャラの場合) — $contact.targetUid
  guardUid?: string;      // ガード成立時のガードキャラ
  attackerSide: 'self'|'opp';
};
```

## Candidate — 対象選択候補

```typescript
type Candidate =
  | { kind: 'char'; uid: string; cardId: string; player: 'self'|'opp' }
  | { kind: 'partner'; player: 'self'|'opp' }
  | { kind: 'card'; cardId: string; area: string; player: 'self'|'opp'; index?: number }
  | { kind: 'evidence'; player: 'self'|'opp'; index: number }
  | { kind: 'file'; player: 'self'|'opp'; index: number };
```

## 戻り値型カタログ

```typescript
type RemoveResult = {
  removed: { uid?: string; cardId: string };
  setCardsRemoved: CardId[];
  stackedCardsRemoved: number;
  triggeredHooks: HookName[];      // 副次発火した Hook 一覧
};

type RefreshResult =
  | { ok: true; reshuffled: number; opponentEvidenceGained: 1 }   // rules/14 相手証拠+1
  | { ok: false; loserPlayer: 'self'|'opp'; reason: 'remove-empty' };  // 0枚敗北

type JudgeResult = {
  attackerAP: number;
  defenderAP: number;
  defenderRemoved: boolean;        // ≧でリムーブ・同値もリムーブ (rules/08)
  attackerRemoved: false;          // 攻撃キャラはリムーブされない (rules/08)
};

type PayResult = {
  paidItems: PaidRecord[];
  releasedTriggers: HookName[];    // 支払い中 emit された Hook (viaCost=true)
};

type PaidRecord = { kind: Cost['kind']; details: any };

type CostPreview = {
  description: string;
  requiresChoice: boolean;
  choices?: { label: string; value: any }[];
  affordable: boolean;
};

type ValidationResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; errors: string[] };

type GameResult = { winner: 'self'|'opp'; reason: 'evidence'|'deck-out'|'concede' };

type ActionContext = {
  id: string;
  byUid: string;
  target: { kind: 'char'; uid: string } | { kind: 'case'; player: 'self'|'opp' };
  phase: ActionPhase;
  guarded?: { guardUid: string };
  apSnapshot?: { aUid: string; aAP: number; bUid: string; bAP: number };
  startedAt: { turn: number; nano: number };
};

type Unsubscribe = () => void;

type PlaytestReport = {
  total: number; aWin: number; bWin: number; deckOut: number;
  invariantViolations: { type: string; message: string; count: number }[];
  avgTurns: number;
};

type EvidenceOrigin = {
  turn: number;
  via: 'reasoning' | 'action-case' | 'effect' | 'opening' | 'refresh-penalty';
  sourceCardId?: string;
};

type TurnSnapshot = Readonly<GameState['turn']>;
type CaseInfo = Readonly<GameState['players']['self']['case']>;
```

## HookName 完全 union

[engine-api-events.md](engine-api-events.md) に分離。

## 関連
- [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)
- [engine-api-events.md](engine-api-events.md)
