import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { PR307 } from '@/cards/pr-01/PR307';
import { PR308 } from '@/cards/pr-01/PR308';
import { PR309 } from '@/cards/pr-01/PR309';
import { PR310 } from '@/cards/pr-01/PR310';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { resetPendingAtomSession } from '@/engine/effect/atom-handlers';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { runCardScenario } from '../helpers/card-probe-harness';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../helpers/open-case-hirameki';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import type { CardDef, GameState } from '@/engine/types';

const character = (id: string, props: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level: 7, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...props,
});

const BLACK_PARTNER = character('PR310_BLACK_PARTNER', { kind: 'partner', colors: ['黒'] });
const NON_BLACK_PARTNER = character('PR310_NON_BLACK_PARTNER', { kind: 'partner', colors: ['青'] });

function resetRuntime(...defs: CardDef[]): void {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  resetPendingAtomSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  for (const def of defs) registerCardDef(def);
  registerTriggeredListener();
  registerHiramekiListener();
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null, pendingHirameki: null });
}

function runtimeState(turn: 'self' | 'opp'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

describe('PR307-PR310 public runtime paths', () => {
  it('PR307: optional compound effect removes one hand card before sleep/draw/contact', () => {
    const sleeper = character('PR307_SLEEPER');
    const target = character('PR307_TARGET');
    const discard = character('PR307_DISCARD');
    const s = runCardScenario(PR307, [sleeper, target, discard], {
      name: 'PR307 self sleep and contact public path',
      setup: { caseColors: ['青', '黒'], partnerColors: ['青'], hand: [discard.id], selfScene: [{ cardId: 'PR307', uid: 'hai' }, { cardId: sleeper.id, uid: 'sleep-me' }], oppScene: [{ cardId: target.id, uid: 'opp-target' }], deckSize: 2 },
      drive: { kind: 'enter', cardId: 'PR307', uid: 'hai' },
      script: ['optional:take', { pickCardId: discard.id }, { pickUid: 'sleep-me' }, { pickUid: 'opp-target' }],
      expect: [{ kind: 'state', uid: 'sleep-me', state: 'sleep' }, { kind: 'zone', side: 'self', zone: 'hand', cardId: discard.id, present: false }, { kind: 'handDelta', side: 'self', n: 0 }],
    });
    expect(s.players.opp.scene.find(c => c.uid === 'opp-target')?.state, 'PR307 contact target remains active before contact hooks resolve').toBe('active');
    const contactLog = s.log.find(x => x.action === 'effect:startContact');
    expect(contactLog, 'PR307 source starts public contact').toBeDefined();
    const contact = Object.values(s.actionContexts ?? {}).find(context => context.id === contactLog?.result);
    expect(contact, 'PR307 effect contact enters the canonical contact state machine').toMatchObject({
      byUid: 'hai',
      byPlayer: 'self',
      generatedByEffect: true,
      phase: 'action-1',
    });
    expect(contact?.guardUid, 'effect contact has no guard window').toBeUndefined();
    expect(s.players.self.scene.find(c => c.uid === 'hai')?.turnEffects.actedCharThisTurn, 'effect contact is not an action').toBeFalsy();
  });

  it('PR307: owner may decline the whole compound effect or sleep PR307 itself', () => {
    const discard = character('PR307_DISCARD_2');
    const target = character('PR307_TARGET_2');
    const declined = runCardScenario(PR307, [discard, target], {
      name: 'PR307 whole optional decline',
      setup: { caseColors: ['青', '黒'], partnerColors: ['青'], hand: [discard.id], selfScene: [{ cardId: 'PR307', uid: 'hai' }], oppScene: [{ cardId: target.id, uid: 'opp-target' }], deckSize: 2 },
      drive: { kind: 'enter', cardId: 'PR307', uid: 'hai' },
      script: ['optional:decline'],
      expect: [{ kind: 'zone', side: 'self', zone: 'hand', cardId: discard.id, present: true }, { kind: 'state', uid: 'hai', state: 'active' }],
    });
    expect(declined.log.some(x => x.action === 'effect:startContact'), 'decline starts no contact').toBe(false);

    const accepted = runCardScenario(PR307, [discard, target], {
      name: 'PR307 sleeps itself',
      setup: { caseColors: ['青', '黒'], partnerColors: ['青'], hand: [discard.id], selfScene: [{ cardId: 'PR307', uid: 'hai' }], oppScene: [{ cardId: target.id, uid: 'opp-target' }], deckSize: 2 },
      drive: { kind: 'enter', cardId: 'PR307', uid: 'hai' },
      script: ['optional:take', { pickCardId: discard.id }, { pickUid: 'hai' }, { pickUid: 'opp-target' }],
      expect: [{ kind: 'state', uid: 'hai', state: 'sleep' }, { kind: 'zone', side: 'self', zone: 'hand', cardId: discard.id, present: false }],
    });
    expect(accepted.log.some(x => x.action === 'effect:startContact'), 'sleeping source still starts effect contact').toBe(true);
  });

  it('PR308: three FBI cost removals enable L7 removal before independent level-down', () => {
    const fbi1 = character('PR308_FBI_1', { traits: ['FBI'] });
    const fbi2 = character('PR308_FBI_2', { traits: ['FBI'] });
    const fbi3 = character('PR308_FBI_3', { traits: ['FBI'] });
    const own = character('PR308_OWN');
    const opp = character('PR308_OPP');
    const s = runCardScenario(PR308, [fbi1, fbi2, fbi3, own, opp], {
      name: 'PR308 FBI threshold public declared path',
      setup: { partnerColors: ['赤'], selfScene: [{ cardId: 'PR308', uid: 'jodie' }, { cardId: own.id, uid: 'remove-own' }], oppScene: [{ cardId: opp.id, uid: 'lower-opp' }], deckTop: [fbi1.id, fbi2.id, fbi3.id] },
      drive: { kind: 'declared', uid: 'jodie', abilityId: 'a1' }, script: [{ pickUid: 'remove-own' }, { pickUid: 'lower-opp' }],
      expect: [{ kind: 'zone', side: 'self', zone: 'remove', cardId: fbi1.id, present: true }, { kind: 'zone', side: 'self', zone: 'scene', cardId: own.id, present: false }],
    });
    const removeLog = s.log.findIndex(x => x.action === 'effect:sceneRemove');
    const levelLog = s.log.findIndex(x => x.action === 'effect:charModifyLevel');
    expect(removeLog, 'PR308 removes L7 before level-down').toBeLessThan(levelLog);
  });

  it('PR309: opponent-turn leave privately offers the top card as a 0/1 choice; declining keeps it in deck', () => {
    const top = character('PR309_TOP');
    resetRuntime(PR309, top);
    const before = runtimeState('opp');
    before.players.self.deck = [top.id];
    const source = mutate.scene.enter(before, 'self', PR309.id, {});

    const awaitingDecision = produce(before, draft => {
      mutate.scene.removeToRemove(draft, source.uid, 'effect');
      runAllUntilEmpty(draft);
    });
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'PR309 must surface its printed 0/1 choice to the owner').toMatchObject({
      atomVerb: 'deckRevealUntil', nMin: 0, nMax: 1,
      candidates: [{ cardId: top.id, player: 'self' }],
    });

    const declined = produce(awaitingDecision, draft => applyPickSkipAndContinuation(draft, pick!));
    expect(declined.players.self.deck).toEqual([top.id]);
    expect(declined.players.self.remove).toContain(PR309.id);
    expect(declined.players.self.remove).not.toContain(top.id);
    expect(declined.log.filter(entry => entry.action === 'effect:deckRevealUntil').at(-1)?.result, 'PR309 look is private to its owner').toBe('revealed=1 matched=declined visibility=private viewer=self');
    expect(declined.log.some(entry => entry.action === 'effect:boundToRemove'), 'declining does not move the looked-at card').toBe(false);
    expect(declined.log.some(entry => entry.action === 'refresh'), 'a look/decline does not refresh').toBe(false);
  });

  it('PR309: accepting the private top-card choice removes it, then refreshes only after the deck is empty', () => {
    const top = character('PR309_TOP');
    resetRuntime(PR309, top);
    const before = runtimeState('opp');
    before.players.self.deck = [top.id];
    const source = mutate.scene.enter(before, 'self', PR309.id, {});

    const awaitingDecision = produce(before, draft => {
      mutate.scene.removeToRemove(draft, source.uid, 'effect');
      runAllUntilEmpty(draft);
    });
    const pick = _drainPendingEffectPickSide();
    expect(pick?.candidates).toHaveLength(1);

    const accepted = produce(awaitingDecision, draft => applyPickAndContinuation(draft, pick!, pick!.candidates[0]!.uid));
    expect(accepted.log.filter(entry => entry.action === 'effect:deckRevealUntil').at(-1)?.result).toBe('revealed=1 matched=PR309_TOP visibility=private viewer=self');
    expect(accepted.log.find(entry => entry.action === 'effect:boundToRemove')?.result).toBe('1');
    expect(accepted.refreshCount.self, 'refresh happens after boundToRemove leaves the deck empty').toBe(1);
    expect(accepted.log.some(entry => entry.action === 'refresh')).toBe(true);
    expect(accepted.players.self.deck).toEqual(expect.arrayContaining([PR309.id, top.id]));
    expect(accepted.players.opp.evidence).toHaveLength(1);
  });

  it('PR309: action-removal Hirameki stuns the exact CASE actor without stopping the action', () => {
    const actor = character('PR309-ACTION-ACTOR');
    resetRuntime(PR309, actor);
    const before = runtimeState('opp');
    before.players.self.case.status = '解決編';
    before.players.opp.deck = [actor.id, actor.id, actor.id];
    const actionActor = mutate.scene.enter(before, 'opp', actor.id, {});

    const { actionId } = openCaseHirameki(before, PR309.id, {
      evidencePlayer: 'self',
      actorUid: actionActor.uid,
      humanPlayer: 'self',
      sessionLabel: 'PR309-action-actor',
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });

    const afterHirameki = useGameStateStore.getState().gameState!;
    expect(afterHirameki.players.opp.scene.find(card => card.uid === actionActor.uid)?.state,
      'PR309 stuns the character performing the CASE action').toBe('stun');
    expect(afterHirameki.players.opp.evidence, 'evidence gain stays deferred until action completion').toHaveLength(0);

    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    const completed = useGameStateStore.getState().gameState!;
    expect(completed.players.opp.evidence, 'stunning the actor does not cancel the in-progress CASE action').toHaveLength(1);
    expect(completed.players.opp.scene.find(card => card.uid === actionActor.uid)?.state).toBe('stun');
  });

  it('PR310: self effect removal with a black partner offers only sleeping L7-or-lower characters on either scene', () => {
    const eligibleSelf = character('PR310_SELF_SLEEP7');
    const eligibleOpp = character('PR310_OPP_SLEEP7');
    const awake = character('PR310_AWAKE7');
    const high = character('PR310_SLEEP8', { level: 8 });
    const actor = character('PR310_EFFECT_ACTOR');
    resetRuntime(PR310, BLACK_PARTNER, eligibleSelf, eligibleOpp, awake, high, actor);
    const before = runtimeState('self');
    before.players.self.partner.cardId = BLACK_PARTNER.id;
    const source = mutate.scene.enter(before, 'self', PR310.id, {});
    const own = mutate.scene.enter(before, 'self', eligibleSelf.id, {}); own.state = 'sleep';
    const effectActor = mutate.scene.enter(before, 'self', actor.id, {});
    const opp = mutate.scene.enter(before, 'opp', eligibleOpp.id, {}); opp.state = 'sleep';
    const awakeChar = mutate.scene.enter(before, 'opp', awake.id, {}); awakeChar.state = 'active';
    const highChar = mutate.scene.enter(before, 'opp', high.id, {}); highChar.state = 'sleep';

    const awaitingDecision = produce(before, draft => {
      mutate.scene.removeToRemove(draft, source.uid, 'effect', effectActor.uid, { byPlayer: 'self' });
      runAllUntilEmpty(draft);
    });
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'PR310 must use the real leave hook, then surface its remove choice').toMatchObject({ atomVerb: 'sceneRemove', nMin: 0, nMax: 1 });
    expect(pick?.candidates.map(candidate => candidate.uid).sort(), 'only sleeping level 7-or-lower characters are eligible').toEqual([own.uid, opp.uid].sort());

    const accepted = produce(awaitingDecision, draft => applyPickAndContinuation(draft, pick!, opp.uid));
    expect(accepted.players.opp.scene.some(char => char.uid === opp.uid), 'PR310 may select an eligible opponent-scene character').toBe(false);
    expect(accepted.players.opp.remove).toContain(eligibleOpp.id);
    expect(accepted.players.self.scene.some(char => char.uid === own.uid), 'the other eligible character remains when one is chosen').toBe(true);
    expect(accepted.players.opp.scene.some(char => char.uid === awakeChar.uid), 'awake characters are excluded').toBe(true);
    expect(accepted.players.opp.scene.some(char => char.uid === highChar.uid), 'level 8 characters are excluded').toBe(true);
  });

  it('PR310: switching this character out does not count as removal by an ability or effect', () => {
    const switchIn = character('PR310_SWITCH_IN');
    const target = character('PR310_SWITCH_TARGET');
    resetRuntime(PR310, BLACK_PARTNER, switchIn, target);
    const before = runtimeState('self');
    before.players.self.partner.cardId = BLACK_PARTNER.id;
    const source = mutate.scene.enter(before, 'self', PR310.id, {});
    const sleepingTarget = mutate.scene.enter(before, 'opp', target.id, {});
    sleepingTarget.state = 'sleep';

    const after = produce(before, draft => {
      mutate.scene.switchEnter(draft, 'self', switchIn.id, source.uid, {});
      runAllUntilEmpty(draft);
    });

    expect(_drainPendingEffectPickSide(), 'switch removal must not open PR310 choice').toBeNull();
    expect(after.players.opp.scene.some(char => char.uid === sleepingTarget.uid), 'switch leaves the eligible target untouched').toBe(true);
    expect(after.players.self.remove).toContain(PR310.id);
  });

  it.each([
    ['non-black partner', { partnerId: NON_BLACK_PARTNER.id, turn: 'self' as const, byPlayer: 'self' as const }],
    ['opponent turn', { partnerId: BLACK_PARTNER.id, turn: 'opp' as const, byPlayer: 'self' as const }],
    ['opponent effect', { partnerId: BLACK_PARTNER.id, turn: 'self' as const, byPlayer: 'opp' as const }],
  ])('PR310: %s does not create a removal choice', (_label, opts) => {
    const target = character('PR310_NEGATIVE_TARGET');
    const selfActor = character('PR310_SELF_ACTOR');
    const oppActor = character('PR310_OPP_ACTOR');
    resetRuntime(PR310, BLACK_PARTNER, NON_BLACK_PARTNER, target, selfActor, oppActor);
    const before = runtimeState(opts.turn);
    before.players.self.partner.cardId = opts.partnerId;
    const source = mutate.scene.enter(before, 'self', PR310.id, {});
    const victim = mutate.scene.enter(before, 'opp', target.id, {}); victim.state = 'sleep';
    const actor = mutate.scene.enter(before, opts.byPlayer, opts.byPlayer === 'self' ? selfActor.id : oppActor.id, {});

    const after = produce(before, draft => {
      mutate.scene.removeToRemove(draft, source.uid, 'effect', actor.uid, { byPlayer: opts.byPlayer });
      runAllUntilEmpty(draft);
    });
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(after.players.opp.scene.some(char => char.uid === victim.uid), 'failed PR310 condition leaves the sleeping target in scene').toBe(true);
    expect(after.log.some(entry => entry.action === 'effect:sceneRemove'), 'failed PR310 condition performs no follow-up removal').toBe(false);
  });
});
