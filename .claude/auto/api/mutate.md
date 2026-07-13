# 🤖 engine.mutate

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `20920a4daccb`

Immer draft 上の primitive 変更操作

## アグリゲータ (`engine.mutate`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `case`
- `char`
- `deck`
- `evidence`
- `file`
- `flag`
- `gameResult`
- `hand`
- `log`
- `partner`
- `remove`
- `scene`
- `scratchTrace`

## サブ namespace

| 名前 | メンバー |
| ---- | -------- |
| `case` _(internal: `caseOp`)_ | `init`, `toResolved` |
| `char` | `clearTurnEffects`, `disableOriginalAbilities`, `disguiseInto`, `grantAbility`, `grantKeyword`, `grantTrait`, `modifyAP`, `modifyLP`, `modifyLevel`, `removeAllSetAndStacked`, `removeOneSetCard`, `revokeKeyword`, `revokeKeywordTurn`, `revokeTrait`, `setCard`, `setOverrideAP`, `setOverrideAPTurn`, `setOverrideLP`, `setOverrideLPTurn`, `setTurnEffect`, `stackCard`, `tagSelectedByOwnMr` |
| `deck` | `draw`, `peek`, `refresh`, `removeFromTop`, `reveal`, `shuffle`, `toBottom`, `toTop` |
| `evidence` | `addFromDeck`, `flipFaceDown`, `flipFaceUp`, `gainCard`, `removeAt`, `removeTop`, `toDeckTop`, `toRemove` |
| `file` | `addFromDeckTop`, `flipTop`, `insertAssistedPartner`, `insertBottomFaceUp`, `popTop`, `removeAssistedPartner` |
| `flag` | `incrDeclaredUseCount`, `resetTurnFlags`, `setAssistedThisTurn`, `setHandUseUsed`, `setNextHintUsed` |
| `gameResult` | `clear`, `set` |
| `hand` | `add`, `discardToRemove`, `emitReveal`, `remove`, `toDeckBottom` |
| `log` | `append`, `clear` |
| `partner` | `addAreaCardFromRemove`, `assist`, `init`, `removeAreaCardsToRemove`, `returnFromFile`, `setLocation`, `setState`, `solveCase` |
| `remove` | `add`, `emitExit`, `removeFromHere` |
| `scene` | `clearNamed`, `enter`, `removeToRemove`, `removeToRemoveBatch`, `setState`, `switchEnter`, `toDeck`, `toDeckBottom`, `toEvidence`, `toHand`, `toStack`, `tryActivate` |
| `scratchTrace` | `set` |

---

## ソース

- [`src/engine/mutate/index.ts`](../../../src/engine/mutate/index.ts)

