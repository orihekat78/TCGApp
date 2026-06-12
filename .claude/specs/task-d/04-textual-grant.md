# Task D E4 — textual ability grant (非キーワードテキスト能力の付与)

rules: 03(状態) 07/08(ガード・コンタクト) 13(キーワード) 15/25(効果解決) 17(アイコン) 19(元の能力無効≠付与効果)
22(コンタクトリムーブのみ) 23(変装引継ぎ=turnEffects 自動) 24(常時系即失効)

## 方針: 6 token 正規化 + 二重チャネル統一 reader (mustBeTargeted/D11005 流儀の水平展開)

tokens: `actionTargetsActive` / `sleepGuard` / `mustGuard` / `contactImmune`(typed 既存・writer ゼロ) /
`removeOnTurnEnd`(typed 既存・consume 未実装) / `toDeckBottomOnTurnEnd`(新規)。
- **read/char.ts `hasTextAbility(s,uid,token)`**: turnEffects[token] / [token+'_oppTurn'] / [token+'_action'] === true
  OR keywords() に 'text:'+token (印字常時条件型 B09028 用、disabledOriginal で消える既存分岐と整合 rules/19)
- 付与チャネル規約 (card-authoring-convention.md 追記): ターン終了時まで=charGrantKeyword 'text:' or charSetTurnEffect /
  相手ターン終了時まで='_oppTurn' suffix + clearTurnEffects 'opp-turn' 枝 / アクション終了時まで='_action' suffix + 新 scope 'action'。
  **removeOnTurnEnd / toDeckBottomOnTurnEnd は charSetTurnEffect 限定** (endTurn consume は flag のみ読むため)

## 判定点 wiring (全て flag 不在時 byte-equal = additive)

1. **actionTargetsActive**: target-expander candidates() に hasTextAbility 読み → 相手 active を追加。
   既存 __pendingActionExpansion side-channel は **dead code と判明** (push のみ消費者ゼロ) — 使わず turnEffects 直読み。stale コメント修正
2. **sleepGuard**: guard.candidates filter を `active || (sleep && hasTextAbility)` に。stun 除外 (rules/03)
3. **mustGuard**: guard.mustGuardCandidates 新設 (mustTargetCandidates 同型) + passGuard/tryGuard enforce throw +
   AI (action-resolution.ts: must 非空→must から選択) + UI (useContactFlowDriver/GuardPickerModal forced prop で「ガードしない」非表示) + dispatch validation
4. **contactImmune**: state-machine snapshotAP で bUid 確定後に turnEffects 読みで ax.contactImmune 設定
   (judge=contact.ts:247 は既読・writer ゼロの正規配線)。rules/22: AP判定リムーブのみ、カットイン直接リムーブは貫通 ✓
5. **removeOnTurnEnd / toDeckBottomOnTurnEnd consume**: endTurn の cleanup emit 後・clearTurnEffects 前に uid snapshot →
   removeToRemove(=leave:to-remove 発火 ✓) / **scene.toDeck(bottom)** (E2 primitive、rules/16 set 清掃込み)。
   phase:end:start trigger が先 (rules/05 ①能力発動→②効果切れ) — 挿入位置で保証
6. **charGrantAbility verb** `{uid|'$pick'+target, ability:{trigger,condition?,limit?,effect}, scope:'turn'}`:
   turnEffects.grantedAbilities[] に JSON descriptor append (id=granted:<src>:<n>)。triggered.ts handleHook の走査を
   def.abilities + grantedAbilityDefs concat に拡張 (scene のみ)。limit は既存 declaredUseCount 経路。
   validate.ts: JSON 強制 (closure/custom 拒否)・**trigger.hook='leave:to-remove' は拒否** (virtual-location handler 未対応)。
   清掃: clearTurnEffects 'turn' 枝に delete (BUG-119 教訓: 新 turn キーは必ず清掃列挙)
7. **B09041 用 micro**: condition `charTurnEffect {key}` + triggerCharMatches `payloadKey` 拡張 (guardUid 評価、player は scene 走査導出) +
   **ai/action-resolution.ts: tryGuard/passGuard 直後に runAllUntilEmpty 追加** (granted contactImmune_action が judge 前に解決されるため必須)
8. **aura grant (B09024) は sub-phase 2** (continuous OWNER-ONLY 制約を破る唯一箇所、二重 queue 防止テスト必須) — 本 wave では DEFER 可

## touched files

engine: read/char.ts / flow/{guard,turn}.ts / flow/action/{target-expander,state-machine}.ts / mutate/char.ts (clearTurnEffects 枝+grantAbility) /
effect/{atom-handlers,validate}.ts / types/{effect,game-state,card-def}.ts / listeners/triggered.ts / cond/eval.ts。
AI/UI: ai/action-resolution.ts / ui/hooks/{useContactFlowDriver,useEngineDispatch}.ts / ui/components/GuardPickerModal.tsx (forced) /
KeywordBadge 等 keywords() 表示系に 'text:' prefix 除外 filter。scripts/taskA-validate-specs.cjs whitelist

## edge cases

1. mustGuard: 攻撃側ブレット→candidates空→「ガードできる場合」不成立で強制なし (candidates() 由来で自動)。複数 must は中から1体選択
2. sleepGuard×スタン: stun は不可。tryGuard の sleep 化は冪等
3. _action scope: contact-end→action-end と abortIfMissing の両経路で清掃 (同ターン2回目アクションへの stale 免疫防止)
4. 変装引継ぎ: token/grantedAbilities は turnEffects 上で自動引継ぎ (rules/23)、離場で消滅
5. mustBeTargeted×actionTargetsActive 創発 (active 挑発が強制対象に昇格) — テスト固定
6. granted trigger は付与元離場後も有効 (rules/15)。endTurn cleanup 順序: emit→consume→clear
7. 'text:' keywords の UI/TargetFilter.keyword への leak 防止 filter
8. 「パートナーエリアでも宣言できる」句は partner-area slot 不在で vacuous (B07093 前例、DEFERRED-INDEX 注記)

## verdicts (検証後)

✅: B08037(P) / B09028 / PR181・PR187 / B09054(P) (oppTurn) / B09041(P) (micro 7 込み) / B08029(P) / B08032(P) (本体句) /
B07090(P)・B09032 (E0 pick-bind 込み) / B02014 (E0+multi-pick 既存)。
partial: B07079 (cost sceneToDeck は E2 で解消するが pick-share→E0 で解消、partner-area 句 vacuous → 実装時再判定) /
B09040 (a1 bound-card-level dyn 別 gate) / B08008 (charStackCard host bind 別 gate) / B09024 (aura=sub-phase 2 + reveal-cost)
