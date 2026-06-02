# engine-api-atom-verbs

[atom-handlers.ts](../../src/engine/effect/atom-handlers.ts) で `runAtom` が dispatch する全 atom verb の一覧と引数 shape。新規 verb 追加 PR で本 spec を更新すること。

## 追加判定基準

新 verb を追加してよいのは: (1) mutate primitive の薄いラッパーで複数カードから使われる動詞、(2) 既存 verb の組合せでは表現不能な状態遷移、(3) rules/01〜30 の用語を直訳した方が読みやすい場合。それ以外 (1 カード専用 / 既存組合せで表現可) は新規追加せず `cards/_shared/` の共通クラスにまとめる ([CLAUDE.md 骨格凍結原則](../CLAUDE.md))。

## 引数 shape 共通慣行

- `player: 'self' | 'opp'`、`n: number` (0 以下は no-op)
- `uid: string` (`charId#index`)。`'$pick'` は placeholder (Pattern A、[pick-substitution](engine-api-pick-substitution.md))
- `target: string | string[] | pick query` (Pattern B / 未解決)
- 全 verb は `mutate.log.append` で `effect:<verb>` log を出す ([BUG-073](../bugs/BUG-073.md))

## verb 一覧 (39 verbs)

### デッキ / FILE / 手札遷移 (9)

| verb | args | 説明 |
| --- | --- | --- |
| `draw` | `{player, n}` | デッキ上から n 枚を手札へ |
| `mill` | `{player, n}` | デッキ上から n 枚を直接リムーブ |
| `deckRevealUntil` | `{player, filter, max}` | 条件一致まで公開、side-channel に演出 reveal 列を残す (BUG-045/061) |
| `deckShuffle` | `{player}` | デッキシャッフル |
| `deckToBottomBound` | `{uid}` | bind 参照の char を deck 下へ (変装等) |
| `fileAdd` | `{player, n}` | デッキ上から n 枚を FILE へ (rules/05 オートフェイズ ②) |
| `filePopToHand` | `{player}` | FILE 最上 1 枚を手札へ (rules/12 ネクストヒント) |
| `discard` | `{player, target}` | 手札 → リムーブ。**PB**、awaiting-pick path あり |
| `handAddFromRemove` | `{player, target}` | リムーブ → 手札。**PB**、awaiting-pick path あり |

### 証拠 (4)

| verb | args | 説明 |
| --- | --- | --- |
| `evidenceGain` | `{player, n}` | デッキ上から n 枚を証拠へ (rules/11 推理 / rules/10 アクション[事件]) |
| `evidenceLose` | `{player, n}` | 証拠最上を n 枚リムーブ |
| `evidenceFlip` | `{player, idx}` | 証拠の idx 番目を face-up に |
| `evidenceToHand` | `{player, target}` | 証拠 → 手札。**PB**、awaiting-pick path あり |

### 現場 (5)

| verb | args | 説明 |
| --- | --- | --- |
| `sceneEnter` | `{player, cardId}` | 手札 → 現場 (rules/03 現場 5 枚制限は mutate で enforce) |
| `sceneSwitch` | `{player, cardId, replaceUid}` | スイッチ登場 (rules/20)。replaceUid を先にリムーブ |
| `sceneRemove` | `{uid, cause?}` | scene → リムーブ。cause: contact-ap/effect/switch/cost/misplay-overflow |
| `sceneSetState` | `{uid, state}` | active/sleep/stun (rules/03 スタン特殊挙動は mutate で適用) |
| `sceneDisguise` | `{uid, newCardId}` | 変装入替 (rules/09)。元 card は deck 下へ |

### キャラ修正 (12)

| verb | args | 説明 |
| --- | --- | --- |
| `charModifyAP` / `charModifyLP` | `{uid, delta, scope}` | AP/LP 加減算。scope: turn/contact/permanent |
| `charSetAP` / `charSetLP` | — | Phase 5 まで未サポート (throw) |
| `charOverrideAP` / `charOverrideLP` | `{uid, value, scope}` | rules/19 「元の AP/LP を X にする」 |
| `charGrantKeyword` / `charRevokeKeyword` | `{uid, keyword, scope?}` | キーワード付与/剥奪 (突撃/迅速/疾風/etc) |
| `charDisableOriginal` | `{uid, ability?}` | rules/19 「元の能力を無効にする」 |
| `charSetTurnEffect` | `{uid, effectId, value}` | ターン限定効果 set |
| `charSetCard` | `{uid, newCardId}` | card 入替 (変装ではない直接書き換え) |
| `charStackCard` | `{uid, cardId}` | 下に重ねる (rules/16) |

### パートナー / 事件 / フロー / Meta (9)

| verb | args | 説明 |
| --- | --- | --- |
| `partnerAssist` | `{player}` | アシスト発動 (rules/01 / rules/12)。パートナーを FILE へ |
| `partnerSetState` | `{player, state}` | パートナー状態変更 |
| `partnerSolveCase` | `{player}` | 事件解決 (rules/01)。勝利判定 |
| `caseToResolved` | `{player}` | 事件編→解決編 (rules/01)、FILE 7 枚条件は caller 確認 |
| `startContact` | `{attackerUid, defenderUid}` | コンタクト開始 (Phase 4+)。現状 log のみ |
| `endActionEarly` | `{}` | アクション早期終了 (Phase 4+)。現状 log のみ |
| `souza` | — | rules/13 捜査。Phase 5+ deferred (throw / no-op) |
| `log` | `{action, result?, target?}` | log 専用 entry (effect: prefix なし、カード固有メッセージ) |
| `noop` | `{}` | 何もしない (DSL placeholder) |

## $pick placeholder 対応

- **Pattern A** (`uid: '$pick'`): `sceneRemove` / `sceneSetState` / `sceneDisguise` / `charModifyAP/LP` / `charOverrideAP/LP` / `charGrantKeyword` / `charRevokeKeyword` / `charDisableOriginal` / `charSetTurnEffect` / `charSetCard` / `charStackCard` / `deckToBottomBound`
- **Pattern B** (uid 不在 + `target: pick query`): `discard` / `evidenceToHand` / `handAddFromRemove` (3 件、いずれも awaiting-pick path 実装済)

詳細は [engine-api-pick-substitution.md](engine-api-pick-substitution.md)。

## 関連

- 実装: [atom-handlers.ts](../../src/engine/effect/atom-handlers.ts)
- mutate primitives: [engine-api-state-mutate.md](engine-api-state-mutate.md)
- Effect Descriptor: [engine-api-effect-descriptor.md](engine-api-effect-descriptor.md)
- カード規約: [card-authoring-convention.md](card-authoring-convention.md)
