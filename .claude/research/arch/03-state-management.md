# 03. 状態管理

## 結論

**immer ベース不変更新（boardgame.io 既定）+ AI 内部ループは plain object 浅クローン** の二層方式。

## 二層方式の概要

- **Main loop**: プレイヤー操作・UI連動 → immer Proxy（boardgame.io 既定）
- **AI inner loop**: MCTS / heuristic 探索 → `structuredClone(G)` または手動浅クローン

## immer のメリット

- 構造共有 → React 側は `===` で差分検出可能
- mutable に書ける → カード効果実装の認知負荷を下げる
- boardgame.io と統合済みで追加設定不要

## AI 探索でのトレードオフ

immer の Proxy はホットパスでオーバーヘッドあり。
1ターンに数十回効果が連鎖するコナンTCG探索では性能が問題に。
→ AI 内部だけ二層に切替：

```typescript
// 通常の move (immer 経由)
moves.playCard = (G, ctx, cardId) => {
  const idx = G.hand[ctx.currentPlayer].indexOf(cardId);
  G.hand[ctx.currentPlayer].splice(idx, 1);
  G.scene[ctx.currentPlayer].push(cardId);
};

// AI 探索内部（plain mutation + 浅 clone）
function tryAction(G, action) {
  const branch = { ...G, hand: { ...G.hand } };
  applyMutable(branch, action);
  return evaluate(branch);
}
```

## boardgame.io の制約

`G` は plain JSON のみ。

- 使用可: object / array / string / number / boolean / null
- 使用不可: 関数 / Map / Set / Date / class インスタンス

設計指針: カードIDキー集合は Record、順序付きは配列で表現。

```typescript
// ✓ 順序付きカードリスト
hand: CardId[];

// ✓ カードID→インスタンスのマップ
type CardMap = Record<CardId, CardInstance>;
```

## 状態の入れ子と差分検出

```typescript
interface GameState {
  players: Record<PlayerID, PlayerBoard>;
  stack: EffectFrame[];
  replacementPipe: ReplacementSpec[];
  phase: 'auto' | 'main' | 'end';
  turn: number;
  history: Command[];
}

interface PlayerBoard {
  partner: CardId;
  scene: CardId[];           // 現場（最大5枚）
  hand: CardId[];
  deck: CardId[];
  evidence: CardId[];        // 裏向き
  fileArea: CardId[];
  removeArea: CardId[];
  case: CardId;
  caseStatus: '事件編' | '解決編';
}
```

## 関連

- [01-frameworks-survey.md](01-frameworks-survey.md)
- [05-cpu-ai-patterns.md](05-cpu-ai-patterns.md) - AI 探索の clone 戦略
- [07-serialization-replay.md](07-serialization-replay.md) - serialize 制約

## 出典

- [boardgame.io immutability](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/immutability.md)
- [immer 公式ドキュメント](https://immerjs.github.io/immer/)
- [structuredClone MDN](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)
