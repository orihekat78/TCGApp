// useEngineDispatch/types.ts — Phase 3d 分割 (EngineAction / ContactChoice / DispatchResult / Player, verbatim, 2026-06-22)
import type { AbilityCostParams } from '@/engine/flow/index.js';

export type Player = 'self' | 'opp';

/**
 * Phase 8.1+ で扱うメインフェイズ単発 action。
 * - action 宣言 / コンタクト 9 段階等は後続 task で別 dispatcher。
 * - assist / solveCase は flow に専用ラッパが無いため `mutate.partner.*` を直叩き
 *   (`src/ai/policy.ts` と同じ運用)。can-check は move-enumerator と同じ条件を inline。
 */
/**
 * Phase 8 完全クローズ Commit 2: コンタクト 中の人間プレイヤーの選択肢。
 *  - 'cutin': 手札のカットイン能力カードを選択
 *  - 'disguise': 手札の変装能力カードを選択
 *  - 'pass': 行動しない
 */
export type ContactChoice =
  | { kind: 'cutin'; cardId: string }
  | { kind: 'disguise'; cardId: string }
  | { kind: 'pass' };

export type EngineAction =
  | { type: 'reasoning'; uid: string }
  | { type: 'handUseCard'; player: Player; cardId: string }
  // Phase 5 advance: SceneSwitch (rules/20) — scene 5 埋まり時のキャラ手札使用
  | { type: 'handUseCardSwitch'; player: Player; cardId: string; removeUid: string }
  | { type: 'nextHint'; player: Player; optionalCardId?: string }
  // Phase 2c (BUG-116 構造解消): cost+ctx は dispatcher 内 (engine.flow.activateXxx) で構築する。
  // 呼出元は picker 選択値 (costParams) のみ渡す — cost/ctx の caller 構築契約は廃止。
  | { type: 'partnerAbility'; player: Player; abilId: string; costParams?: AbilityCostParams }
  | { type: 'declaredAbility'; uid: string; abilId: string; costParams?: AbilityCostParams }
  | { type: 'assist'; player: Player }
  | { type: 'solveCase'; player: Player }
  | { type: 'actionAgainstChar'; byUid: string; targetUid: string }
  | { type: 'actionAgainstCase'; byUid: string; targetPlayer: Player }
  // Phase 8 完全クローズ Commit 2: per-step action dispatch
  // - 既存 actionAgainstChar / actionAgainstCase は CPU vs CPU 用に温存
  // - 新 dispatch は useContactFlowDriver と組み合わせて人間プレイヤー介入を実現
  | { type: 'actionDeclareChar'; byUid: string; targetUid: string }
  | { type: 'actionDeclareCase'; byUid: string; targetPlayer: Player }
  | { type: 'actionGuard'; actionId: string; guarderUid: string | null }
  | { type: 'actionContact'; actionId: string; player: Player; choice: ContactChoice }
  | { type: 'actionAdvance'; actionId: string }
  | { type: 'actionJudge'; actionId: string }
  | { type: 'leaveInterceptResolve'; accept: boolean }
  | { type: 'rpsResolve'; hand: 'rock' | 'paper' | 'scissors' }
  | { type: 'setCardChoiceResolve'; instanceId: string }
  | { type: 'setCardReplacementResolve'; targetUid: string | null }
  // Phase 8 完全クローズ Commit 3a: ヒラメキ発動 / スキップ決定
  | { type: 'hiramekiResolve'; choice: 'fire' | 'skip' }
  // Phase 8 完全クローズ Commit 3b: ミスリード発動キャラ複数選択
  | { type: 'misreadResolve'; picks: ReadonlyArray<{ uid: string; x: number }> }
  // user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択結果
  // Phase 2c: optional 引数群の required/optional を 4 形態の union で明示。
  //   - skip:   pickedUid=null 単独 (「選ばない」— n.min===0 任意効果のみ。pending と対の
  //             continuation も自動 drop (BUG-111)。他引数は同時指定しない)
  //   - single: pickedUid のみ
  //   - multi:  pickedUids 必須 (nMax>1 の一括 resolve。D08021 charStackCard 等 multi-pick atom が
  //             cardIds:'$pick.cardIds' を resolved 配列で受ける。pickedUid は先頭要素)
  //   - switch: switchRemoveUid 必須 (効果登場 sceneEnter が現場満杯のとき SceneSwitchPickerModal
  //             で収集した退場キャラ uid。rules/20 スイッチで switchEnter — switch-on-effect-enter)
  | { type: 'effectPickResolve'; pickedUid: null }
  | { type: 'effectPickResolve'; pickedUid: string }
  | { type: 'effectPickResolve'; pickedUid: string; pickedUids: string[] }
  | { type: 'effectPickResolve'; pickedUid: string; switchRemoveUid: string }
  // cluster14: multi-card sceneEnter (B09010「2枚まで登場」) が現場満杯のとき、UI が overflow 枚数ぶん
  //   集めた退場 uid 群を pickedUids と同時に運ぶ。switchRemoveUid (単数) は付けない → 既存 discrimination 不変。
  | { type: 'effectPickResolve'; pickedUid: string; pickedUids: string[]; switchRemoveUids: string[] }
  // BUG-121: human 複数 option choice の選択結果 (enter トリガ等)。pendingEffectChoice を解決する。
  | { type: 'choiceResolve'; choiceIndex: number }
  | { type: 'choiceResolve'; choiceIndex: number; switchRemoveUid: string }
  // 2026-06-06 タスクC: optional (「〜してもよい」) の決定。pendingEffectOptional を解決する。
  | { type: 'optionalResolve'; run: boolean }
  | { type: 'chooseInterceptResolve'; discardIndex: number | null }
  | { type: 'repeatOptionalResolve'; run: boolean }
  // BUG-136: deckToBottomBound「好きな順番でデッキの下に移す」の順序確定。order = 底ブロックの新順 (cardId 列)。
  | { type: 'deckReorderResolve'; order: string[] }
  // mini-wave #5 P2: deckPlaceSplitBound「各カードを上か下へ」の振り分け確定。top/bottom = 各バケツの cardId 列 (順序込み)。
  | { type: 'deckPlaceResolve'; top: string[]; bottom: string[] }
  // Phase 8 完全クローズ Commit 5: 効果スタック同所有者順序設定 (▲▼ UI)
  | { type: 'setEffectOrder'; entryId: string; order: number; player: Player }
  /** entryIds is the exact visible group snapshot; stale confirmations are rejected. */
  | { type: 'resolveEffectOrder'; player: Player; entryIds: string[] }
  | { type: 'endTurn'; player: Player };

export type DispatchResult =
  | { ok: true }
  | { ok: false; reason: 'no-state' | 'not-allowed' | 'engine-error'; detail?: string };
