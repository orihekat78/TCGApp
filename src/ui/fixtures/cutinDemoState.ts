// 2026-05-27 カットイン効果検証 demo 用 GameState fixture
//
// rules: 09-cutin-disguise.md, 08-contact.md
// spec: plan ファイル「ヒラメキ効果検証デモプレイ環境」(hirameki demo と同型)
//
// 役割:
//   ユーザが picker で選んだ icon-cutin 持ち cardId を self.hand に配置、
//   opp 現場 #1 (active) が self 現場 #1 (sleep) に action[char] → guard pass →
//   contact → action-1 phase で CutInDisguisePickerModal が開く。
//   ユーザがカットインカードを click → effect (charModifyAP etc.) 発動 →
//   contact judge → demo 完了。
//
// 設計上の注意:
//   - turn.player='opp' main phase で opp が actionDeclareChar 実行可能
//   - self.scene には sleep キャラ 1 体 (action target)
//   - self.hand に選択カード (cutin) のみ、ガード対象キャラなし (guard 自動 pass)
//   - opp.scene[0] active (attacker)、isNamed: false

import type {
  GameState,
  SceneCharacter,
  PlayerState,
} from '@/engine/types/game-state.js';

function makeScene(
  cardId: string,
  uid: string,
  overrides: Partial<SceneCharacter> = {},
): SceneCharacter {
  return {
    cardId,
    uid,
    state: 'active',
    isNamed: false,
    enterOrder: 0,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
    ...overrides,
  };
}

function selfSide(pickedCardId: string): PlayerState {
  return {
    partner: { cardId: 'D11001', state: 'sleep', location: 'partner-area' },
    case: { cardId: 'D11021', status: '事件編', requiredEvidence: 6, colors: ['黄'] },
    // defender 1 体 (sleep — opp の action[char] 対象)
    scene: [
      makeScene('D11004', 'demo-self-def', { enterOrder: 0, state: 'sleep' }),
    ],
    // 選択 cutin カードのみ手札に
    hand: [pickedCardId],
    deck: Array.from({ length: 8 }, () => 'D11008'),
    evidence: [],
    remove: [],
    file: [],
    mulliganUsed: true,
  };
}

function oppSide(): PlayerState {
  return {
    partner: { cardId: 'D08001', state: 'active', location: 'partner-area' },
    case: { cardId: 'D08020', status: '事件編', requiredEvidence: 7, colors: ['青'] },
    // attacker (active) — actionDeclareChar の byUid に使う
    scene: [
      makeScene('D08003', 'demo-opp-atk', { enterOrder: 0, state: 'active' }),
    ],
    hand: [],
    deck: Array.from({ length: 8 }, () => 'D08008'),
    evidence: [],
    remove: [],
    file: [],
    mulliganUsed: true,
  };
}

/**
 * カットイン効果検証用 GameState を生成。
 *
 * @param pickedCardId user が picker で選んだ icon-cutin 持ちカードの cardId
 * @returns turn.player='opp' main phase の初期 state。opp 現場 #1 active で
 *          actionDeclareChar 即受付可能。self 現場 #1 sleep が action 対象。
 *          self.hand に pickedCardId (cutin) のみ配置。
 */
export function createCutinDemoState(pickedCardId: string): GameState {
  return {
    turn: { number: 1, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false },
    players: { self: selfSide(pickedCardId), opp: oppSide() },
    pendingEffects: [],
    scratchTrace: { self: '未発見', opp: '未発見' },
    turnState: {
      self: { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
      opp:  { handUseUsed: false, nextHintUsed: false, assistedThisTurn: false, declaredAbilityUseCount: {} },
    },
    refreshCount: { self: 0, opp: 0 },
    log: [],
  };
}

/** opp 攻撃キャラ uid */
export const CUTIN_DEMO_OPP_ATTACKER_UID = 'demo-opp-atk';
/** self defender uid (action target) */
export const CUTIN_DEMO_SELF_DEFENDER_UID = 'demo-self-def';
