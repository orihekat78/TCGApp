# エッジケース別 API 挙動

CLAUDE.md「設計レビュー必須チェックリスト §2」準拠。
すべてのエッジが Engine API のどこで吸収されるかを明示。

## 1. 0枚 (デッキ/手札/現場/証拠/FILE)

| ケース | API挙動 | rules |
|--------|---------|-------|
| デッキ0枚で `deck.draw` | 自動 `deck.refresh`。リムーブも0なら `lose:by-deck-out` emit | [14](../rules/14-refresh.md), [26](../rules/26-qa-deck-refresh.md) |
| `deck.peek/reveal` 中の0枚 | 「見ている間はデッキ扱い」。最終操作完了時にリフレッシュ判定 | [26](../rules/26-qa-deck-refresh.md) |
| `deck.removeFromTop(n)` で n>残 | 可能な限りリムーブ→リフレッシュ→**残りはリムーブしない** | [26](../rules/26-qa-deck-refresh.md) |
| 手札0枚で「手札からリムーブ」コスト | `cost.canPay` → false。能力使用不可 | [21](../rules/21-declared-ability-cost.md) |
| 現場0枚でアクション宣言 | `flow.canAction` → false (発動キャラ不在) | [07](../rules/07-action-flow.md) |
| 相手証拠0枚でアクション[事件] | `flow.canActionAgainstCase` → false | [07](../rules/07-action-flow.md) |
| FILE0枚でネクストヒント | `cost.nextHint.canStart` → false | [12](../rules/12-next-hint.md) |
| FILE7未満でアシスト→解決編移行 | 移行しない (条件成立時のみ自動 `case.toResolved`) | [01](../rules/01-victory-conditions.md), [13](../rules/13-keywords.md) |

## 2. 不可逆操作

| 操作 | API での担保 |
|------|-------------|
| 解決編→事件編 | `mutate.case.toResolved` のみ。逆方向 API なし | [01](../rules/01-victory-conditions.md) |
| アシスト後その同ターンの事件解決 | `flow.canSolveCase` が `assistedThisTurn` で false | [01](../rules/01-victory-conditions.md) |
| 解決編条件達成時の移行スキップ | 不可。条件成立時に自動 `case.toResolved` (rules/25) | [25](../rules/25-qa-effects-resolution.md) |
| FILE 7枚以上での解決編移行忘れ | misplay 補正は `mutate.case.toResolved` を遅延発火 | [30](../rules/30-floor-rule-misplay.md) |
| パートナーエリア MR の重複登場 | `mutate.scene.enter` が事前に `mr:overwrite` emit | [18](../rules/18-mr.md) |

## 3. 状態相互作用

| ケース | API挙動 | rules |
|--------|---------|-------|
| スタン状態へ「アクティブにする」効果 | `mutate.scene.tryActivate` → スリープに変更 | [03](../rules/03-field-areas.md) |
| スタン状態へ「スリープ/スタンさせる」 | 状態変化なし (スタン維持) | [24](../rules/24-qa-naming-stun.md) |
| 名乗り状態で突撃のみ | `flow.canAction` true / `flow.canReason` false | [13](../rules/13-keywords.md), [24](../rules/24-qa-naming-stun.md) |
| 名乗り状態で迅速 | 推理可、アクション可 | [13](../rules/13-keywords.md) |
| 名乗り状態で疾風N | `enter` Hook 発火時に `enterOrder` で判定 | [17](../rules/17-icons.md) |
| 名乗り状態でガード/宣言能力/カットイン/変装 | `flow.guard.canGuard` 等 true (rules/24) | [24](../rules/24-qa-naming-stun.md) |
| 突撃で開始したアクション中に突撃失効 | `flow.action.snapshotAP` で能力スナップ済→継続 | [22](../rules/22-qa-action-contact.md), [24](../rules/24-qa-naming-stun.md) |

## 4. 数値マイナス

| ケース | API挙動 | rules |
|--------|---------|-------|
| AP/LP/レベル < 0 | 計算は許容。リムーブ判定なし | [19](../rules/19-special-rules.md) |
| LP ≤ 0 で推理 | `flow.doReasoning` で `evidenceGain(max(LP,0))` = 0枚 | [11](../rules/11-reasoning.md) |
| 「APを0にする」 | `mutate.char.setOverrideAP(uid, 0)`。リムーブされない | [19](../rules/19-special-rules.md) |
| `apOverride` 後の AP+ 修正 | override + delta で計算 (rules/19) | [19](../rules/19-special-rules.md) |
| 「元の能力を無効にする」+MR能力 | `disableOriginalAbilities` は MR能力に影響しない | [19](../rules/19-special-rules.md), [18](../rules/18-mr.md) |

## 5. 複合・連鎖

| ケース | API挙動 | rules |
|--------|---------|-------|
| 変装中の効果引継ぎ | `mutate.char.disguiseInto` が引継ぎ table に従い turnEffects/状態を保持 | [09](../rules/09-cutin-disguise.md), [23](../rules/23-qa-disguise-cutin.md) |
| 変装でデッキ下に移った元キャラ | `leave:to-deck` emit。`leave:to-remove` は emit しない | [23](../rules/23-qa-disguise-cutin.md) |
| 変装したキャラがターン終了前に現場を離れた | 引継ぎ「ターン終了時リムーブ」効果は失われる (現場離脱で消滅) | [23](../rules/23-qa-disguise-cutin.md) |
| コンタクト中に対象/攻撃キャラが現場を離れた | `flow.action.abortIfMissing` で contact-end まで進める | [22](../rules/22-qa-action-contact.md) |
| 同時リムーブによる条件不成立 | `engine.cond.eval` を解決時に再評価 | [25](../rules/25-qa-effects-resolution.md) |
| ヒラメキ中にデッキ0→リフレッシュ | ヒラメキ持ちカードはまだリムーブエリアにない (シャッフル対象外) | [10](../rules/10-action-event.md), [26](../rules/26-qa-deck-refresh.md) |
| カットインの直接リムーブ vs 「コンタクトによってリムーブされない」 | カットイン直接リムーブは貫通 (`cause: 'effect'`) | [23](../rules/23-qa-disguise-cutin.md) |
| 現場6枚以上 (misplay) | `mutate.scene.enter` で例外。`scene.removeToRemove(cause:'misplay-overflow')` 発動能力は不発動 | [30](../rules/30-floor-rule-misplay.md) |

## 6. 同時発動

| ケース | API挙動 | rules |
|--------|---------|-------|
| 同所有者の同タイミング複数発火 | `engine.resolve.requestOwnerOrder` で順序選択 | [25](../rules/25-qa-effects-resolution.md) |
| 両プレイヤー同タイミング | ターンプレイヤー → 非ターンプレイヤー の順 | [15](../rules/15-abilities-effects.md), [25](../rules/25-qa-effects-resolution.md) |
| 効果対象0でも発動扱い | 【ターン①】等カウントは進む | [24](../rules/24-qa-naming-stun.md) |
| コストでの行為 | `event.emit` に `viaCost: true` フラグ→「能力/効果による〜」条件不成立 | [21](../rules/21-declared-ability-cost.md), [25](../rules/25-qa-effects-resolution.md) |

## 関連
- [engine-api-resolver.md](engine-api-resolver.md)
- [engine-api-conditions.md](engine-api-conditions.md)
- [ui-edge-cases.md](2026-05-11-ui-edge-cases.md)
