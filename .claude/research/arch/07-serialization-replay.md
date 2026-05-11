# 07. シリアライズとリプレイ

## 結論

**Hybrid** = Command Log + 周期 Snapshot + 固定 RNG seed

業界標準のカードゲーム手法。boardgame.io はこれを標準で持つため、
リプレイは「後から追加」というよりほぼ無償で得られる。

## 構成要素

### a. Command Log（append-only）

すべての move / 効果解決を記録：

```typescript
interface Command {
  seq: number;
  playerID: PlayerID;
  type: string;       // 'PLAY_CARD' / 'REASONING' / 'ACTION' / etc
  args: any;
}
```

`G.history: Command[]` として保持。

### b. Snapshot（周期 or イベント駆動）

- N ターンごと
- スタックが空になったタイミング
- セッション開始・終了時

```typescript
interface Snapshot {
  atSeq: number;
  G: GameState;       // 構造化複製可能
}
```

### c. 固定 RNG seed

- `setup` 段階で生成、保持
- すべてのランダム性は **`ctx.random` 経由** （boardgame.io 標準）
- shuffle / 捜査の公開 / etc 全てが決定論的に再生可能

## 禁止事項（必須規約）

move 内では **絶対に** 以下を呼ばない：

- ❌ `Date.now()`
- ❌ `Math.random()`
- ❌ `crypto.randomUUID()`（必要なら別経路）

✅ `ctx.random` のみ使用。これは ESLint ルールで強制可能。

## 各方式のトレードオフ

| 方式 | メリット | デメリット |
|------|---------|-----------|
| Event Sourcing 純粋型 | 完全再生・最小ストレージ | long match で再生コストが線形に増大 |
| Snapshot 純粋型 | 再生コスト一定 | リプレイ・観戦・不正検出ができない |
| **Hybrid** | 両者の良いとこ取り | やや実装複雑 |

## 容量見積もり

- ログ: 0.5〜1 MB / match（実用範囲）
- Snapshot: 数 KB / point

ローカル運用なら IndexedDB に保存、過去戦のリプレイ閲覧が可能。

## AI 先読みとの統合

- AI は「現在の Snapshot からスタート → 仮想 ctx.random で枝分かれ」
- 実プレイの seed と AI 探索の seed を **分離する設計が必須**
- AI 探索ではログを記録しない（純粋探索のため）

## チュートリアル機能との関係

チュートリアル（[../tutorial/](../tutorial/) 別途設計）は本質的に **scripted replay**:
- 事前に Command Log を用意
- ステップごとに pause/hint を挿入

→ リプレイ機能と同じ基盤を共用できる。設計の早期統合価値が高い。

## 関連

- [01-frameworks-survey.md](01-frameworks-survey.md) - boardgame.io の `ctx.random`
- [03-state-management.md](03-state-management.md) - Snapshot の clone 方式

## 出典

- [Snapshot Strategies for Event Replay](https://dev.to/alex_aslam/snapshot-strategies-optimizing-event-replays-36oo)
- [Realtime Card Games: Determinism & Rollback](https://developersvoice.com/blog/practical-design/realtime-card-games-net-architecture-guide/)
- [boardgame.io random](https://boardgame.io/documentation/#/random)
