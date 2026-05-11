# 10. AI アクション可視化（人間ライク再生）

## 結論

エンジンを **「最終状態を返す」のではなく「イベントストリームを返す」** 設計に統一する。
UI はストリームを **アニメーションキュー** で再生し、AI も人間プレイ同様に動いて見える。

## 要件（ユーザー指示準拠）

- 人間 vs CPU でも CPU vs CPU でも、CPU の動きを **人間ライクに可視化**
- 「裏で一気に状態が変わる」のではなく、ドラッグ・配置・効果発動を順に見せる
- ユーザーが理解できる速度で進行
- Hearthstone / Master Duel / Shadowverse 同等の体験

## アーキテクチャ：イベントストリーム

```typescript
type GameEvent =
  | { type: 'CARD_DRAW'; player: PlayerID; cardId: CardId }
  | { type: 'CARD_PLAY'; player: PlayerID; from: 'hand'; to: 'scene'; cardId: CardId }
  | { type: 'ABILITY_TRIGGER'; source: CardId; abilityId: string }
  | { type: 'AP_CHANGE'; target: CardId; delta: number }
  | { type: 'CARD_REMOVE'; cardId: CardId; from: Area; to: Area }
  | { type: 'STATE_TRANSITION'; target: CardId; from: State; to: State }
  | { type: 'AI_THINKING'; durationMs: number }
  | { type: 'AI_DECISION'; chosenAction: any; reasoning?: string };
```

`engine.applyAction(state, action) → { newState, events: GameEvent[] }`

## アニメーションキュー（UI側）

```typescript
class PlaybackQueue {
  enqueue(events: GameEvent[]): void;
  setSpeed(speed: 'slow' | 'normal' | 'fast' | 'instant'): void;
  pause(): void;
  step(): void;
}
```

各イベント種別ごとにアニメーション仕様を定義（標準 0.3〜2秒/アクション）：

- CARD_DRAW: 300ms — デッキ→手札
- CARD_PLAY: 600ms — 手札→現場へドラッグ風
- ABILITY_TRIGGER: 800ms — カード発光 + 効果テキスト
- AP_CHANGE: 400ms — 数値の差分アニメ
- CARD_REMOVE: 500ms — 移動先へフェード
- AI_THINKING: 800〜2000ms — 「相手が考えています」+ ローディング

## CPU の人間ライク振る舞い

### 1. 思考時間の演出

`AI_DECISION` 前に `AI_THINKING` イベントを挿入：

```typescript
// NG: 即座に状態適用
const action = ai.decide(state);
applyAction(state, action);

// 推奨: 思考表示 + ステップ展開
events.push({ type: 'AI_THINKING', durationMs: randomBetween(800, 2000) });
const action = ai.decide(state);
events.push({ type: 'AI_DECISION', chosenAction: action });
events.push(...applyAction(state, action));
```

思考時間は **アクションの複雑さ** に比例（合法手数 × 重み）。

### 2. アクションの段階表示

複合アクション（推理→効果→対象選択）を1イベントにまとめず分解：
カードホバー → 選択 → ドラッグ動作 → 配置完了 → 効果発動アニメ。

### 3. CPU の対象選択の見せ方

CPU が対象を選ぶ瞬間（推理する自キャラを選ぶ等）に **カーソル位置のアニメーション** で示す。

## 観戦モード（CPU vs CPU）

- 両者の思考時間を表示
- スピード調整（×1 / ×2 / ×4 / 一時停止）
- ステップ実行可
- AI のスコア / 候補手 / 決定理由をオプション表示

## 設定

ユーザー調整可能項目：

- アニメーション速度 (slow / normal / fast / instant)
- AI 思考時間表示 (秒数 / 待機なし)
- 効果テキストポップアップ (常時 / 重要時 / なし)

## 関連

- [05-cpu-ai-patterns.md](05-cpu-ai-patterns.md)
- [08-interrupt-priority-windows.md](08-interrupt-priority-windows.md)
- [../ux/](../ux/) - 詳細UX設計（後続フェーズ）
