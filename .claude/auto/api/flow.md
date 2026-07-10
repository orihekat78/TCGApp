# 🤖 engine.flow

> ⚠️ このファイルは `scripts/gen-docs/gen-api.ts` により自動生成された。手で編集しない。
> 再生成: `npm run docs:api`
> Source hash: `9824d4feaf4f`

フェイズ制御（setup / auto / main / action FSM / contact / actionCase / guard）

## アグリゲータ (`engine.flow`)

以下のメンバーで構成される（プロパティ名のみ。詳細は各サブモジュール参照）:

- `action`
- `actionCase`
- `contact`
- `endTurn`
- `guard`
- `runAutoPhase`
- `setup`
- `startMainPhase`
- `startTurn`

## サブ namespace

| 名前 | メンバー |
| ---- | -------- |
| `action` | `_deleteContext`, `_getContext`, `_resetActionContexts`, `_resetTargetExpanders`, `abortIfMissing`, `advance`, `candidates`, `computeOrder`, `declare`, `mustTargetCandidates`, `passGuard`, `registerTargetExpander`, `snapshotAP`, `startFromEffect`, `tryGuard` |
| `actionCase` | `flashWindow`, `gainSelfEvidence`, `removeOpponentEvidenceTop` |
| `contact` | `canCutIn`, `canDisguise`, `computeOrder`, `cutIn`, `disguise`, `judge`, `pass` |
| `guard` | `canGuard`, `candidates`, `mustGuardCandidates` |
| `setup` | `canMulligan`, `dealOpeningHand`, `decideFirstPlayer`, `init`, `mulligan`, `reveal`, `startGame` |

## 関数

| 名前 | シグネチャ | 説明 |
| ---- | ---------- | ---- |
| `_resetTargetExpanders` | `(): void` |  |
| `actionCandidates` | `(state: GameState, byUid: string): TargetCandidate[]` | candidates — アクション対象候補を返す。 通常 (rules/07): 相手の現場 + state ∈ {sleep, stun} 拡張: registerTargetExpander で登録された expander の戻り値を追加 - 同一 uid は dedup (base 優先) / |
| `activateDeclaredAbility` | `(state: GameState, uid: string, abilId: string, costParams?: AbilityCostParams): void` | activateDeclaredAbility — 宣言能力の cost 支払い + 使用宣言 (atomic)。 - uid から所有者/cardId/area を逆引きして EffectCtx を構築 (呼出元の ctx 構築は不要) - カード def に cost があれば必ず engine.cost.… |
| `activatePartnerAbility` | `(state: GameState, player: Player, abilId: string, costParams?: AbilityCostParams): void` | activatePartnerAbility — パートナー能力の cost 支払い + 使用宣言 (atomic)。 usePartnerAbility は ctx を取らない (効果は effect:declared listener 側) ため、 ctx は pay にのみ使用する。 / |
| `canAction` | `(state: GameState, byUid: string): boolean` | canAction — アクション宣言の汎用可否 (対象種別を問わない) - 主体が active - 名乗りなし、または名乗り例外 (迅速 / 突撃 / 突撃[キャラ] / 突撃[事件] のいずれか) 注意: partner はキャラと違い 名乗り状態の概念がない (rules/06)。 / |
| `canActionAgainstCase` | `(state: GameState, byUid: string, targetPlayer: Player): boolean` | canActionAgainstCase — 相手事件へのアクション可否。 - 主体が canAction (target='case') - 相手の証拠 ≥ 1 (rules/07: 証拠が1つもない事件は対象不可) / |
| `canActionAgainstChar` | `(state: GameState, byUid: string, targetUid: string): boolean` | canActionAgainstChar — 相手キャラへのアクション可否。 - 主体が canAction (target='char') - 対象が targetExpander.candidates() に含まれる - 通常 (rules/… |
| `canDeclaredAbility` | `(state: GameState, uid: string, abilId: string): boolean` | canDeclaredAbility — 宣言能力使用可能か判定する。 - 対象キャラが存在する - 名乗り状態でも OK (rules/24) - active でなくても OK (ただし sleep コストは支払不可なため別途 engine.cost.canPay 判定が必要) - 【ターン①/②】 ability.… |
| `canHandUseCard` | `(state: GameState, p: Player, cardId: string): boolean` | canHandUseCard — 通常の手札使用が可能か (scene 上限 5 未満)。 scene が 5 でキャラ登場するときは canHandUseCardSwitch を使う (rules/20 §スイッチ)。 / |
| `canHandUseCardSwitch` | `(state: GameState, p: Player, cardId: string): boolean` | canHandUseCardSwitch — 手札使用 + スイッチ (rules/20 §スイッチ) が可能か判定。 条件: 通常ゲート ∧ cardId がキャラ ∧ 現場が満員 (5 枚)。 リムーブ対象 removeUid の検証 (scene に存在するか) は呼出側 / mutate.scene.switchEnter 側。 / |
| `canPartnerAbility` | `(state: GameState, p: Player, _abilId: string): boolean` | canPartnerAbility — パートナー能力使用可能か判定する。 - パートナーがアクティブ状態 - パートナーが partner-area にいる (file-area / mr-removed は不可) abilId 単位の細かい条件 (【ターン①】等) はカード固有 listener で判定する想定。 / |
| `canReason` | `(state: GameState, uid: string): boolean` | canReason — 推理可能か判定する。 - 対象キャラ / パートナーが存在 - active 状態 - キャラの場合: 名乗りなし or 迅速持ち (rules/11, 13) - パートナーの場合: 名乗り状態の概念なし (rules/06) → active なら常に可 / |
| `canStartNextHint` | `(state: GameState, p: Player): boolean` | canStartNextHint — ネクストヒントを開始可能か判定する。 - FILE 最上部 (アシストパートナー以外) が 1 枚以上必要 (= 実質 FILE ≥ 1 + 非アシスト) / |
| `doReasoning` | `(state: GameState, uid: string): void` | doReasoning — 推理を実行する。 - reasoning:declare → スリープ化 → reasoning:before-add → 証拠追加 → reasoning:end - LP は max(0, lp) で証拠枚数を決定 (rules/… |
| `endTurn` | `(state: GameState, p: Player): void` | ターン終了処理 (rules/05 エンドフェイズ): 1. phase:main:end (メインフェイズ終了) 2. phase:end:start (エンドフェイズ開始 — ターン終了時能力発火窓) 3. [呼出元の責務] resolve.runAllUntilEmpty でターン終了時 trigger 解決 4.… |
| `grantedDeclaredAbilitiesOf` | `(char: { turnEffects?: Record<string, unknown> } \| undefined): AbilityDef[]` | grantedDeclaredAbilitiesOf — 指定 scene char に charGrantAbility で付与された declared ability を列挙する共有 helper (gap② 2026-07-11, B06042)。 findDeclaredAbility の granted 走査と 1:1 対称 — UI/… |
| `handUseCard` | `(state: GameState, p: Player, cardId: string, _ctx?: unknown, switchRemoveUid?: string): void` | handUseCard — 手札の使用を宣言する。 - turnFlags.handUseUsed=true をセット - effect:declared hook を emit (Phase 5 で登録された listener が pendingEffects に積む) - ログ追加 実際のカード効果解決は呼出元が engine.resolve.runAllUntilEmpty を実行する責務。… |
| `mustTargetCandidates` | `(state: GameState, byUid: string): TargetCandidate[]` | mustTargetCandidates — 必ず指定すべき対象 (G28: turnEffects.mustBeTargeted=true) - 相手 (opp) の scene を走査 - turnEffects.mustBeTargeted === true のキャラのみ返す / |
| `registerTargetExpander` | `(uid: string, expander: TargetExpander): Unsubscribe` | registerTargetExpander — 指定 uid を発火元とする対象拡張を登録する。 戻り値の Unsubscribe を呼ぶと該当 uid のエントリを削除する。 同じ uid で複数回登録した場合は **後勝ち** (上書き)。 / |
| `runAutoPhase` | `(state: GameState, p: Player): void` | runAutoPhase — オートフェイズの 1 ターン分を実行する。 ⚠ Phase 4: 各ステップは状態変更のみ。能力起動 (登場時等) は emit 経由で pendingEffects に積まれる。実際の解決は呼出元が engine.resolve.runAllUntilEmpty を呼ぶ責務。 / |
| `runNextHint` | `(state: GameState, p: Player, optionalCardId?: string): void` | runNextHint — ネクストヒントを実行する。 @param optionalCardId — 2. の段で使用するカード (省略時は FILE→手札のみ) - rules/12: 1 で加えたカードは FILE 枚数判定に数えない → 判定はカード使用の **時点** の FILE 枚数を見るが、手札に加わったカードは FILE から既に取り除かれているので自然に正しくなる / |
| `startMainPhase` | `(state: GameState, p: Player): void` | メインフェイズ開始 (再エントリ用): startTurn から自動的に呼ばれるが、 単独で呼出して phase:main:start のみ emit したい場合に使用する。 / |
| `startTurn` | `(state: GameState, p: Player): void` | ターン開始: turn:start を emit → オートフェイズ実行 → phase:main:start を emit。 rules/05: - オートフェイズ (パートナー active / キャラ active / ドロー / FILE) - メインフェイズ突入 / |
| `useDeclaredAbility` | `(state: GameState, uid: string, abilId: string, ctx?: { costPaid?: Record<string, unknown>; dyn?: Record<string, unknown>; source?: { cardId?: string; uid?: string; abilityId?: string; player?: 'self' \| 'opp'; area?: string }; }): void` | useDeclaredAbility — 宣言能力使用を宣言する。 - declaredUseCount[abilId] をインクリメント - effect:declared を emit - ログ追加 cost 支払いは呼出元の responsibility (Phase 4 は分離). / |
| `usePartnerAbility` | `(state: GameState, p: Player, abilId: string, _ctx?: unknown): void` | usePartnerAbility — パートナー能力使用を宣言する。 - effect:declared を emit (cost / 効果は listener 側で処理) - ログ追加 / |

## 型エクスポート

- `AbilityCostParams`
- `Deck`
- `DeckPair`
- `TargetCandidate`
- `TargetExpander`

---

## ソース

- [`src/engine/flow/index.ts`](../../../src/engine/flow/index.ts)

