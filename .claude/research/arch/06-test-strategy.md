# 06. テスト戦略

## 結論

**3層 + 自動回帰** の組み合わせ。

- ユニット: ルールエンジンの純関数 → **Vitest** + **fast-check**（数百 properties）
- シナリオ: 「盤面X→行動Y→期待状態Z」 → Vitest + JSON フィクスチャ（rules/22-26 のQ&A全件）
- AI回帰: CPU vs CPU → カスタムランナー + Vitest（PR 100戦 / nightly 1000戦）

## ユニット層

### Property-based testing（fast-check）

「任意の合法手を適用しても **invariant** を満たす」を検証：

- カード総数保存
- AP の整合性
- 所有権の一貫性
- リムーブエリア + デッキ + 手札 + 場 = 全カード数

```typescript
fc.assert(
  fc.property(arbState, arbAction, (s, a) =>
    isLegal(s, a) ? checkInvariants(apply(s, a)) : true
  )
);
```

コナンTCGには **保存則** が多く、property-based の威力が高い領域。

### カバレッジ目安

- ルールエンジン: 行 90% / 分岐 85%
- AIコード: カバレッジ目標を設けず、戦数で代替

## シナリオ層

`.claude/rules/22-26` の **公式Q&A裁定をJSON化**：

```json
// tests/scenarios/qa-22-action-001.json
{
  "name": "ガードと コンタクト発生 の間に【現場リムーブ時】が解決される",
  "initial": { "...": "盤面" },
  "actions": [{ "type": "ACTION", "from": "...", "target": "..." }],
  "expected": { "...": "期待される盤面" }
}
```

Vitest の `test.each` で一括実行。Q&A が増えれば回帰が強化される。

## AI回帰層

### PR 時の高速回帰（30秒目標）

Random vs Random 100戦（決定的シード固定で再現可能）。

### Nightly の網羅回帰（5〜10分）

- Heuristic vs Random 1000戦
- Heuristic vs Heuristic 500戦

### 検出する異常

1. クラッシュ・違法手（ハードフェイル）
2. ターン数 > 上限（無限ループ）
3. 勝率の統計的逸脱（Wilson信頼区間で前バージョンと比較・α=0.01）
4. 平均ゲーム長 / 平均証拠リードの分布シフト → カードバランスバグの早期警告

### 自己対戦の限界

「ルールが矛盾なく回る」までは強力。特定カード効果と実装の乖離は検出しない（両AIが同じ誤実装を踏むため）→ シナリオ層が補完。逆に、シナリオで捕まらない「相互作用バグ」（同時発動順序、リフレッシュ中の効果解決）は **自己対戦が最も効く**。

## E2E（補助）

**Playwright** で以下に絞る:

- 人間 vs CPU を1戦完走できる
- Worker 応答がタイムアウトしない
- UI が違法手をブロックする

E2E でルールを検証しない（速度・安定性の問題）。

## CI 時間目安

Random 1戦 50〜200ms / Random 100戦 並列4 worker で〜10秒 / Heuristic は Random の5〜10倍 / Heuristic 1000戦 nightly で 5〜10分。

## 関連

- [05-cpu-ai-patterns.md](05-cpu-ai-patterns.md)
- [../../rules/INDEX.md](../../rules/INDEX.md) - シナリオ層の素材

## 出典

- [@fast-check/vitest](https://www.npmjs.com/package/@fast-check/vitest)
- [fast-check 公式](https://fast-check.dev/)
- [Vitest 公式](https://vitest.dev/)
