import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { PR306 } from '@/cards/pr-01/PR306';
import { PR308 } from '@/cards/pr-01/PR308';
import { PR320 } from '@/cards/pr-01/PR320';
import { event } from '@/engine/event';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { cutIn } from '@/engine/flow/contact';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char } from '@/engine/read/char';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runCardScenario } from '../helpers/card-probe-harness';
import type { ActionContext, CardDef, GameState } from '@/engine/types';

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function character(id: string, props: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['red'], level: 7, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...props,
  };
}

function resetRuntime(...defs: CardDef[]): void {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  globals.__humanPlayerSide = 'self';
  defs.forEach(registerCardDef);
  registerTriggeredListener();
}

function mainState(): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return state;
}

function pr306Contact(actor: CardDef): { state: GameState; action: ActionContext; uid: string } {
  const state = mainState();
  state.players.self.partner.cardId = 'PR306_QA_PARTNER';
  const attacker = mutate.scene.enter(state, 'self', actor.id, { active: true });
  const defender = mutate.scene.enter(state, 'opp', 'PR306_QA_DEFENDER', { active: true });
  state.players.self.hand = [PR306.id];
  state.players.self.deck = ['PR306_QA_DRAW'];
  return {
    state,
    action: {
      id: 'pr306-contact', byUid: attacker.uid, byPlayer: 'self', target: { kind: 'char', uid: defender.uid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 5, nano: 0 }, contactImmune: false,
    } as ActionContext,
    uid: attacker.uid,
  };
}

function pr320NamedNames(): string[] {
  const effect = PR320.abilities.find(ability => ability.id === 'a2')?.effect as {
    steps?: Array<{ args?: { filter?: { cardName?: string[] } } }>;
  } | undefined;
  const names = effect?.steps?.[0]?.args?.filter?.cardName;
  if (!names?.length) throw new Error('PR320 a2 named-character filter missing');
  return names;
}

describe('PR306 / PR308 / PR320 official Q&A runtime certification', () => {
  it('PR306 cut-in gives AP+1000 to a non-police contact actor without drawing, then draws for police', () => {
    const policeTrait = PR306.traits[0]!;
    const police = character('PR306_QA_POLICE', { traits: [policeTrait] });
    const nonPolice = character('PR306_QA_NON_POLICE');
    const defender = character('PR306_QA_DEFENDER');
    const draw = character('PR306_QA_DRAW');
    const partner = character('PR306_QA_PARTNER', { kind: 'partner', colors: [...PR306.colors] });
    resetRuntime(PR306, police, nonPolice, defender, draw, partner);

    const nonPoliceContact = pr306Contact(nonPolice);
    cutIn(nonPoliceContact.state, nonPoliceContact.action, 'self', PR306.id);
    runAllUntilEmpty(nonPoliceContact.state);
    expect(nonPoliceContact.state.players.self.scene.find(card => card.uid === nonPoliceContact.uid)?.turnEffects.apMod_contact).toBe(1000);
    expect(nonPoliceContact.state.players.self.hand).toEqual([]);

    const policeContact = pr306Contact(police);
    cutIn(policeContact.state, policeContact.action, 'self', PR306.id);
    runAllUntilEmpty(policeContact.state);
    expect(policeContact.state.players.self.scene.find(card => card.uid === policeContact.uid)?.turnEffects.apMod_contact).toBe(1000);
    expect(policeContact.state.players.self.hand).toEqual(['PR306_QA_DRAW']);
  });

  it('PR308 refuses fewer than three deck cards at the public declared boundary', () => {
    runCardScenario(PR308, [], {
      name: 'PR308 exact three-card deck cost',
      setup: { partnerColors: [...PR308.colors], selfScene: [{ cardId: PR308.id, uid: 'pr308' }], deckSize: 2 },
      drive: { kind: 'cost-gate', uid: 'pr308', abilityId: 'a1', expectCanPay: false },
      expect: [],
    });
  });

  it('PR308 removes only its own top three cards and level-down remains independent of the FBI threshold', () => {
    const fbiTrait = PR308.traits[0]!;
    const ownTop = character('PR308_QA_SELF_TOP');
    const ownMiddle = character('PR308_QA_SELF_MIDDLE');
    const ownBottom = character('PR308_QA_SELF_BOTTOM');
    const oppTop = character('PR308_QA_OPP_TOP', { traits: [fbiTrait] });
    const levelSeven = character('PR308_QA_LEVEL_SEVEN', { level: 7 });
    const state = runCardScenario(PR308, [ownTop, ownMiddle, ownBottom, oppTop, levelSeven], {
      name: 'PR308 self deck payment and threshold-independent level-down',
      setup: {
        partnerColors: [...PR308.colors],
        selfScene: [{ cardId: PR308.id, uid: 'pr308' }],
        oppScene: [{ cardId: levelSeven.id, uid: 'level-target' }],
        deckTop: [ownTop.id, ownMiddle.id, ownBottom.id],
        oppDeckTop: [oppTop.id, oppTop.id, oppTop.id],
      },
      drive: { kind: 'declared', uid: 'pr308', abilityId: 'a1' },
      script: [{ pickUid: 'level-target' }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: ownTop.id, present: true },
        { kind: 'zone', side: 'opp', zone: 'deck', cardId: oppTop.id, present: true },
      ],
    });
    expect(state.players.self.remove).toEqual(expect.arrayContaining([ownTop.id, ownMiddle.id, ownBottom.id]));
    expect(state.players.opp.deck.slice(0, 3)).toEqual([oppTop.id, oppTop.id, oppTop.id]);
    expect(char.level(state, 'level-target')).toBe(6);
  });

  it('PR320 resolves mandatory hand removal, exact own evidence cost, 0/1 top-two choice, and refresh after remainder removal', () => {
    const namedNames = pr320NamedNames();
    const named = character('PR320_QA_NAMED', { names: [namedNames[0]!] });
    const discard = character('PR320_QA_DISCARD');
    const evidence = character('PR320_QA_EVIDENCE');
    resetRuntime(PR320, named, discard, evidence);

    const resolving = mainState();
    resolving.players.self.case = { ...resolving.players.self.case, cardId: PR320.id };
    resolving.players.self.hand = [discard.id];
    mutate.case.toResolved(resolving, 'self');
    runAllUntilEmpty(resolving);
    const discardPick = _drainPendingEffectPickSide();
    expect(discardPick?.candidates.map(candidate => candidate.cardId)).toEqual([discard.id]);
    applyPickAndContinuation(resolving, discardPick!, discardPick!.candidates[0]!.uid);
    expect(resolving.players.self.remove).toContain(discard.id);

    const state = mainState();
    state.players.self.case = { ...state.players.self.case, cardId: PR320.id };
    state.players.self.deck = [named.id];
    mutate.case.toResolved(state, 'self');
    runAllUntilEmpty(state);
    mutate.scene.enter(state, 'self', named.id, { active: true });
    state.players.self.evidence = [0, 1, 2].map(index => ({ cardId: `${evidence.id}_${index}`, faceUp: false, origin: { turn: 1, via: 'effect' as const } }));
    state.players.self.remove = [discard.id];
    activateDeclaredAbility(state, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [2, 0] } });
    runAllUntilEmpty(state);
    const pick = _drainPendingEffectPickSide();
    expect(state.players.self.evidence.map(entry => entry.faceUp)).toEqual([true, false, true]);
    expect(pick?.atomVerb).toBe('deckRevealUntil');
    expect(pick?.nMin).toBe(0);
    expect(pick?.nMax).toBe(1);
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([named.id]);

    const chosen = produce(state, draft => {
      applyPickAndContinuation(draft, pick!, pick!.candidates[0]!.uid);
      runAllUntilEmpty(draft);
    });
    expect(chosen.players.self.hand).toEqual([named.id]);
    expect(chosen.refreshCount.self).toBe(1);

    const declined = produce(state, draft => {
      applyPickSkipAndContinuation(draft, pick!);
      runAllUntilEmpty(draft);
    });
    expect(declined.players.self.hand).toEqual([]);
    expect(declined.players.self.deck).toEqual(expect.arrayContaining([discard.id, named.id]));
    expect(declined.log.findIndex(entry => entry.action === 'effect:boundToRemove')).toBeLessThan(
      declined.log.findIndex(entry => entry.action === 'refresh'),
    );
    expect(declined.refreshCount.self).toBe(1);
  });

  it('PR320 resolves both accept and decline across its two-card deck window before one refresh', () => {
    const namedNames = pr320NamedNames();
    const named = character('PR320_QA_TWO_NAMED', { names: [namedNames[0]!] });
    const decoy = character('PR320_QA_TWO_DECOY');
    const discard = character('PR320_QA_TWO_DISCARD');
    const evidence = character('PR320_QA_TWO_EVIDENCE');
    resetRuntime(PR320, named, decoy, discard, evidence);

    const state = mainState();
    state.players.self.case = { ...state.players.self.case, cardId: PR320.id };
    state.players.self.deck = [named.id, decoy.id];
    mutate.case.toResolved(state, 'self');
    runAllUntilEmpty(state);
    mutate.scene.enter(state, 'self', named.id, { active: true });
    state.players.self.evidence = [0, 1].map(index => ({ cardId: `${evidence.id}_${index}`, faceUp: false, origin: { turn: 1, via: 'effect' as const } }));
    state.players.self.remove = [discard.id];
    activateDeclaredAbility(state, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1] } });
    runAllUntilEmpty(state);
    const pick = _drainPendingEffectPickSide();

    const accepted = produce(state, draft => {
      applyPickAndContinuation(draft, pick!, pick!.candidates[0]!.uid);
      runAllUntilEmpty(draft);
    });
    expect(accepted.players.self.hand).toEqual([named.id]);
    const acceptedBoundToRemove = accepted.log.findIndex(entry => entry.action === 'effect:boundToRemove' && entry.result === '1');
    const acceptedRefresh = accepted.log.findIndex(entry => entry.action === 'refresh');
    expect(acceptedBoundToRemove).toBeGreaterThan(-1);
    expect(acceptedBoundToRemove).toBeLessThan(acceptedRefresh);
    expect(accepted.refreshCount.self).toBe(1);

    const declined = produce(state, draft => {
      applyPickSkipAndContinuation(draft, pick!);
      runAllUntilEmpty(draft);
    });
    expect(declined.players.self.hand).toEqual([]);
    const declinedBoundToRemove = declined.log.findIndex(entry => entry.action === 'effect:boundToRemove' && entry.result === '2');
    const declinedRefresh = declined.log.findIndex(entry => entry.action === 'refresh');
    expect(declinedBoundToRemove).toBeGreaterThan(-1);
    expect(declinedBoundToRemove).toBeLessThan(declinedRefresh);
    expect(declined.refreshCount.self).toBe(1);
  });
});
