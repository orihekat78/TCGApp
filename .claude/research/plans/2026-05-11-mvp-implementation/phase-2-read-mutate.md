# Phase 2: engine.read / engine.mutate / engine.invariant

**Goal:** [engine-api-state-read.md](../../../specs/engine-api-state-read.md) 全 selectors と [engine-api-state-mutate.md](../../../specs/engine-api-state-mutate.md) + [-meta.md](../../../specs/engine-api-state-mutate-meta.md) の全 mutation primitives を Immer 経由で実装。invariant チェッカも併行。

**TDD 原則:** 1 mutation = 1 test minimum。エッジケース ([engine-api-edge-cases.md](../../../specs/engine-api-edge-cases.md)) は別 test。

**Files:**
- Create: `src/engine/read/{turn,player,scene,char,def,game,log}.ts` (各 ~30LOC)
- Create: `src/engine/mutate/{deck,hand,scene,char,evidence,file,remove,partner,case,scratchTrace,flag,gameResult,log}.ts`
- Create: `src/engine/invariant/{scene,case,partner,deck,frozen}.ts`
- Test: `tests/engine/read/*.test.ts`, `tests/engine/mutate/*.test.ts`, `tests/engine/invariant/*.test.ts`

---

### Task 2.1: read.turn / read.player (ターン+プレイヤー基本)

- [ ] テスト: `read.turn.player(s)` が `s.turn.player` を返す等
- [ ] 実装: 純粋関数で thin wrappers
- [ ] commit

### Task 2.2: read.scene / read.char (現場・キャラ詳細)

- [ ] テスト: `byUid` `byCardId` `enterOrderOf` `apOverride` 反映 計算
- [ ] 実装: AP/LP/keywords は `continuousModifier` (G23) を選択集約
- [ ] commit

### Task 2.3: read.def / read.game / read.log

- [ ] テスト: cardDB 参照 / canWin / log 検索
- [ ] 実装
- [ ] commit

### Task 2.4: mutate.deck (draw / peek / reveal / toBottom / toTop / shuffle / refresh)

- [ ] テスト: draw 1枚で deck が 1枚減 / hand に追加。deck 0 で refresh 自動発火 + 相手 evidence+1 + scratchTrace 発見済 (rules/14, 26)
- [ ] 実装 (Immer produce 内)
- [ ] エッジ: deck+remove 両0で `lose:by-deck-out` Hook emit
- [ ] commit

### Task 2.5: mutate.hand / mutate.remove

- [ ] テスト: add/remove/discardToRemove/toDeckBottom
- [ ] commit

### Task 2.6: mutate.scene (enter / switchEnter / removeToRemove / toDeckBottom / setState / tryActivate / clearNamed)

- [ ] テスト: enter で 5枚超なら例外。switchEnter で旧キャラリムーブ。tryActivate でスタンならスリープ化 (rules/03)
- [ ] エッジ: removeToRemove で setCards/stackedCards も同時リムーブ (rules/16)
- [ ] commit

### Task 2.7: mutate.char (modifyAP/LP / setOverrideAP/LP / grantKeyword / revokeKeyword / disableOriginalAbilities / setTurnEffect / setCard / stackCard / disguiseInto)

- [ ] テスト: modifyAP scope='turn' は ターン終了時にリセット。disguiseInto で引継ぎ table 適用 (rules/23)
- [ ] エッジ: AP負値 OK (rules/19)
- [ ] commit

### Task 2.8: mutate.evidence / mutate.file

- [ ] テスト: addFromDeck / removeTop / flipFaceUp / file.addFromDeckTop (先攻初手1枚例外 rules/04)
- [ ] commit

### Task 2.9: mutate.partner / mutate.case / mutate.scratchTrace

- [ ] テスト: assist で sleep+FILE移動。case.toResolved 一方通行 (rules/01)
- [ ] commit

### Task 2.10: mutate.flag / mutate.gameResult / mutate.log + state-mutate-meta

- [ ] テスト: setHandUseUsed / setAssistedThisTurn / incrDeclaredUseCount / resetTurnFlags
- [ ] commit

### Task 2.11: invariants

- [ ] テスト: sceneAtMost5 違反で例外 / caseMonotonic 違反で例外 / scratchTraceMonotonic
- [ ] 実装: mutation 直後に自動 assert (test 環境のみ。prod は throw on critical)
- [ ] commit

### Task 2.12: 統合テスト (read+mutate ラウンドトリップ)

- [ ] テスト: 空 state → enter → setState → removeToRemove → 空に戻る (各段階で invariant pass)
- [ ] commit

## 完了基準

- 全 read API 純粋関数 (副作用なし)
- 全 mutate API Immer 経由
- 全 invariant 検出
- カバレッジ ≥ 90%
- 自動プレイテスト用の最小ラウンドが回せる

→ Phase 3 へ
