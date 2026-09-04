# 🤖 engine.read

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `811cad3d1237`

純粋セレクタ（GameState を読むのみ、副作用なし）

## アグリゲータ (`engine.read`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `char`
- `def`
- `game`
- `log`
- `player`
- `scene`
- `turn`

## サブ namespace

| 名前 | メンバー |
| ---- | -------- |
| `char` | `ap`, `auraUntargetableByAction`, `charProtectedFrom`, `charProtectedFromOppEvent`, `charUntargetableByOppEffect`, `charUntargetableByOppEvent`, `colors`, `declaredUseCount`, `filteredAssaultKeywords`, `hasKeyword`, `hasTextAbility`, `isNamed`, `keywords`, `level`, `lp`, `names`, `noAutoActivateLocked`, `originalAbilitiesDisabled`, `originalAbilitiesDisabledOn`, `restrictsOpponent`, `selfContinuousFlag`, `setCardAbilityUseCount`, `setCards`, `setCardsDetailed`, `stackedCount`, `state`, `traits`, `turnEffect` |
| `def` | `allTraits`, `byColor`, `byTrait`, `card`, `isMR` |
| `game` | `canPartnerAssist`, `canPartnerSolveCase`, `canWin`, `cannotSolveCase`, `evidenceShortfall`, `partnerAssistFileThreshold`, `partnerSolveOverride`, `refreshCount`, `result` |
| `log` | `byPlayer`, `byTurn`, `search`, `tail` |
| `player` | `case`, `deck`, `deckCount`, `evidence`, `evidenceCount`, `file`, `fileCount`, `hand`, `handCount`, `partner`, `remove`, `removeCount`, `requiredEvidence`, `scratchTrace` |
| `scene` | `activeOnes`, `all`, `byCardId`, `byUid`, `count`, `enterOrderOf`, `named`, `nonNamed`, `sleepOrStun` |
| `turn` | `current`, `flags`, `isFirstPlayerFirstTurn`, `number`, `opponent`, `phase`, `player` |

---

## ソース

- [`src/engine/read/index.ts`](../../../src/engine/read/index.ts)

