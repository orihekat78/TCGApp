# engine.mutate.* — メタ系 mutation (フラグ/ログ/結果/MR)

state-mutate のうち、ターン跨ぎフラグ・ログ・ゲーム結果・MR遷移を分離。
基本動詞は [engine-api-state-mutate.md](engine-api-state-mutate.md) 参照。

## ターン跨ぎフラグ (TurnScopedFlags) — rules: [05](../rules/05-turn-phases.md), [01](../rules/01-victory-conditions.md), [17](../rules/17-icons.md)

```typescript
engine.mutate.flag.setHandUseUsed(s, p, v): void
  // 1ターン1回判定。ネクストヒント実施ターンは true 以前から使用不可
engine.mutate.flag.setNextHintUsed(s, p, v): void
  // ネクストヒント実施ターンは「手札の使用」不可 (rules/05)
engine.mutate.flag.setAssistedThisTurn(s, p, v): void
  // 事件解決可否判定 (rules/01)。アシスト実施で true
engine.mutate.flag.incrDeclaredUseCount(s, uid, abilId): void
  // 【ターン①/②】管理 (rules/17)。effect 解決失敗でも increment (rules/24)
engine.mutate.flag.resetTurnFlags(s, p): void
  // ターン終了時自動。declaredUseCount を空に
```

## ゲーム結果

```typescript
engine.mutate.gameResult.set(s, winner, reason): void
  // reason: 'evidence' | 'deck-out' | 'concede'
engine.mutate.gameResult.clear(s): void                // テスト用
```

## ログ

```typescript
engine.mutate.log.append(s, entry: LogEntry): void     // 通常は各 mutate が自動付与
engine.mutate.log.clear(s): void                       // テスト用 / 新ゲーム時

engine.read.log.tail(s, n): LogEntry[]
engine.read.log.byTurn(s, turnNo): LogEntry[]
engine.read.log.byPlayer(s, p): LogEntry[]
engine.read.log.search(s, predicate): LogEntry[]
```

## MR パートナー / パートナーエリア遷移 — rules: [18](../rules/18-mr.md)

```typescript
engine.mutate.partner.setLocation(s, uid, loc): void
  // loc: 'partner-area' | 'file-area' | 'mr-removed'
engine.mutate.partner.toRemovedByMR(s, uid): void
  // MR能力② による既存MRの除去 (rules/18)
  // mr:overwrite Hook を発火
engine.mutate.partner.toPartnerAreaFromScene(s, uid): void
  // MR能力① 相手ターン中の現場離場 → PA (rules/18)
  // 「離れた先のエリアへ一度置かれてから即座に行われる扱い」のため
  // leave:to-remove Hook も先に発火 (リムーブ発動能力が反応する)
```

## 関連
- [engine-api-state-mutate.md](engine-api-state-mutate.md)
- [engine-api-events.md](engine-api-events.md)
