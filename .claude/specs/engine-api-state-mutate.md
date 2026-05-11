# engine.mutate.* — 全state変更プリミティブ

Immer 経由で state を変更する低レベル動詞。
**カードからの直接呼び出し禁止**。Resolver/Hook/共通クラス経由のみ。
全 mutation は LogEntry を自動追加。

## デッキ操作 — rules: [14](../rules/14-refresh.md), [26](../rules/26-qa-deck-refresh.md)

```typescript
engine.mutate.deck.draw(s, p, n): CardId[]              // 引く (リフレッシュ自動判定)
engine.mutate.deck.peek(s, p, n): CardId[]              // 上を覗く (リフレッシュ判定なし)
engine.mutate.deck.reveal(s, p, n): CardId[]            // 公開 (まだデッキ扱い)
engine.mutate.deck.toBottom(s, p, ids, order): void     // デッキの下へ (順序指定可)
engine.mutate.deck.toTop(s, p, ids, order): void        // デッキの上へ
engine.mutate.deck.removeFromTop(s, p, n): CardId[]     // 上からリムーブ (不足時可能分のみ rules/26)
engine.mutate.deck.shuffle(s, p): void
engine.mutate.deck.refresh(s, p): RefreshResult         // リムーブ→デッキ shuffle
                                                         //  + 相手は証拠を1得る (rules/14)
                                                         //  + 相手の痕跡を [発見済] に (rules/13, 26)
                                                         //  + 0枚敗北判定 (RefreshResult.ok=false)
```

## 手札

```typescript
engine.mutate.hand.add(s, p, ids): void
engine.mutate.hand.remove(s, p, ids): void
engine.mutate.hand.discardToRemove(s, p, ids): void
engine.mutate.hand.toDeckBottom(s, p, ids): void        // マリガン用 (rules/04)
```

## 現場 (Scene)

```typescript
engine.mutate.scene.enter(s, p, cardId, opts): SceneCharacter
  // opts: { active?: boolean, named?: boolean, viaEffect?: boolean }
  // viaEffect=true なら色制限スキップ (rules/20)
  // 現場5枚超過なら例外 (スイッチは別API)
engine.mutate.scene.switchEnter(s, p, cardId, removeUid, opts): SceneCharacter
  // 既存キャラをリムーブして登場 (rules/20 スイッチ)
engine.mutate.scene.removeToRemove(s, uid, cause): RemoveResult
  // cause: 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow'
  // MR は cause='effect'  扱い (rules/18)
engine.mutate.scene.toDeckBottom(s, uid): void          // 変装で元キャラ移動 (rules/09)
engine.mutate.scene.setState(s, uid, st): void          // active|sleep|stun
engine.mutate.scene.tryActivate(s, uid): void           // スタンならスリープ化 (rules/03)
engine.mutate.scene.clearNamed(s, uid): void            // 通常はターン跨ぎで自動
```

## キャラ修正

```typescript
engine.mutate.char.modifyAP(s, uid, delta, scope): void  // scope: 'turn'|'contact'|'permanent'
engine.mutate.char.modifyLP(s, uid, delta, scope): void
engine.mutate.char.setOverrideAP(s, uid, val|null): void // 「元のAPを0にする」
engine.mutate.char.setOverrideLP(s, uid, val|null): void
engine.mutate.char.grantKeyword(s, uid, kw, scope): void
engine.mutate.char.revokeKeyword(s, uid, kw): void
engine.mutate.char.disableOriginalAbilities(s, uid): void   // rules/19, MR能力は不可
engine.mutate.char.setTurnEffect(s, uid, key, val): void    // contactImmune 等
engine.mutate.char.clearTurnEffects(s, uid, scope): void
engine.mutate.char.setCard(s, uid, cardId, faceUp): void    // セット (rules/16)
                                                             //  faceUp=false の裏向きセットはキャラ/イベント扱いされない
                                                             //  リムーブ時は表向きにしてから removeリスト追加
engine.mutate.char.stackCard(s, uid, count): void           // 下に重ね
engine.mutate.char.removeAllSetAndStacked(s, uid): void     // 離場時
engine.mutate.char.disguiseInto(s, uid, newCardId): void    // 変装 (引継ぎは別仕様)
```

## 証拠 / FILE / リムーブ / パートナー

```typescript
engine.mutate.evidence.addFromDeck(s, p, n, faceUp, origin): void
engine.mutate.evidence.removeTop(s, p): EvidenceCard       // アクション[事件] (rules/10)
engine.mutate.evidence.removeAt(s, p, idx): EvidenceCard
engine.mutate.evidence.flipFaceUp(s, p, idx): void
engine.mutate.evidence.toRemove(s, ev): void               // ヒラメキ後など
engine.mutate.file.addFromDeckTop(s, p, n): void           // 通常2枚, 先攻初手1枚
engine.mutate.file.popTop(s, p): FileCard                   // ネクストヒント
engine.mutate.file.insertAssistedPartner(s, p): void
engine.mutate.remove.add(s, p, ids): void
engine.mutate.remove.removeFromHere(s, p, ids): void       // リフレッシュ前準備等
engine.mutate.partner.setState(s, p, st): void
engine.mutate.partner.assist(s, p): void                   // sleep + FILEへ (rules/13)
engine.mutate.partner.returnFromFile(s, p): void           // オートフェイズ (rules/05)
engine.mutate.partner.solveCase(s, p): void                // 事件解決 → ゲーム勝利
engine.mutate.case.toResolved(s, p): void                  // 事件編→解決編 (rules/01, 一方通行)
engine.mutate.scratchTrace.set(s, p, '発見済'|'未発見'): void
```

## メタ系 mutation (フラグ/ログ/結果/MR遷移)

→ [engine-api-state-mutate-meta.md](engine-api-state-mutate-meta.md) に分離。

## 関連
- [engine-api-state-mutate-meta.md](engine-api-state-mutate-meta.md)
- [engine-api-resolver.md](engine-api-resolver.md)
- [engine-api-edge-cases.md](engine-api-edge-cases.md)
