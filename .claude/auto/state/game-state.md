# 🤖 GameState shape

> ⚠️ このファイルは `scripts/gen-docs/gen-state.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:state`
> Source hash: `2554f3b9ec7d`

`src/engine/types/game-state.ts` から抽出した GameState の構造図。

9 型・9 関係を抽出。`«object×N»` は匿名 object 型（N フィールド）の省略表記。

## Mermaid classDiagram

```mermaid
classDiagram
  class GameState {
    +turn: «object×4»
    +players: «object×2»
    +pendingEffects: EffectStackEntry[]
    +actionContexts?: Record<string, ActionContext>
    +actionContextSeq?: number
    +effectEntrySeq?: number
    +sceneUidSeq?: number
    +pendingTurnTransition?: «object×3»
    +pendingRuntimeSeq?: number
    +pendingRuntimeState?: «object×5»
    +effectTriggerBatchSeq?: number
    +declaredBatchSeq?: number
    +pendingReasoningContinuation?: ReasoningContinuation
    +reasoningContinuationSeq?: number
    +effectTriggerBatchContext?: number
    +effectTriggerBatchConfirmedContext?: boolean
    +setCardInstanceSeq?: number
    +reservedEffectSeq?: number
    +publicHandRevealSeq?: number
    +reservedEffects: ReservedEffectEntry[]
    +scratchTrace: «object×2»
    +turnState: «object×2»
    +refreshCount: «object×2»
    +causalLog?: CausalLogStateV1
    +log: LogEntry[]
    +gameResult?: «object×2»
  }
  class PlayerState {
    +partner: PartnerOnBoard
    +partnerAreaMR?: SceneCharacter | null
    +partnerAreaCards?: CardId[]
    +case: «object×5»
    +scene: SceneCharacter[]
    +hand: CardId[]
    +deck: CardId[]
    +evidence: EvidenceCard[]
    +remove: CardId[]
    +file: FileCard[]
    +mulliganUsed: boolean
  }
  class TurnScopedFlags {
    +handUseUsed: boolean
    +nextHintUsed: boolean
    +assistedThisTurn: boolean
    +declaredAbilityUseCount: Record<string, number>
    +globalCharacterTraitGrants_turn?: string[]
    +enterCountThisTurn?: number
    +eventUseBanned?: boolean
    +nextHintBanned?: boolean
    +useEnterBannedCardNames?: string[]
    +hiramekiSuppressed?: boolean
    +evidenceGainSuppressed?: boolean
    +shippuFiredThisTurn?: boolean
    +shippuWaiveArmed?: boolean
    +cutinBanned?: boolean
    +disguiseBanned?: boolean
    +actionCutinBanOppFilter?: TargetFilter
  }
  class CausalLogStateV1 {
    +schemaVersion: 1
    +sessionId: string
    +nextSequence: number
  }
  class PartnerOnBoard {
    +cardId: string
    +state: 'active' | 'sleep' | 'stun'
    +location: 'partner-area' | 'file-area' | 'mr-removed'
    +turnEffects?: Record<string, unknown>
  }
  class SceneCharacter {
    +cardId: string
    +uid: string
    +state: 'active' | 'sleep' | 'stun'
    +isNamed: boolean
    +enterOrder: number
    +enterOrderThisTurn?: number
    +setCards: SetCardEntry[]
    +stackedCards: StackedCards
    +keywordOverrides: «object×2»
    +apOverride: number | null
    +lpOverride: number | null
    +turnEffects: «object×3»
    +declaredUseCount: Record<string, number>
  }
  class EvidenceCard {
    +cardId: string
    +faceUp: boolean
    +origin: EvidenceOrigin
  }
  class SetCardEntry {
    +cardId: string
    +faceUp: boolean
    +instanceId?: string
    +replacementUseCounts?: Record<string, { turn: number; count: number…
  }
  class EvidenceOrigin {
    +turn: number
    +via: 'reasoning' | 'action-case' | 'effect' |…
    +sourceCardId?: string
  }
  GameState --> PlayerState : players
  GameState --> TurnScopedFlags : turnState
  GameState --> CausalLogStateV1 : causalLog
  PlayerState --> PartnerOnBoard : partner
  PlayerState --> SceneCharacter : partnerAreaMR
  PlayerState --> SceneCharacter : scene
  PlayerState --> EvidenceCard : evidence
  SceneCharacter --> SetCardEntry : setCards
  EvidenceCard --> EvidenceOrigin : origin
```

---

## ソース

- [`src/engine/types/game-state.ts`](../../../src/engine/types/game-state.ts)
