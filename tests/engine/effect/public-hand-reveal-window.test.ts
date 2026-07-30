import { beforeEach, describe, expect, it } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainPendingPublicHandRevealSide, resetPendingAtomSession } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { pay } from '@/engine/cost/pay';
import type { Cost } from '@/engine/types';
import { B03111 } from '@/cards/ct-p03/B03111';
import { B06084 } from '@/cards/ct-p06/B06084';
import { B07100 } from '@/cards/ct-p07/B07100';
import { B01074 } from '@/cards/ct-p01/B01074';
import { D05004 } from '@/cards/ct-d05/D05004';
import { B08064 } from '@/cards/ct-p08/B08064';
import { B09002 } from '@/cards/ct-p09/B09002';
import { B10024 } from '@/cards/ct-p10/B10024';
import {
  _drainPendingEffectChoiceSide,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
  resolveEffectPicks,
} from '@/engine/effect/resolve-picks';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef } from '@/engine/types';
import {
  applyChoiceAndContinuation,
  applyOptionalAndContinuation,
  applyPickAndContinuation,
} from '@/engine/effect/apply-pick';
import { _drainPendingChooseInterceptSide, resetPendingEffectSession } from '@/engine/effect/pending-state';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';

describe('public hand reveal window', () => {
  beforeEach(() => {
    resetPendingAtomSession();
    resetPendingEffectSession();
    resetDefRegistry();
    useGameStateStore.setState({ gameState: null, pendingPublicHandReveal: null, pendingEffectPick: null });
  });

  it('queues an effect-lifetime opponent reveal with ordered duplicate identities', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['REVEALED', 'DECOY', 'REVEALED'];

    runEffect(state, {
      kind: 'atom',
      verb: 'handReveal',
      args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' },
    }, {
      source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1' },
      bindings: {},
    });

    expect(_drainPendingPublicHandRevealSide()).toMatchObject({
      owner: 'opp',
      audience: 'all',
      cardIds: ['REVEALED', 'DECOY', 'REVEALED'],
      lifetime: 'effect',
      source: { cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1' },
    });
  });

  it('preserves FIFO order across multiple public reveal effects', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['FIRST'];
    const reveal = (cardId: string) => runEffect(state, {
      kind: 'atom',
      verb: 'handReveal',
      args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' },
    }, {
      source: { player: 'self', cardId, abilityId: 'a1', uid: `${cardId}#1`, area: 'scene' },
      bindings: {},
    });
    reveal('FIRST-SOURCE');
    state.players.opp.hand = ['SECOND'];
    reveal('SECOND-SOURCE');

    expect(_drainPendingPublicHandRevealSide()?.source.cardId).toBe('FIRST-SOURCE');
    expect(_drainPendingPublicHandRevealSide()?.source.cardId).toBe('SECOND-SOURCE');
  });

  it('preserves a live presentation channel across a same-session state commit', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['VISIBLE'];
    runEffect(state, {
      kind: 'atom',
      verb: 'handReveal',
      args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' },
    }, {
      source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1' },
      bindings: {},
    });

    useGameStateStore.getState().setGameState(state, { preserveRuntime: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      cardIds: ['VISIBLE'],
      lifetime: 'presentation',
      source: { cardId: 'SOURCE' },
    });

    useGameStateStore.getState().setGameState(state, { preserveRuntime: true });

    expect(useGameStateStore.getState().pendingPublicHandReveal).toMatchObject({
      cardIds: ['VISIBLE'],
      lifetime: 'presentation',
      source: { cardId: 'SOURCE' },
    });
  });

  it('preserves an already-surfaced deck presentation across a live state commit', () => {
    const state = createEmptyGameState();
    useGameStateStore.setState({
      gameState: state,
      pendingDeckReveal: {
        player: 'self',
        visibility: 'public',
        viewer: 'all',
        revealed: ['VISIBLE'],
        matched: 'VISIBLE',
        presentation: 'reveal-return',
      },
    });

    useGameStateStore.getState().setGameState(state, { preserveRuntime: true });

    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      revealed: ['VISIBLE'],
      presentation: 'reveal-return',
    });
  });

  it('drops a stale presentation channel when installing a new authority', () => {
    const oldState = createEmptyGameState();
    oldState.players.opp.hand = ['STALE'];
    runEffect(oldState, {
      kind: 'atom',
      verb: 'handReveal',
      args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' },
    }, {
      source: { player: 'self', cardId: 'OLD', abilityId: 'a1', uid: 'old#1' },
      bindings: {},
    });

    useGameStateStore.getState().setGameState(createEmptyGameState());

    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(_drainPendingPublicHandRevealSide()).toBeNull();
  });

  it('uses explicit hand-reveal descriptors instead of log text for public hand visibility', () => {
    const reveal = (card: { abilities: Array<{ effect?: { steps?: unknown[] } & Record<string, unknown> }> }) => {
      const effect = card.abilities[0]!.effect!;
      return ((effect.steps?.[0] ?? effect) as { verb: string; args: Record<string, unknown> });
    };

    expect(reveal(B03111)).toMatchObject({ verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } });
    expect(reveal(B07100)).toMatchObject({ verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } });
    expect(reveal(B06084)).toMatchObject({ verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' } });
    expect(reveal(B01074)).toMatchObject({ verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' } });
    expect(reveal(D05004)).toMatchObject({ verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' } });
  });

  it('marks the three self-hand reveal branches as effect-lifetime public windows', () => {
    const findReveal = (value: unknown): { verb: string; args: Record<string, unknown> } | null => {
      if (!value || typeof value !== 'object') return null;
      const node = value as Record<string, unknown>;
      if (node.verb === 'handReveal') return node as { verb: string; args: Record<string, unknown> };
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) {
          for (const item of child) {
            const found = findReveal(item);
            if (found) return found;
          }
        } else {
          const found = findReveal(child);
          if (found) return found;
        }
      }
      return null;
    };

    for (const card of [B08064, B09002, B10024]) {
      expect(findReveal(card.abilities)).toMatchObject({
        verb: 'handReveal',
        args: { player: 'self', audience: 'all', lifetime: 'effect' },
      });
    }
  });

  it('never opens a public window for a reveal-from-hand cost', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['COST-CARD'];
    const cost: Cost = {
      kind: 'revealFromHand', n: 1,
      target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
    };

    pay(state, cost, {
      source: { player: 'self', cardId: 'SOURCE', area: 'scene' },
      bindings: {},
      picked: [{ kind: 'card', cardId: 'COST-CARD', player: 'self', area: 'hand', index: 0 }],
    });

    expect(_drainPendingPublicHandRevealSide()).toBeNull();
  });

  it('does not serialize revealed card IDs into the game log', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['SECRET-A', 'SECRET-B'];
    runEffect(state, {
      kind: 'atom',
      verb: 'handReveal',
      args: { player: 'opp', all: true, audience: 'all', lifetime: 'presentation' },
    }, {
      source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' },
      bindings: {},
    });
    expect(JSON.stringify(state.log)).not.toContain('SECRET-A');
    expect(JSON.stringify(state.log)).not.toContain('SECRET-B');
  });

  it('links B07100 public hand reveal to its following discard occurrence picker', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['CUTIN', 'CUTIN'];
    const cutin: CardDef = {
      id: 'CUTIN', no: 'CUTIN', kind: 'character', names: ['CUTIN'], colors: ['黒'], level: 1, ap: 1000, lp: 1,
      traits: [], keywords: ['カットイン'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    };
    registerCardDef(B07100);
    registerCardDef(cutin);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    runEffect(state, B07100.abilities[0]!.effect!, {
      source: { player: 'self', cardId: 'B07100', abilityId: 'a1', uid: 'korn#1' },
      bindings: {},
    });

    const window = _drainPendingPublicHandRevealSide()!;
    expect(window.cardIds).toEqual(['CUTIN', 'CUTIN']);
    expect(_drainPendingEffectPickSide()).toMatchObject({
      atomVerb: 'discard',
      publicHandRevealToken: window.resolutionToken,
      candidates: [
        { cardId: 'CUTIN', index: 0 },
        { cardId: 'CUTIN', index: 1 },
      ],
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('rejects a stale linked selection by exact hand multiset without applying it', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['A', 'B'];
    useGameStateStore.setState({
      gameState: state,
      pendingPublicHandReveal: {
        owner: 'opp', audience: 'all', cardIds: ['A', 'A'], handSnapshot: ['A', 'A'],
        lifetime: 'effect', resolutionToken: 'public-hand-reveal:stale', source: {},
      },
      pendingEffectPick: {
        player: 'self', ownerPlayer: 'self', atomVerb: 'discard', atomArgs: {}, nMin: 0, nMax: 1,
        source: { cardId: 'SOURCE', abilityId: 'a1' }, publicHandRevealToken: 'public-hand-reveal:stale',
        candidates: [{ uid: 'hand:opp:0:A', cardId: 'A', player: 'opp', kind: 'card', area: 'hand' }],
      },
    });

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'hand:opp:0:A' })).toMatchObject({ ok: false });
    expect(useGameStateStore.getState().gameState!.players.opp.hand).toEqual(['A', 'B']);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('closes an effect window with no legal target without blocking a later driver tick', () => {
    const state = createEmptyGameState();
    runEffect(state, {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } },
        { kind: 'atom', verb: 'discard', args: {
          player: 'opp',
          target: { kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 1, max: 1 } },
        } },
      ],
    }, {
      source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' },
      bindings: {},
    });

    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });

  it('closes an AI-auto-resolved target and leaves no decision deadlock', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['AUTO'];
    const ctx = {
      source: { player: 'self' as const, cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' as const },
      bindings: {},
    };
    const effect = {
      kind: 'chain' as const,
      steps: [
        { kind: 'atom' as const, verb: 'handReveal' as const, args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } },
        { kind: 'atom' as const, verb: 'discard' as const, args: {
          player: 'opp',
          target: { kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 1, max: 1 } },
        } },
      ],
    };
    const resolved = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: false, humanPlayer: null, source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    runEffect(state, resolved, ctx);
    surfacePendingSideChannels();

    expect(state.players.opp.hand).toEqual([]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });

  it('links through choice, then clears the carrier before a later sibling pick', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['OPP'];
    state.players.self.hand = ['SELF'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const ctx = {
      source: { player: 'self' as const, cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' as const },
      bindings: {},
    };
    runEffect(state, {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } },
        { kind: 'choice', chooser: 'self', options: [
          { kind: 'atom', verb: 'discard', args: {
            player: 'opp',
            chooser: 'source',
            target: { kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 1, max: 1 } },
          } },
          { kind: 'parallel', steps: [] },
        ] },
        { kind: 'atom', verb: 'discard', args: {
          player: 'self',
          target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 } },
        } },
      ],
    }, ctx);

    const window = _drainPendingPublicHandRevealSide()!;
    const choice = _drainPendingEffectChoiceSide()!;
    expect(choice.publicHandRevealToken).toBe(window.resolutionToken);
    applyChoiceAndContinuation(state, choice, 0);
    const linked = _drainPendingEffectPickSide()!;
    expect(linked.publicHandRevealToken).toBe(window.resolutionToken);
    applyPickAndContinuation(state, linked, linked.candidates[0]!.uid);
    expect(_drainPendingEffectPickSide()?.publicHandRevealToken).toBeUndefined();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('does not leak a reveal cause into a parallel sibling pick', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['OPP'];
    state.players.self.hand = ['SELF'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    runEffect(state, {
      kind: 'parallel',
      steps: [
        { kind: 'atom', verb: 'handReveal', args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } },
        { kind: 'atom', verb: 'discard', args: {
          player: 'self',
          target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 } },
        } },
      ],
    }, {
      source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' },
      bindings: {},
    });

    expect(_drainPendingEffectPickSide()?.publicHandRevealToken).toBeUndefined();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('links through optional and consumes the token when declined', () => {
    const state = createEmptyGameState();
    state.players.opp.hand = ['OPP'];
    const ctx = {
      source: { player: 'self' as const, cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' as const },
      bindings: {},
    };
    const effect = {
      kind: 'sequence' as const,
      steps: [
        { kind: 'atom' as const, verb: 'handReveal' as const, args: { player: 'opp', all: true, audience: 'all', lifetime: 'effect' } },
        { kind: 'optional' as const, effect: { kind: 'atom' as const, verb: 'discard' as const, args: {
          player: 'opp',
          target: { kind: 'pick', query: { area: 'hand', side: 'opp' }, n: { min: 1, max: 1 } },
        } } },
      ],
    };
    const resolved = resolveEffectPicks(state, effect, ctx, {
      byPlayer: 'self', humanChooser: true, humanPlayer: 'self', source: { cardId: 'SOURCE', abilityId: 'a1' },
    });
    runEffect(state, resolved, ctx);

    const window = _drainPendingPublicHandRevealSide()!;
    const optional = _drainPendingEffectOptionalSide()!;
    expect(optional.publicHandRevealToken).toBe(window.resolutionToken);
    applyOptionalAndContinuation(state, optional, false);
    expect(_drainPendingEffectPickSide()).toBeNull();
  });

  it('keeps the token on choose-intercept until the response completes', () => {
    const state = createEmptyGameState();
    const base: CardDef = {
      id: 'SOURCE', no: 'SOURCE', kind: 'character', names: ['Source'], colors: ['赤'],
      level: 1, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    };
    registerCardDef(base);
    registerCardDef({ ...base, id: 'TARGET', no: 'TARGET', names: ['Target'] });
    registerCardDef({
      ...base,
      id: 'RESPONSE_PROTECTOR',
      no: 'RESPONSE_PROTECTOR',
      abilities: [{
        id: 'a1',
        type: 'triggered',
        scope: 'on-scene',
        limit: { kind: 'turn', n: 1 },
        trigger: { hook: 'effect:choose-intercept-discard' as never, interceptTarget: { cardName: 'Target' } } as never,
        description: '',
      }],
    });
    state.players.self.scene = [
      sceneChar('TARGET', 'target'),
      sceneChar('RESPONSE_PROTECTOR', 'protector'),
    ];
    state.players.opp.hand = ['COST'];
    const pending = {
      player: 'self' as const,
      ownerPlayer: 'opp' as const,
      source: { cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1' },
      atomVerb: 'sceneSetState',
      atomArgs: { uid: '$pick', state: 'sleep' },
      candidates: [{ uid: 'target', cardId: 'TARGET', player: 'self' as const }],
      nMin: 1,
      nMax: 1,
      publicHandRevealToken: 'public-hand-reveal:intercept',
      continuation: {
        remainder: [],
        kind: 'sequence' as const,
        ctx: {
          source: { player: 'opp' as const, cardId: 'SOURCE', abilityId: 'a1', uid: 'source#1', area: 'scene' as const },
          bindings: {},
        },
      },
    };

    applyPickAndContinuation(state, pending, 'target');
    expect(_drainPendingChooseInterceptSide()).toMatchObject({
      targetUid: 'target',
      publicHandRevealToken: 'public-hand-reveal:intercept',
    });
  });

  it('closes an effect-lifetime window when its linked pick is skipped', () => {
    const state = createEmptyGameState();
    useGameStateStore.setState({
      gameState: state,
      pendingPublicHandReveal: {
        owner: 'opp', audience: 'all', cardIds: [], handSnapshot: [],
        lifetime: 'effect', resolutionToken: 'public-hand-reveal:skip', source: {},
      },
      pendingEffectPick: {
        player: 'self', ownerPlayer: 'self', candidates: [], atomVerb: 'discard', atomArgs: {},
        nMin: 0, nMax: 1, source: { cardId: 'SOURCE', abilityId: 'a1' },
        publicHandRevealToken: 'public-hand-reveal:skip',
      },
    });
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toMatchObject({ ok: true });
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
  });
});
