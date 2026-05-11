# engine.read.* — 全state読み取りAPI

副作用なしの純粋関数。`GameState` ([ui-state-map.md](2026-05-11-ui-state-map.md)) を引数に取る。
カード/共通クラスは **直接フィールドアクセス禁止**。必ず以下経由。

## ターン・フェイズ

```typescript
engine.read.turn.current(s): TurnSnapshot
engine.read.turn.player(s): 'self'|'opp'           // ターンプレイヤー
engine.read.turn.opponent(s): 'self'|'opp'         // 非ターンプレイヤー
engine.read.turn.phase(s): 'auto'|'main'|'end'
engine.read.turn.number(s): number
engine.read.turn.isFirstPlayerFirstTurn(s): boolean // rules/05 オートフェイズ例外
engine.read.turn.flags(s, p): TurnScopedFlags       // handUseUsed 等
```

## プレイヤー

```typescript
engine.read.player.partner(s, p): PartnerOnBoard
engine.read.player.case(s, p): CaseInfo             // 状態/色/必要証拠数
engine.read.player.requiredEvidence(s, p): number   // 先攻=7/後攻=6 (rules/01)
engine.read.player.hand(s, p): CardId[]             // 相手は枚数のみ可視 (rules/03)
engine.read.player.handCount(s, p): number
engine.read.player.deck(s, p): CardId[]             // 内部参照のみ。UIに渡さない
engine.read.player.deckCount(s, p): number
engine.read.player.evidence(s, p): EvidenceCard[]
engine.read.player.evidenceCount(s, p): number
engine.read.player.remove(s, p): CardId[]           // リムーブエリア
engine.read.player.removeCount(s, p): number
engine.read.player.file(s, p): FileCard[]
engine.read.player.fileCount(s, p): number          // アシスト中パートナー含む (rules/17 FILE(X))
engine.read.player.scratchTrace(s, p): '未発見'|'発見済'  // rules/13
```

## 現場 (Scene)

```typescript
engine.read.scene.all(s, p): SceneCharacter[]
engine.read.scene.count(s, p): number               // 上限5判定用 (rules/03)
engine.read.scene.byUid(s, uid): SceneCharacter|null
engine.read.scene.byCardId(s, p, cardId): SceneCharacter[]   // 同名複数あり
engine.read.scene.activeOnes(s, p): SceneCharacter[]         // ガード/アクション元候補
engine.read.scene.sleepOrStun(s, p): SceneCharacter[]        // アクション対象候補 (rules/07)
engine.read.scene.named(s, p): SceneCharacter[]              // 名乗り中
engine.read.scene.nonNamed(s, p): SceneCharacter[]           // 推理可候補
engine.read.scene.enterOrderOf(s, uid): number               // 疾風N判定 (rules/17)
```

## キャラ単位

```typescript
engine.read.char.ap(s, uid): number                 // override + 修正合算 (rules/19)
engine.read.char.lp(s, uid): number                 // override + 修正合算
engine.read.char.level(s, uid): number              // 修正反映後 (rules/19 下限なし)
engine.read.char.colors(s, uid): string[]           // 変装後の色を反映
engine.read.char.names(s, uid): string[]            // 複数名カード対応 (rules/19)
engine.read.char.traits(s, uid): string[]           // 特徴 (例: [警察], [少年探偵団])
engine.read.char.keywords(s, uid): string[]         // granted + 元能力 (無効化考慮)
engine.read.char.hasKeyword(s, uid, kw): boolean
engine.read.char.state(s, uid): 'active'|'sleep'|'stun'
engine.read.char.isNamed(s, uid): boolean
engine.read.char.setCards(s, uid): CardId[]         // セット (情報あり)
engine.read.char.stackedCount(s, uid): number       // 重ね (枚数のみ) (rules/16)
engine.read.char.turnEffect(s, uid, key): unknown   // contactImmune 等
engine.read.char.declaredUseCount(s, uid, abilId): number  // 【ターン①】管理
```

## カード定義

```typescript
engine.read.def.card(cardId): CardDef               // カードDB参照
engine.read.def.byTrait(trait): CardDef[]
engine.read.def.byColor(color): CardDef[]
```

## ゲーム状況

```typescript
engine.read.game.canWin(s, p): boolean              // 解決編+証拠十分+パートナーactive
engine.read.game.evidenceShortfall(s, p): number    // あと何枚必要
engine.read.game.refreshCount(s, p): number         // 痕跡判定材料
engine.read.game.result(s): GameResult|null
```

## 関連
- [engine-api-state-mutate.md](engine-api-state-mutate.md)
- [ui-state-map.md](2026-05-11-ui-state-map.md)
