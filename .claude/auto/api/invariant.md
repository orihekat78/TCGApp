# 🤖 engine.invariant

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `8124dff43e86`

不変条件チェック（case/partner/stun semantics 等）

## アグリゲータ (`engine.invariant`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `assertFrozen`
- `caseExists`
- `caseMonotonic`
- `effectIsSerializable`
- `frozenSurface`
- `partnerExists`
- `sceneAtMost5`
- `scratchTraceMonotonic`
- `stunSemantics`

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `assertFrozen` | `(): void` | 骨格凍結の確認 (起動時に呼出) 現在は no-op スタブ — Phase 9 で完全実装 / |
| `caseExists` | `(s: GameState, p: Player): void` | 事件カードが存在する (cardId が空でない) ことを確認する / |
| `caseMonotonic` | `(s: GameState, p: Player, prevStatus: CaseStatus): void` | 事件状態の一方通行を確認する 解決編→事件編への遷移は throw / |
| `effectIsSerializable` | `(eff: Effect): void` | エフェクトが JSON シリアライズ可能かどうかを確認する custom kind 以外は throw。custom なら warning のみ / |
| `partnerExists` | `(s: GameState, p: Player): void` | パートナーが存在する (cardId が空でない) ことを確認する / |
| `sceneAtMost5` | `(s: GameState, p: Player): void` | 現場のキャラ数が5枚以下であることを確認する 5枚超で throw Error ⚠ engine E3 P11 (2026-07-02): これは **絶対エンジン天井** (5 固定)。 case override による現場上限 (read.sceneCap、PR067 で 4 等) は **登場ゲート** にのみ効き、 本 invariant は下げない。… |
| `scratchTraceMonotonic` | `(s: GameState, p: Player, prevV: TraceValue): void` | 痕跡状態の一方通行を確認する 発見済→未発見への遷移は throw / |
| `stunSemantics` | `(s: GameState, uid: string, attempted: CharState, beforeState: CharState): void` | スタン状態でアクティブ化を試みた場合の挙動を確認する - beforeState が 'stun' かつ attempted が 'active' の場合、 結果は 'sleep' でなければならない (スタン特殊挙動) / |

## その他のエクスポート

- `frozenSurface` _(const)_

---

## ソース

- [`src/engine/invariant/index.ts`](../../../src/engine/invariant/index.ts)

