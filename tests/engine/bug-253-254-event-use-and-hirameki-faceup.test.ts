// rules: 06-card-types.md, 10-action-event.md, 15-abilities-effects.md
// BUG-253: printed event use conditions are authorization gates.
// BUG-254: action-removal Hirameki works for both face-up and face-down evidence.

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createMainGameState as createEmptyGameState } from '../helpers/main-game-state';
import { startCausalSession } from '@/engine/log/causal';
import { event } from '@/engine/event';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { canHandUseCard, eventUseAllowed, handUseCard } from '@/engine/flow/main/hand-use-card';
import { nextHintEventUseAllowed, runNextHint } from '@/engine/flow/main/next-hint';
import { removeOpponentEvidenceTop } from '@/engine/flow/action-case';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetRegistry, register } from '@/engine/read/def';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { useGameStateStore } from '@/ui/state/store';
import type { AbilityDef, ActionContext, CardDef, Condition, EffectCtx } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';
import { B02032 } from '@/cards/ct-p02/B02032';
import { B03134 } from '@/cards/ct-p03/B03134';
import { B04027 } from '@/cards/ct-p04/B04027';
import { B04027P } from '@/cards/ct-p04/B04027P';
import { B04064 } from '@/cards/ct-p04/B04064';
import { B04028 } from '@/cards/ct-p04/B04028';
import { B05081 } from '@/cards/ct-p05/B05081';
import { B07056 } from '@/cards/ct-p07/B07056';
import { B07056P } from '@/cards/ct-p07/B07056P';
import { B07015 } from '@/cards/ct-p07/B07015';
import { B05042 } from '@/cards/ct-p05/B05042';
import { B03028 } from '@/cards/ct-p03/B03028';
import { B08020 } from '@/cards/ct-p08/B08020';
import { B09034 } from '@/cards/ct-p09/B09034';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

const eventUseTrigger = {
  hook: 'effect:declared' as const,
  selfOnly: true,
  matcher: (payload: unknown) => (payload as { kind?: string } | undefined)?.kind === 'event-use',
};

const effectConditionalEvent: CardDef = {
  id: 'EVENT_EFFECT_CONDITION', no: 'TEST/EVENT_EFFECT_CONDITION', kind: 'event', names: ['effect condition'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-hand', trigger: eventUseTrigger,
    condition: { kind: 'fileAtLeast', n: 1 },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [],
  } as AbilityDef],
};

const authorizationEvent = {
  id: 'EVENT_USE_CONDITION', no: 'TEST/EVENT_USE_CONDITION', kind: 'event' as const, names: ['use condition'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  useCondition: { kind: 'fileAtLeast', n: 1 } as Condition,
  abilities: [{
    id: 'a1', type: 'triggered' as const, scope: 'on-hand' as const, trigger: eventUseTrigger,
    effect: { kind: 'atom' as const, verb: 'draw' as const, args: { player: 'self', n: 1 } }, description: '', ruleRefs: [],
  }],
} as CardDef & { useCondition: Condition };

const greenPartner: CardDef = {
  id: 'PARTNER_GREEN', no: 'TEST/PARTNER_GREEN', kind: 'character', names: ['partner'], colors: ['緑'], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};

const b02032Parts = (B02032.useCondition as unknown as {
  cs: Array<{ kind: string; cardName?: string; status?: string }>;
}).cs;
const b02032BondName = b02032Parts.find(c => c.kind === 'bond')!.cardName!;
const b02032ResolvedStatus = b02032Parts.find(c => c.kind === 'caseStatus')!.status!;
const b07056TargetName = (B07056.useCondition as unknown as {
  query: { filter: { cardName: string } };
}).query.filter.cardName;

const bondProbe: CardDef = {
  id: 'BOND_PROBE', no: 'TEST/BOND_PROBE', kind: 'character', names: [b02032BondName], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};
const sleepProbe: CardDef = {
  id: 'SLEEP_PROBE', no: 'TEST/SLEEP_PROBE', kind: 'character', names: [b07056TargetName], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};

const actionProbe: CardDef = {
  id: 'ACTION-PROBE', no: 'TEST/ACTION-PROBE', kind: 'character', names: ['action probe'], colors: [], level: 1,
  traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
};

function hirameki(id: string, optional: boolean): CardDef {
  return {
    id, no: `TEST/${id}`, kind: 'event', names: [id], colors: [], level: 1, traits: [], rarity: 'C', imageUrl: '', ruleRefs: [],
    abilities: [{
      id: 'a1', type: 'triggered', scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional },
      effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '', ruleRefs: [],
    } as AbilityDef],
  };
}

function effectCtx(): EffectCtx {
  return { source: { player: 'self', area: 'scene', cardId: 'SOURCE', abilityId: 'a1' }, bindings: {} };
}

describe('BUG-253 event use condition authorization', () => {
  beforeEach(() => {
    event._resetRegistry();
    _clearPendingEffectPickQueue();
    _resetRegistry();
    _resetTriggeredRegistered();
    register(effectConditionalEvent);
    register(authorizationEvent);
    register(B02032);
    register(B03134);
    register(B04027);
    register(B04027P);
    register(B04064);
    register(B05081);
    register(B07056);
    register(B07056P);
    register(B07015);
    register(B05042);
    register(greenPartner);
    register(bondProbe);
    register(sleepProbe);
    registerTriggeredListener();
  });

  it('normal hand use rejects before flag, emit, hand removal, or remove move', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['EVENT_USE_CONDITION'];
    let declared = 0;
    event.on('effect:declared', () => { declared++; });

    expect(canHandUseCard(state, 'self', 'EVENT_USE_CONDITION')).toBe(false);
    expect(() => produce(state, draft => handUseCard(draft, 'self', 'EVENT_USE_CONDITION'))).toThrow(/not allowed/);
    expect(state.players.self.hand).toEqual(['EVENT_USE_CONDITION']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.turnState.self.handUseUsed).toBe(false);
    expect(declared).toBe(0);
    expect(state.log).toEqual([]);
  });

  it('effect use rejects the same invalid event atomically, then permits it when the condition becomes true', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['EVENT_USE_CONDITION'];
    let declared = 0;
    event.on('effect:declared', () => { declared++; });

    const rejectedCtx = effectCtx();
    runAtom(state, 'useEventFromHand', { player: 'self', target: ['EVENT_USE_CONDITION'] }, rejectedCtx);
    expect(state.players.self.hand).toEqual(['EVENT_USE_CONDITION']);
    expect(state.players.self.remove).toEqual([]);
    expect(declared).toBe(0);
    expect(rejectedCtx.dyn).toBeUndefined();
    expect(state.log).toEqual([]);

    state.players.self.file.push({ type: 'card-back' });
    runAtom(state, 'useEventFromHand', { player: 'self', target: ['EVENT_USE_CONDITION'] }, effectCtx());
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual(['EVENT_USE_CONDITION']);
    expect(declared).toBe(1);
  });

  it('rejects a stale multi-pick atomically when any selected occurrence left hand', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['EVENT_USE_CONDITION'];
    state.players.self.file = [{ type: 'card-back' }];
    let declared = 0;
    event.on('effect:declared', () => { declared++; });

    const ctx = effectCtx();
    runAtom(state, 'useEventFromHand', {
      player: 'self',
      // The duplicate models a stale multi-select whose second occurrence
      // disappeared before the commit path re-ran.
      target: ['EVENT_USE_CONDITION', 'EVENT_USE_CONDITION'],
    }, ctx);

    expect(state.players.self.hand).toEqual(['EVENT_USE_CONDITION']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.log).toEqual([]);
    expect(declared).toBe(0);
    expect(ctx.dyn).toBeUndefined();
  });

  it('rejects authorization that became false after candidate selection without any observable residue', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['EVENT_USE_CONDITION'];
    state.players.self.file = [{ type: 'card-back' }];
    const ctx = effectCtx();
    let declared = 0;
    event.on('effect:declared', () => { declared++; });
    const selected = resolveEffectPicks(state, {
      kind: 'atom',
      verb: 'useEventFromHand',
      args: {
        player: 'self',
        target: {
          kind: 'pick',
          query: { area: 'hand', side: 'self', filter: { cardId: 'EVENT_USE_CONDITION' } },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      },
    } as never, ctx, { byPlayer: 'self', humanChooser: false });

    // Candidate was legal above; invalidate only its useCondition before the
    // selected atom reaches the commit handler.
    const beforeDyn = structuredClone(ctx.dyn);
    state.players.self.file.pop();
    const beforeCommit = structuredClone(state);
    runEffect(state, selected, ctx);

    expect(state).toEqual(beforeCommit);
    expect(ctx.dyn).toEqual(beforeDyn);
    expect(declared).toBe(0);
  });

  it('keeps an explicit zero-card effect selection as the intentional chain gate', () => {
    const state = createEmptyGameState();
    const ctx = effectCtx();
    runAtom(state, 'useEventFromHand', { player: 'self', target: [] }, ctx);
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
    expect(state.log).toEqual([]);
  });

  it('B07015 effect pick excludes an unauthorized event before AI chooses and resolves the valid event', () => {
    const state = createEmptyGameState();
    // B02032 needs its printed 解決編 + 服部平次 authorization. B05042
    // satisfies B07015's level/color/kind filter without that gate.
    state.players.self.hand = ['B02032', 'B05042'];
    const ability = B07015.abilities[0]!;
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'B07015', abilityId: 'a1' },
      bindings: {},
    };

    const selected = resolveEffectPicks(state, ability.effect!, ctx, {
      byPlayer: 'self',
      humanChooser: false,
    });
    runEffect(state, selected, ctx);

    expect(state.players.self.hand).toEqual(['B02032']);
    expect(state.players.self.remove).toEqual(['B05042']);
    expect(ctx.dyn?.chainStepNoApply).not.toBe(true);
  });

  it('B07015 exposes the same authorized-only event set to a human picker', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B02032', 'B05042'];
    const ability = B07015.abilities[0]!;
    const ctx: EffectCtx = {
      source: { player: 'self', area: 'scene', cardId: 'B07015', abilityId: 'a1' },
      bindings: {},
    };

    const selected = resolveEffectPicks(state, ability.effect!, ctx, {
      byPlayer: 'self',
      humanChooser: true,
      humanPlayer: 'self',
      source: { cardId: 'B07015', abilityId: 'a1' },
    });
    runEffect(state, selected, ctx);

    expect(_drainPendingEffectPickSide()?.candidates.map(c => c.cardId)).toEqual(['B05042']);
  });

  it('keeps an icon/effect condition separate from printed authorization', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['EVENT_EFFECT_CONDITION'];
    state.players.self.file = [{ type: 'card-back' }];

    expect(canHandUseCard(state, 'self', 'EVENT_EFFECT_CONDITION')).toBe(true);
  });

  it('B04027 only authorizes on FILE count; icon conditions remain effect conditions', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B04027'];
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const }));

    expect(canHandUseCard(state, 'self', 'B04027')).toBe(false);
    state.players.self.file.pop();
    expect(canHandUseCard(state, 'self', 'B04027')).toBe(true);
  });

  it('projects the Next Hint FILE pop before evaluating an event use condition', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B04027'];
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const }));

    expect(nextHintEventUseAllowed(state, 'self', 'B04027')).toBe(true);
  });

  it('rejects invalid Next Hint event use atomically before FILE pop or emit', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B04027'];
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: 'DUMMY' }));
    let filePopEvents = 0;
    event.on('file:pop', () => { filePopEvents++; });

    const after = produce(state, draft => {
      expect(() => runNextHint(draft, 'self', 'B04027')).toThrow(/event-use condition/);
    });
    expect(after.players.self.file).toHaveLength(7);
    expect(after.players.self.hand).toEqual(['B04027']);
    expect(after.players.self.remove).toEqual([]);
    expect(after.turnState.self.nextHintUsed).toBe(false);
    expect(after.log).toEqual([]);
    expect(filePopEvents).toBe(0);
  });

  it('commits a valid Next Hint event only after the projected condition passes', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B04027'];
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'DUMMY' }));
    let filePopEvents = 0;
    event.on('file:pop', () => { filePopEvents++; });

    const after = produce(state, draft => {
      runNextHint(draft, 'self', 'B04027');
    });
    expect(after.players.self.file).toHaveLength(5);
    expect(after.players.self.hand).toEqual(['DUMMY']);
    expect(after.players.self.remove).toEqual(['B04027']);
    expect(after.turnState.self.nextHintUsed).toBe(true);
    expect(filePopEvents).toBe(1);
  });

  it('allows Next Hint to use the event just moved from FILE', () => {
    const state = createEmptyGameState();
    state.players.self.case.colors = B04027.colors;
    state.players.self.file = [
      ...Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'DUMMY' })),
      { type: 'card-back' as const, cardId: 'B04027' },
    ];

    const after = produce(state, draft => {
      runNextHint(draft, 'self', 'B04027');
    });
    expect(after.players.self.file).toHaveLength(5);
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.remove).toEqual(['B04027']);
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('dispatcher leaves FILE, hooks, and log unchanged when Next Hint preflight rejects', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['B04027'];
    state.players.self.case.colors = B04027.colors;
    state.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: 'DUMMY' }));
    useGameStateStore.setState({ gameState: state });
    let filePopEvents = 0;
    let declaredEvents = 0;
    event.on('file:pop', () => { filePopEvents++; });
    event.on('effect:declared', () => { declaredEvents++; });

    expect(dispatchEngineAction({ type: 'nextHint', player: 'self', optionalCardId: 'B04027' }).ok).toBe(false);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.file).toHaveLength(7);
    expect(after.players.self.hand).toEqual(['B04027']);
    expect(after.players.self.remove).toEqual([]);
    expect(after.turnState.self.nextHintUsed).toBe(false);
    expect(after.log).toEqual([]);
    expect(filePopEvents).toBe(0);
    expect(declaredEvents).toBe(0);
  });

  it('catalogues only TSV-backed "this event may be used" clauses as useCondition, including parallels', () => {
    for (const card of [B02032, B03134, B04027, B04064, B05081, B07056]) {
      expect(card.useCondition, card.id).toBeDefined();
    }
    expect(B04027P.useCondition).toEqual(B04027.useCondition);
    expect(B07056P.useCondition).toEqual(B07056.useCondition);
    expect(effectConditionalEvent.useCondition).toBeUndefined();
  });

  it('uses the same real-card authorization boundary for normal and effect use', () => {
    const prepare = (card: CardDef) => {
      const state = createEmptyGameState();
      state.players.self.hand = [card.id];
      state.players.self.case.colors = card.colors;
      state.players.self.file = Array.from({ length: Math.max(card.level ?? 0, 6) }, () => ({ type: 'card-back' as const }));
      return state;
    };
    const expectParity = (state: ReturnType<typeof createEmptyGameState>, card: CardDef, allowed: boolean) => {
      expect(eventUseAllowed(state, 'self', card.id), `${card.id}: reader`).toBe(allowed);
      expect(canHandUseCard(state, 'self', card.id), `${card.id}: normal`).toBe(allowed);
      const effectState = structuredClone(state);
      const ctx = effectCtx();
      runAtom(effectState, 'useEventFromHand', { player: 'self', target: [card.id] }, ctx);
      expect(effectState.players.self.remove.includes(card.id), `${card.id}: effect`).toBe(allowed);
      expect(ctx.dyn, `${card.id}: stale authorization leaves dyn untouched`).toBeUndefined();
    };

    // B02032: partner alone never satisfies the scene-only bond; resolving
    // the case plus the named character on scene does.
    const b02032PartnerOnly = prepare(B02032);
    b02032PartnerOnly.players.self.case.status = b02032ResolvedStatus as typeof b02032PartnerOnly.players.self.case.status;
    b02032PartnerOnly.players.self.partner.cardId = 'BOND_PROBE';
    expectParity(b02032PartnerOnly, B02032, false);
    b02032PartnerOnly.players.self.scene.push({ cardId: 'BOND_PROBE', uid: 'bond', state: 'active' } as never);
    expectParity(b02032PartnerOnly, B02032, true);

    // B03134: opponent evidence >= self is allowed; self leading is not.
    const b03134Equal = prepare(B03134);
    expectParity(b03134Equal, B03134, true);
    const b03134SelfAhead = prepare(B03134);
    b03134SelfAhead.players.self.evidence.push({ cardId: 'E', faceUp: false, origin: { turn: 0, via: 'opening' } });
    expectParity(b03134SelfAhead, B03134, false);
    const b03134OppAhead = prepare(B03134);
    b03134OppAhead.players.opp.evidence.push({ cardId: 'E', faceUp: false, origin: { turn: 0, via: 'opening' } });
    expectParity(b03134OppAhead, B03134, true);

    const b04064File5 = prepare(B04064);
    b04064File5.players.self.file = [
      ...Array.from({ length: 4 }, () => ({ type: 'card-back' as const })),
      { type: 'assisted-partner' as const, cardId: 'PARTNER_GREEN' },
    ];
    expectParity(b04064File5, B04064, true);
    b04064File5.players.self.file.push({ type: 'card-back' });
    expectParity(b04064File5, B04064, false);

    const b05081Fewer = prepare(B05081);
    b05081Fewer.players.opp.scene.push({ cardId: 'SLEEP_PROBE', uid: 'opp', state: 'active' } as never);
    expectParity(b05081Fewer, B05081, true);
    const b05081Equal = prepare(B05081);
    b05081Equal.players.self.scene.push({ cardId: 'SLEEP_PROBE', uid: 'self', state: 'active' } as never);
    b05081Equal.players.opp.scene.push({ cardId: 'SLEEP_PROBE', uid: 'opp', state: 'active' } as never);
    expectParity(b05081Equal, B05081, false);

    for (const card of [B07056, B07056P]) {
      for (const stateName of ['active', 'sleep', 'stun'] as const) {
        const state = prepare(card);
        state.players.self.scene.push({ cardId: 'SLEEP_PROBE', uid: stateName, state: stateName } as never);
        expectParity(state, card, stateName === 'sleep');
      }
      const oppSleep = prepare(card);
      oppSleep.players.opp.scene.push({ cardId: 'SLEEP_PROBE', uid: 'opp-sleep', state: 'sleep' } as never);
      expectParity(oppSleep, card, false);
    }
  });
});

describe('BUG-254 action-case Hirameki visibility', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetRegistry();
    _resetTriggeredRegistered();
    _resetPendingHirameki();
    register(B04028);
    register(B03028);
    register(B08020);
    register(B09034);
    register(actionProbe);
    register({ id: 'NO_HIRAMEKI', no: 'TEST/NO_HIRAMEKI', kind: 'event', names: ['none'], colors: [], level: 1, traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [] });
    registerTriggeredListener();
    useGameStateStore.setState({ gameState: null, pendingHirameki: null });
  });

  function actionContext(): ActionContext {
    return {
      id: 'action', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'case', player: 'self' },
      phase: 'judge', startedAt: { turn: 0, nano: 0 },
    };
  }

  function driveUnguardedCaseAction(state: ReturnType<typeof createEmptyGameState>): string {
    state.turn = { number: 1, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.scene = [sceneChar(actionProbe.id, 'attacker')];
    state.players.opp.deck = ['ACTION-GAIN'];
    state.players.self.case.cardId = 'CASE-PROBE';
    const sessionId = `bug-254-${state.players.self.evidence[0]?.cardId ?? 'none'}`;
    startCausalSession(state, sessionId);
    resetPresentationQueue(sessionId);
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);

    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: 'self' })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).toBeTruthy();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }).ok).toBe(true);
    expect(dispatchEngineAction({ type: 'actionJudge', actionId: actionId! }).ok).toBe(true);
    return actionId!;
  }

  it.each([true, false])('both face states open the optional Hirameki from the real action path (%s)', (faceUp) => {
    const state = createEmptyGameState();
    state.players.self.evidence = [{ cardId: 'B04028', faceUp, origin: { turn: 0, via: 'opening' } }];
    state.players.self.deck = ['DRAWN'];
    driveUnguardedCaseAction(state);

    const pending = useGameStateStore.getState().pendingHirameki;
    expect(pending).toMatchObject({ player: 'self', cardId: 'B04028', abilityId: 'a2' });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
    expect(useGameStateStore.getState().gameState!.players.self.evidence).toEqual([
      expect.objectContaining({ cardId: 'DRAWN', faceUp: false }),
    ]);
  });

  it('skip and suppression do not resolve, while a card without Hirameki makes no prompt', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [{ cardId: 'B04028', faceUp: false, origin: { turn: 0, via: 'opening' } }];
    state.players.self.deck = ['SKIPPED'];
    driveUnguardedCaseAction(state);
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' }).ok).toBe(true);
    expect(useGameStateStore.getState().gameState!.players.self.deck).toEqual(['SKIPPED']);

    const suppressed = createEmptyGameState();
    suppressed.players.self.evidence = [{ cardId: 'B04028', faceUp: true, origin: { turn: 0, via: 'opening' } }];
    suppressed.turnState.self.hiramekiSuppressed = true;
    produce(suppressed, draft => {
      removeOpponentEvidenceTop(draft, actionContext());
    });
    expect(_drainPendingHirameki()).toBeNull();

    const none = createEmptyGameState();
    none.players.self.evidence = [{ cardId: 'NO_HIRAMEKI', faceUp: false, origin: { turn: 0, via: 'opening' } }];
    produce(none, draft => {
      removeOpponentEvidenceTop(draft, actionContext());
    });
    expect(_drainPendingHirameki()).toBeNull();
  });

  it('a banned green Hirameki remains available and is not an event-use trigger for B03028 or B08020', () => {
    const state = createEmptyGameState();
    state.players.self.evidence = [{ cardId: B09034.id, faceUp: false, origin: { turn: 0, via: 'opening' } }];
    state.players.self.scene = [sceneChar(B03028.id, 'heiji'), sceneChar(B08020.id, 'kazuha')];
    state.players.self.remove = ['NO_HIRAMEKI'];
    state.turnState.self.eventUseBanned = true;
    driveUnguardedCaseAction(state);

    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      player: 'self', cardId: B09034.id, abilityId: 'a2',
    });
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand).toContain('NO_HIRAMEKI');
    for (const observerId of [B03028.id, B08020.id]) {
      expect(after.pendingEffects.some((entry) => entry.source.cardId === observerId), observerId).toBe(false);
    }
  });
});

describe('B07056 event-use resolution', () => {
  it('selects only a level-8-or-lower Kaito or Aoko and turns stun into sleep', async () => {
    const [{ runAllUntilEmpty }, { applyPickAndContinuation }] = await Promise.all([
      import('@/engine/resolve'),
      import('@/engine/effect/apply-pick'),
    ]);
    const target: CardDef = {
      id: 'B07056_TARGET', no: 'TEST/B07056_TARGET', kind: 'character', names: ['黒羽快斗'], colors: ['白'], level: 8,
      traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
    };
    const wrongName: CardDef = {
      id: 'B07056_WRONG_NAME', no: 'TEST/B07056_WRONG_NAME', kind: 'character', names: ['怪盗キッド'], colors: ['白'], level: 8,
      traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
    };
    const tooHigh: CardDef = {
      id: 'B07056_TOO_HIGH', no: 'TEST/B07056_TOO_HIGH', kind: 'character', names: ['中森青子'], colors: ['白'], level: 9,
      traits: [], rarity: 'C', imageUrl: '', ruleRefs: [], abilities: [],
    };

    event._resetRegistry();
    _clearPendingEffectPickQueue();
    _resetRegistry();
    _resetTriggeredRegistered();
    for (const card of [B07056, sleepProbe, target, wrongName, tooHigh]) register(card);
    registerTriggeredListener();

    const state = createEmptyGameState();
    state.players.self.hand = ['B07056'];
    state.players.self.case.colors = ['白'];
    state.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const }));
    state.players.self.scene = [
      { ...sceneChar('SLEEP_PROBE', 'witness'), state: 'sleep' },
      { ...sceneChar(target.id, 'target'), state: 'stun' },
      { ...sceneChar(wrongName.id, 'wrong-name'), state: 'stun' },
      { ...sceneChar(tooHigh.id, 'too-high'), state: 'stun' },
    ];
    const runtime = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
    const previousHuman = runtime.__humanPlayerSide;
    runtime.__humanPlayerSide = 'self';

    try {
      handUseCard(state, 'self', 'B07056');
      runAllUntilEmpty(state);
      const pending = _drainPendingEffectPickSide();
      expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['target']);
      applyPickAndContinuation(state, pending!, 'target');
      runAllUntilEmpty(state);

      expect({
        eventRemoved: state.players.self.remove.includes('B07056'),
        target: state.players.self.scene.find(card => card.uid === 'target')?.state,
        witness: state.players.self.scene.find(card => card.uid === 'witness')?.state,
        wrongName: state.players.self.scene.find(card => card.uid === 'wrong-name')?.state,
        tooHigh: state.players.self.scene.find(card => card.uid === 'too-high')?.state,
      }).toEqual({ eventRemoved: true, target: 'sleep', witness: 'sleep', wrongName: 'stun', tooHigh: 'stun' });
    } finally {
      runtime.__humanPlayerSide = previousHuman;
    }
  });
});
