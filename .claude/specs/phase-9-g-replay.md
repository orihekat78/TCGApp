# Phase 9-G: リプレイ機構

## 目的

過去対局を完全決定論的に再現できる仕組みを導入。デバッグ・smoke 再現・将来のリプレイ UI の基盤。

## 分割

ユーザー承認に従い 2 commit に分割:

- **Phase 9-G.1 (本 spec の対象、中 4-6h)**: engine 側 recorder + player + unit。UI なし。
- **Phase 9-G.2 (deferred, 大 8-10h)**: UI 層 (ReplayPanel / useReplayDriver / GameSetupModal mode)。
  9-G.1 で move-history record × replay の安定性を確認してから着手。

## 配置決定

`src/ai/replay/` (engine ではなく AI 層):
- `recordMatch()` は `runMatch()` を wrap するため `@/ai/match` 依存
- engine → ai 依存は cycle になるため engine/replay/ には置かない
- match.ts と同じ「AI driver layer」として一貫
- spec 内の path 例は元々 `src/engine/replay/` だったが、circular 回避優先で変更

## 設計

### ReplayLog 型

```ts
export type ReplayMove = {
  turn: number;
  player: 'self' | 'opp';
  move: Move; // from @/ai/move-enumerator
};

export type ReplayLog = {
  schemaVersion: 1;
  initialState: GameState; // setup 済 + autoPhase 済の state (runMatch 引数と同じ)
  moves: ReplayMove[]; // chronological order
  result: {
    winner: 'self' | 'opp' | 'draw' | 'invariant-fail';
    reason: 'evidence' | 'deck-out' | 'turn-cap' | 'invariant';
    turns: number;
  };
};
```

### recordMatch()

`runMatch(opts)` を wrap して `onTurn` hook で move を記録:

```ts
export function recordMatch(opts: MatchOpts): { result: MatchResult; log: ReplayLog } {
  const recordedMoves: ReplayMove[] = [];
  const wrappedOpts = {
    ...opts,
    onTurn: (turnNo, player, turnMoves) => {
      for (const m of turnMoves) recordedMoves.push({ turn: turnNo, player, move: m });
      opts.onTurn?.(turnNo, player, turnMoves);
    },
  };
  const result = runMatch(wrappedOpts);
  return { result, log: { schemaVersion: 1, initialState: opts.initialState, moves: recordedMoves, result: {...} } };
}
```

### ScriptedPolicy + replayLog()

`runMatch` を再利用するため `ScriptedPolicy implements AIPolicy` を新規定義。
choose は記録された move を順次返す:

```ts
class ScriptedPolicy implements AIPolicy {
  readonly name: string;
  private queue: Move[];
  constructor(name: string, moves: Move[]) {
    this.name = name;
    this.queue = [...moves];
  }
  choose(_state, candidates, _byPlayer): Move | null {
    if (this.queue.length === 0) {
      // queue 切れは想定外だが安全策として endTurn を返す
      return candidates.find((c) => c.kind === 'endTurn') ?? candidates[0] ?? null;
    }
    return this.queue.shift() ?? null;
  }
}

export function replayLog(log: ReplayLog): MatchResult {
  const selfMoves = log.moves.filter((m) => m.player === 'self').map((m) => m.move);
  const oppMoves = log.moves.filter((m) => m.player === 'opp').map((m) => m.move);
  return runMatch({
    selfPolicy: new ScriptedPolicy('scripted-self', selfMoves),
    oppPolicy: new ScriptedPolicy('scripted-opp', oppMoves),
    initialState: log.initialState,
    maxTurns: log.result.turns + 5,
  });
}
```

## ルール網羅性チェック

該当無し: replay 自体は rules/ に影響しない。
ただし engine 側の確率処理 (mutate.deck.shuffle 等) が `Math.random` を呼ぶため、
**replay 時も同じ seed で `Math.random` を上書きする必要がある**。
これは smoke run-1000.ts 既存パターンと同じ (caller responsibility)。

## エッジケース列挙

1. **空 moves[]**: 即 endTurn が想定外、queue 切れで `endTurn` fallback → 通常終了
2. **invariant-fail で途中終了の log**: replay も同じ場所で fail (state mismatch 時は別 error)
3. **maxTurns 超過**: log の turn 数より大きいなら record/replay 双方 turn-cap 同じ
4. **schemaVersion 不整合**: 将来追加で migrate 関数を導入予定 (本 phase は v1 only)
5. **空 initialState** (setup なし): record/replay 双方で失敗、API 契約として "setup-complete state 渡せ"

## 水平展開

- `src/ai/replay/index.ts` で export 統一
- 既存 `runMatch` は無変更 (recordMatch は wrap のみ)
- スクリプト層では将来 `npm run replay -- --log=path.json` を Phase 9-G.2 で追加

## 状態完備性

- `initialState`: GameState 全フィールド copy
- `moves`: Move 構造体 (既存 move-enumerator 型)
- `result`: MatchResult のサブセット (winner/reason/turns)

`ReplayLog` は JSON serializable (Effect Descriptor D4 の方針と整合)。

## 検証

### Unit (本 phase の主検証)

`tests/ai/replay/recorder.test.ts` (or `tests/engine/replay/recorder.test.ts`):

- `recordMatch` で取得した log の moves[] が空でない
- record 後の result と log.result が一致
- record → replay で `MatchResult.winner / reason / turns` が完全一致
- `ScriptedPolicy` 単体: queue から順次返す / queue 切れで endTurn fallback
- 異なる initialState で replay すると不整合 → invariant-fail 発生 (negative case)

### 回帰

- 既存 unit / E2E / smoke すべて緑維持 (replay は完全 additive)
- typecheck / docs:check clean

## Out of Scope (Phase 9-G.2 候補)

- UI 層 (ReplayPanel / useReplayDriver / GameSetupModal mode)
- JSON ファイル保存・URL hash 化
- speed control / scrubbing
- 部分 replay (turn 5 から再生 等)
- multi-snapshot 互換性 (schemaVersion 2+)

## 関連

- Plan: `C:\Users\arumi\.claude\plans\jiggly-watching-lake.md` (Phase 9-G 節)
- Phase 9-F MVP: `3836d65` (前 commit)
- 依存: `@/ai/match.runMatch`, `@/ai/move-enumerator.Move`
