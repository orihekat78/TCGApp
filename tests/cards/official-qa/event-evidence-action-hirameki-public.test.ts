// qa: card:B04041:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:B04062:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:B04086:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:B10031:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR012:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR013:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR014:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR015:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR016:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR017:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR018:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR019:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR020:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR021:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR062:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// qa: card:PR066:81627994c8cd71276729bf3830a0af0b74282ef2b10f533d265d9045bdc2131c
// rules: 10-action-event.md, 15-abilities-effects.md

import { ALL_CARDS, registerAll } from '@/cards';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

const EVIDENCE_GAIN_IDS = [
  'B04041', 'B04062', 'B04086',
  'PR012', 'PR013', 'PR014', 'PR015', 'PR016', 'PR017', 'PR018', 'PR019', 'PR020', 'PR021',
  'PR062', 'PR066',
] as const;

const ATTACKER_ID = 'B10022';
const B10031_VICTIM_ID = 'QA-B10031-VICTIM';
const CASE_ID = 'D03016';
const SELF_TOP = 'QA-HIRAMEKI-SELF-TOP';
const SELF_SPARE = 'QA-HIRAMEKI-SELF-SPARE';
const OPP_AUTO_DRAW = 'QA-HIRAMEKI-OPP-AUTO-DRAW';
const OPP_AUTO_FILE_A = 'QA-HIRAMEKI-OPP-AUTO-FILE-A';
const OPP_AUTO_FILE_B = 'QA-HIRAMEKI-OPP-AUTO-FILE-B';
const OPP_TOP = 'QA-HIRAMEKI-OPP-TOP';
const OPP_SPARE = 'QA-HIRAMEKI-OPP-SPARE';

type Proof = {
  enteredEvidenceFromPublicPath: boolean;
  opened: boolean;
  abilityId: string | null;
  sourceAbsentDuringHirameki: boolean;
  sourceRemoved: boolean;
  sourceStillEvidence: boolean;
  gainedEvidence: boolean;
  drewCard: boolean;
  opponentGainedEvidence: boolean;
  terminal: boolean;
};

function card(cardId: string): CardDef {
  const found = ALL_CARDS.find(candidate => candidate.id === cardId);
  if (!found) throw new Error(`missing shipped card ${cardId}`);
  return found;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function installEventInHand(cardId: string): void {
  const source = card(cardId);
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [sceneChar(ATTACKER_ID, `attacker-${cardId}`)];
  state.players.opp.deck = [OPP_AUTO_DRAW, OPP_AUTO_FILE_A, OPP_AUTO_FILE_B, OPP_TOP, OPP_SPARE];
  state.players.self.case.cardId = CASE_ID;
  state.players.self.case.colors = [...source.colors];
  state.players.self.file = Array.from(
    { length: source.level },
    () => ({ type: 'card-back' as const, cardId: 'QA-HIRAMEKI-FILE' }),
  );
  state.players.self.hand = [cardId];
  state.players.self.deck = [SELF_TOP, SELF_SPARE];
  const sessionId = `qa-action-hirameki-${cardId}`;
  startCausalSession(state, sessionId);
  resetPresentationQueue(sessionId);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function playEventAndOpenActionHirameki(cardId: string): {
  abilityId: string;
  enteredEvidenceFromPublicPath: true;
  opened: true;
  sourceAbsentDuringHirameki: true;
} {
  installEventInHand(cardId);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId })).toEqual({ ok: true });
  expect(current().players.self.hand).not.toContain(cardId);
  expect(current().players.self.evidence).toContainEqual(expect.objectContaining({ cardId, faceUp: true }));
  expect(current().players.self.remove).not.toContain(cardId);
  expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
  expect(current().turn.player).toBe('opp');
  expect(dispatchEngineAction({
    type: 'actionDeclareCase',
    byUid: `attacker-${cardId}`,
    targetPlayer: 'self',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingHirameki;
  expect(pending).toMatchObject({ player: 'self', cardId });
  expect(current().players.self.remove).not.toContain(cardId);
  return {
    abilityId: pending!.abilityId,
    enteredEvidenceFromPublicPath: true,
    opened: true,
    sourceAbsentDuringHirameki: true,
  };
}

function proveEventFaceUpActionHirameki(cardId: string): Proof {
  const opened = playEventAndOpenActionHirameki(cardId);
  expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  const state = current();
  expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  expect(useGameStateStore.getState().activeActionId).toBeNull();
  expect(state.pendingRuntimeState).toBeUndefined();
  return {
    ...opened,
    sourceRemoved: state.players.self.remove.includes(cardId),
    sourceStillEvidence: state.players.self.evidence.some(entry => entry.cardId === cardId),
    gainedEvidence: state.players.self.evidence.some(entry => entry.cardId === SELF_TOP && entry.faceUp === false),
    drewCard: state.players.self.hand.includes(SELF_TOP),
    opponentGainedEvidence: state.players.opp.evidence.some(entry => entry.cardId === OPP_TOP && entry.faceUp === false),
    terminal: useGameStateStore.getState().pendingHirameki === null
      && useGameStateStore.getState().activeActionId === null
      && state.pendingRuntimeState === undefined,
  };
}

function installB10031ContactState(): void {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [sceneChar('B10031', 'minowa')];
  state.players.opp.scene = [
    sceneChar(B10031_VICTIM_ID, 'victim', { state: 'sleep' }),
    sceneChar(ATTACKER_ID, 'attacker-B10031'),
  ];
  state.players.self.case.cardId = CASE_ID;
  state.players.self.case.colors = [...card('B10031').colors];
  state.players.self.file = Array.from(
    { length: card('B10031').level },
    () => ({ type: 'card-back' as const, cardId: 'QA-HIRAMEKI-FILE' }),
  );
  state.players.self.deck = [SELF_TOP, SELF_SPARE];
  state.players.opp.deck = [OPP_AUTO_DRAW, OPP_AUTO_FILE_A, OPP_AUTO_FILE_B, OPP_TOP, OPP_SPARE];
  const sessionId = 'qa-action-hirameki-B10031';
  startCausalSession(state, sessionId);
  resetPresentationQueue(sessionId);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function finishB10031ContactRemoval(): void {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'minowa', targetUid: 'victim',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
    .toEqual({ ok: true });

  for (let step = 0; step < 16; step += 1) {
    const action = current().actionContexts?.[actionId!];
    if (!action || action.phase === 'action-end') break;
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const actingUid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = current().players.self.scene.some(character => character.uid === actingUid)
        ? 'self'
        : 'opp';
      expect(dispatchEngineAction({
        type: 'actionContact', actionId: actionId!, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
    } else if (action.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  }

  expect(current().players.opp.scene.some(character => character.uid === 'victim')).toBe(false);
  expect(current().players.self.scene.find(character => character.uid === 'minowa')?.turnEffects)
    .toMatchObject({ removedOpponentByContactThisTurn: true });
}

function proveB10031FaceUpActionHirameki(): Proof {
  installB10031ContactState();
  finishB10031ContactRemoval();
  expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
  expect(current().turn.player).toBe('opp');
  expect(current().players.self.scene.some(character => character.uid === 'minowa')).toBe(false);
  expect(current().players.self.evidence).toContainEqual(expect.objectContaining({
    cardId: 'B10031', faceUp: true,
  }));

  expect(dispatchEngineAction({
    type: 'actionDeclareCase', byUid: 'attacker-B10031', targetPlayer: 'self',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  expect(actionId).toBeTruthy();
  expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingHirameki;
  expect(pending).toMatchObject({ player: 'self', cardId: 'B10031', abilityId: 'a3' });
  const sourceAbsentDuringHirameki = !current().players.self.evidence.some(entry => entry.cardId === 'B10031')
    && !current().players.self.remove.includes('B10031');

  expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
  const state = current();
  return {
    enteredEvidenceFromPublicPath: true,
    opened: true,
    abilityId: pending!.abilityId,
    sourceAbsentDuringHirameki,
    sourceRemoved: state.players.self.remove.includes('B10031'),
    sourceStillEvidence: state.players.self.evidence.some(entry => entry.cardId === 'B10031'),
    gainedEvidence: state.players.self.evidence.some(entry => entry.cardId === SELF_TOP && entry.faceUp === false),
    drewCard: state.players.self.hand.includes(SELF_TOP),
    opponentGainedEvidence: state.players.opp.evidence.some(entry => entry.cardId === OPP_TOP && entry.faceUp === false),
    terminal: useGameStateStore.getState().pendingHirameki === null
      && useGameStateStore.getState().activeActionId === null
      && state.pendingRuntimeState === undefined,
  };
}

const EVIDENCE_GAIN_PROOF: Proof = {
  enteredEvidenceFromPublicPath: true,
  opened: true,
  abilityId: 'a2',
  sourceAbsentDuringHirameki: true,
  sourceRemoved: true,
  sourceStillEvidence: false,
  gainedEvidence: true,
  drewCard: false,
  opponentGainedEvidence: true,
  terminal: true,
};

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  registerAll();
  registerCardDef({
    ...card('B10031'),
    id: B10031_VICTIM_ID,
    no: B10031_VICTIM_ID,
    names: [B10031_VICTIM_ID],
    level: 1,
    ap: 1000,
    abilities: [],
  });
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  useGameStateStore.setState({ gameState: null, pendingHirameki: null });
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('official QA face-up evidence Hirameki through public action dispatch', () => {
  it('B04041', () => { expect(proveEventFaceUpActionHirameki('B04041')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('B04062', () => { expect(proveEventFaceUpActionHirameki('B04062')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('B04086', () => { expect(proveEventFaceUpActionHirameki('B04086')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR012', () => { expect(proveEventFaceUpActionHirameki('PR012')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR013', () => { expect(proveEventFaceUpActionHirameki('PR013')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR014', () => { expect(proveEventFaceUpActionHirameki('PR014')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR015', () => { expect(proveEventFaceUpActionHirameki('PR015')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR016', () => { expect(proveEventFaceUpActionHirameki('PR016')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR017', () => { expect(proveEventFaceUpActionHirameki('PR017')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR018', () => { expect(proveEventFaceUpActionHirameki('PR018')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR019', () => { expect(proveEventFaceUpActionHirameki('PR019')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR020', () => { expect(proveEventFaceUpActionHirameki('PR020')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR021', () => { expect(proveEventFaceUpActionHirameki('PR021')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR062', () => { expect(proveEventFaceUpActionHirameki('PR062')).toEqual(EVIDENCE_GAIN_PROOF); });
  it('PR066', () => { expect(proveEventFaceUpActionHirameki('PR066')).toEqual(EVIDENCE_GAIN_PROOF); });

  it('B10031 opens its distinct draw Hirameki from the same face-up action boundary', () => {
    expect(card('B10031').abilities.map(ability => ability.id)).toContain('a3');
    expect(proveB10031FaceUpActionHirameki()).toEqual({
      enteredEvidenceFromPublicPath: true,
      opened: true,
      abilityId: 'a3',
      sourceAbsentDuringHirameki: true,
      sourceRemoved: true,
      sourceStillEvidence: false,
      gainedEvidence: false,
      drewCard: true,
      opponentGainedEvidence: true,
      terminal: true,
    });
  });

  it('keeps the representative B04041 Hirameki optional on the public action path', () => {
    playEventAndOpenActionHirameki('B04041');
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(current().players.self.evidence).toEqual([]);
    expect(current().players.self.deck).toEqual([SELF_TOP, SELF_SPARE]);
    expect(current().players.self.remove).toContain('B04041');
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  });

  it('enumerates every evidence-gain printing in this exact QA family', () => {
    const abilities = EVIDENCE_GAIN_IDS.map(id => card(id).abilities.find(ability => ability.id === 'a2'));
    expect(abilities.every(ability => ability?.trigger?.hook === 'evidence:remove-by-action'
      && ability.effect.kind === 'atom'
      && ability.effect.verb === 'evidenceGain')).toBe(true);
  });
});
