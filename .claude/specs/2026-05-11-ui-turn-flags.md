# ターンスコープフラグ・スタン特殊挙動 (2026-05-11)

## ターンスコープフラグ — rules: [05](../rules/05-turn-phases.md), [12](../rules/12-next-hint.md), [17](../rules/17-icons.md)

### turnState[player]

| フラグ | リセット | 用途 |
|-------|---------|------|
| `handUseUsed: boolean` | ターン開始時 | 「手札の使用」1回制限 |
| `nextHintUsed: boolean` | ターン開始時 | ネクストヒント実施後の手札使用ロック |
| `assistedThisTurn: boolean` | ターン開始時 | アシスト後の事件解決ロック |
| `declaredAbilityUseCount[abilityId]` | ターン開始時 | 【ターン①】【ターン②】カウンタ |

### SceneCharacter スコープフラグ

| フラグ | リセット | 用途 |
|-------|---------|------|
| `enterOrder` | ターン開始時 | 疾風N判定 |
| `isNamed` | ターン終了時 | 名乗り状態解除 |
| `turnEffects.contactImmune` | コンタクト終了時 | コンタクトリムーブ免疫 |
| `turnEffects.removeOnTurnEnd` | エンドフェイズで発動 | ターン終了時にこのキャラリムーブ |
| `declaredUseCount[abilityId]` | ターン開始時 | キャラ固有【ターン①】等 |

### リセットタイミング詳細

```text
ターン開始時 (オートフェイズ前):
  - turnState[currentPlayer] を初期化
  - scene[*].enterOrder をリセット
  - scene[*].declaredUseCount をリセット

ターン終了時 (エンドフェイズ):
  - turnEffects.removeOnTurnEnd を発動して該当キャラリムーブ
  - turnEffects.contactImmune など「ターン終了時まで」効果切れ
  - scene[*].isNamed を解除
```

## スタン状態の特殊挙動 — rules: [03](../rules/03-field-areas.md), [24](../rules/24-qa-naming-stun.md)

```text
スタン状態のキャラに「アクティブにする」効果適用 → 代わりに「スリープ状態」になる
スタン状態は明示的なスタン解除効果でのみ解除
スリープさせる効果・スタンさせる効果を受けても、状態は「スタンのまま」
```

実装上は `state` enum で `'active'|'sleep'|'stun'` を持ち、効果適用時に分岐:

```typescript
function applyMakeActive(char) {
  if (char.state === 'stun') char.state = 'sleep';  // スタン特殊挙動
  else char.state = 'active';
}
function applyMakeSleep(char) {
  if (char.state === 'stun') return;  // スタンのまま
  char.state = 'sleep';
}
function applyMakeStun(char) {
  char.state = 'stun';
}
function applyRemoveStun(char) {
  // 明示的なスタン解除効果でのみ呼ぶ
  char.state = 'active';
}
```

## 関連

- [ui-effect-stack.md](2026-05-11-ui-effect-stack.md)
- [ui-mr-and-special.md](2026-05-11-ui-mr-and-special.md)
- [ui-edge-cases.md](2026-05-11-ui-edge-cases.md)
