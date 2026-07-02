# 🤖 GameState shape

> ⚠️ このファイルは `scripts/gen-docs/gen-state.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:state`
> Source hash: `374be65b5268`

`src/engine/types/game-state.ts` から抽出した GameState の構造図。

9 型・9 関係を抽出。`«object×N»` は匿名 object 型（N フィールド）の省略表記。

## Mermaid classDiagram

```mermaid
classDiagram
  class GameState {
    +turn: «object×4»
    +players: «object×2»
    +pendingEffects: EffectStackEntry[]
    +scratchTrace: «object×2»
    +turnState: «object×2»
    +refreshCount: «object×2»
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
    +enterCountThisTurn?: number
    +eventUseBanned?: boolean
    +nextHintBanned?: boolean
    +hiramekiSuppressed?: boolean
    +shippuFiredThisTurn?: boolean
    +cutinBanned?: boolean
    +disguiseBanned?: boolean
  }
  class LogEntry {
    +ts: number
    +player: 'self' | 'opp'
    +turn: number
    +action: string
    +target?: string
    +result?: string
  }
  class PartnerOnBoard {
    +cardId: string
    +state: 'active' | 'sleep' | 'stun'
    +location: 'partner-area' | 'file-area' | 'mr-removed'
  }
  class SceneCharacter {
    +cardId: string
    +uid: string
    +state: 'active' | 'sleep' | 'stun'
    +isNamed: boolean
    +enterOrder: number
    +enterOrderThisTurn?: number
    +setCards: SetCardEntry[]
    +stackedCards: number
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
  }
  class EvidenceOrigin {
    +turn: number
    +via: 'reasoning' | 'action-case' | 'effect' |…
    +sourceCardId?: string
  }
  GameState --> PlayerState : players
  GameState --> TurnScopedFlags : turnState
  GameState --> LogEntry : log
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
