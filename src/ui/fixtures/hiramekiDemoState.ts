// 2026-05-26 ヒラメキ効果検証 demo 用 GameState fixture
//
// rules: 10-action-event.md §ヒラメキ
// spec: plan ファイル「ヒラメキ効果検証デモプレイ環境」
//
// 役割:
//   ユーザが picker で選んだ icon-flash 持ち cardId を self.evidence top に face-down で配置、
//   opp 現場 3 枚 (active+sleep 混在) で初期化。turn.player='opp' main phase なので
//   `dispatch({ type: 'actionAgainstCase', byUid: 'demo-opp-1', targetPlayer: 'self' })`
//   が即受付可能 → self.evidence top をリムーブ → hirameki listener 発火 →
//   HiramekiPickerModal が表示される。
//
// 設計上の注意:
//   - opp.scene[0] は active で isNamed: false (アクション可能な前提)
//   - self.deck は draw 効果 + refresh 余裕用に 8 枚程度
//   - self.case 必要証拠 6 (後攻)、opp.case 青色 / 事件編
//   - hand / scene / file / remove は最小 (デモ専用)

import type {
  GameState,
  SceneCharacter,
  PlayerState,
  EvidenceCard,
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
  const evidenceTop: EvidenceCard = {
    cardId: pickedCardId,
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' },
  };
  return {
    partner: { cardId: 'D11001', state: 'active', location: 'partner-area' },
    case: { cardId: 'D11021', status: '事件編', requiredEvidence: 6, colors: ['黄'] },
    scene: [],
    hand: [],
    deck: Array.from({ length: 8 }, () => 'D11008'),
    evidence: [evidenceTop],
    remove: [],
    file: [],
    mulliganUsed: true,
  };
}

function oppSide(): PlayerState {
  return {
    partner: { cardId: 'D08001', state: 'active', location: 'partner-area' },
    case: { cardId: 'D08020', status: '事件編', requiredEvidence: 7, colors: ['青'] },
    scene: [
      // 現場 #1 (active) — actionAgainstCase の byUid に使う
      makeScene('D08017', 'demo-opp-1', { enterOrder: 0, state: 'active' }),
      // 現場 #2 (sleep) — active/sleep 混在を示す
      makeScene('D08009', 'demo-opp-2', { enterOrder: 1, state: 'sleep' }),
      // 現場 #3 (active) — もう 1 枚 active
      makeScene('D08019', 'demo-opp-3', { enterOrder: 2, state: 'active' }),
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
 * ヒラメキ効果検証用 GameState を生成。
 *
 * @param pickedCardId user が picker で選んだ icon-flash 持ちカードの cardId
 * @returns turn.player='opp' main phase の初期 state。opp 現場 #1 active で
 *          actionAgainstCase 即受付可能。self.evidence 最上部に pickedCardId face-down。
 */
export function createHiramekiDemoState(pickedCardId: string): GameState {
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

/** opp 現場 #1 の uid (auto-dispatch 用) */
export const HIRAMEKI_DEMO_OPP_ATTACKER_UID = 'demo-opp-1';
