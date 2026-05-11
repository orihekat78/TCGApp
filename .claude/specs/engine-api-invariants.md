# engine.invariant.* — 不変条件・凍結ポリシー

骨格凍結原則 ([CLAUDE.md](../CLAUDE.md#修正範囲を最小化する運用骨格凍結原則)) を担保するための invariant 群。
mutation 後に自動 assert される (失敗時は例外)。

## 数値・上限系 invariants

```typescript
engine.invariant.sceneAtMost5(state, p): void          // rules/03 + rules/30 例外検出
engine.invariant.partnerExists(state, p): void         // パートナーは常に1
engine.invariant.caseExists(state, p): void
engine.invariant.deckPlusRemoveAlwaysReplenishable(state, p): void  // 敗北判定タイミング以外
engine.invariant.requiredEvidenceMatchesOrder(state, p): void
  // 先攻=7, 後攻=6 (ゲーム開始時に決定。途中変更不可)
engine.invariant.handCountConsistent(state, p): void
engine.invariant.fileCountIncludesAssistedPartner(state, p): void
                                                        // rules/17 FILE(X)
```

## 状態遷移 invariants

```typescript
engine.invariant.caseMonotonic(state, p): void
  // 事件編→解決編 のみ。逆遷移は例外
engine.invariant.scratchTraceMonotonic(state, p): void
  // 未発見→発見済 のみ
engine.invariant.solvedCaseLeadsToWinCheck(state, p): void
engine.invariant.stunSemantics(state, uid, attempted, before): void
  // active 効果でスタン → スリープ化に正規化されたか
```

## カード/効果 invariants

```typescript
engine.invariant.effectIsSerializable(eff): void
  // custom 以外は JSON.stringify 可能
engine.invariant.cardDefValid(def): void
  // ability id 重複なし、ruleRefs 実在、kind と必須プロパティ整合
engine.invariant.noDirectEngineAccess(callstack): void
  // 開発時のみ。骨格内部フィールドへの外部書き込みを検出
```

## 凍結ポリシー (Frozen API)

```typescript
engine.invariant.frozenSurface: ReadonlyArray<string>
  // 凍結対象シンボルの完全リスト (engine.read/mutate/effect/event/cost/target/cond/flow/resolve)
engine.invariant.assertFrozen(): void
  // 起動時、列挙されているシンボルが追加/削除されていないか確認
```

### 凍結対象 (v1)

すべての `engine.<namespace>.*` 公開API は **凍結対象**。
変更可能なケース:

1. 公式ルール (rules/) の更新
2. 骨格自体のバグ修正
3. 動作不変な内部最適化

それ以外は **新カードのために骨格を変えない** (CLAUDE.md)。

## 共通クラス vs 骨格 の境界

| 例 | 配置 |
|----|------|
| 「自分の現場のキャラを1枚スリープ」 | 骨格 `mutate.scene.setState` |
| 「自分のキャラをスリープしてカードを1枚引く」 (3枚以上カードで使用) | `cards/_shared/sleepAndDraw.ts` |
| 「コンタクト中、AP+1000」 | 骨格 `mutate.char.modifyAP(scope:'contact')` |
| 「カットインAP+2000」 (汎用) | `cards/_shared/cutinAPBoost.ts` |

骨格はあくまで **動詞** だけを提供。**意味** は共通クラスかカード本体に持たせる。

## 共通クラス変更ポリシー

- 共通クラスは **破壊的変更禁止** (CLAUDE.md)
- 仕様変更は新クラス追加で対応
- 既存クラスの引数追加は **オプショナルのみ** 許容
- バリデータ:
  ```typescript
  engine.invariant.sharedClassNonBreaking(prevSig, newSig): void
  ```

## 月次レポート (収束指標)

```typescript
engine.invariant.report.monthly(): {
  engineLOC: number;            // 骨格行数
  enginePRs: number;            // 骨格修正PR
  sharedClassChanges: number;
  newCardsAdded: number;
  avgTouchedFilesPerCard: number;
}
```

目標値は [CLAUDE.md 数値ターゲット](../CLAUDE.md#数値ターゲット収束の見える化) に従う。

## 自動プレイテスト

```typescript
engine.invariant.playtest.run(deckA, deckB, n: number): PlaytestReport
  // n 戦のランダムプレイ。エラー/不変条件違反を検出
  // 新カード追加時に 1000戦が推奨 (CLAUDE.md)
```

## 関連
- [CLAUDE.md](../CLAUDE.md) — 骨格凍結原則
- [engine-api.md](engine-api.md)
- [engine-api-card-shape.md](engine-api-card-shape.md)
