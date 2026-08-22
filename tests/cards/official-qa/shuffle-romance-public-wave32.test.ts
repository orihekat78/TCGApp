// qa: card:B01023:02440e5ca87f24c64c070e4853a3b0b543a764fdc2f252c5aab04d7ab3926b9a
// qa: card:B01023:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// qa: card:B01023:a22889ed053728203fe760dba74c1815541efd60230ba9078be35a7501eb8a50
// qa: card:D10024:01e64ea9e0d149ca2362d7754c49a44727c3284f0467137dc414ec81443e2891
// qa: card:D10024:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
// qa: card:D10024:646c1472c2a6b975b49eca2ac79e74540171e1854bd24d29adc9fb527bd6fedd
// qa: card:D10024:ca9af93dc00f754e794b95de64defe36f456e90d9d15cdc984dbda56beabf0a2
// qa: card:D10024:f6521aca80b8a8711805b56d15a7566b43b6ff300c04446d8881f5d525d2c300
// qa: card:B03041:4a6c8613d6e0497b06b4e70c523c07d5af3b96b44f7f33a9052540e2f81e339a
// qa: card:B03041:f8f92580279cc9760dae09ab4c6c90d61a91bdde20c47a6cb140b1f46bec648a
// qa: card:B06012:ca9af93dc00f754e794b95de64defe36f456e90d9d15cdc984dbda56beabf0a2
// Rules: 03, 08, 10, 14, 15, 16, 17, 22, 26. Game actions and decisions use
// the public dispatcher; presentation acknowledgement only clears the private look surface.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B01023 } from '@/cards/ct-p01/B01023';
import { B01023P } from '@/cards/ct-p01/B01023P';
import { B03041 } from '@/cards/ct-p03/B03041';
import { B03041P } from '@/cards/ct-p03/B03041P';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B06012P } from '@/cards/ct-p06/B06012P';
import { D10024 } from '@/cards/ct-d10/D10024';
import { D11007 } from '@/cards/ct-d11/D11007';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

type PendingPick = NonNullable<ReturnType<typeof useGameStateStore.getState>['pendingEffectPick']>;

const HOST = fixtureCard('W32-HOST', { ap: 6000 });
const ORDER_FLIP_HOST = fixtureCard('W32-ORDER-FLIP-HOST', { ap: 8000 });
const GREEN_HOST = fixtureCard('W32-GREEN-HOST', { ap: 6000, colors: ['緑'] });
const BLUE_RIDER_HOST = fixtureCard('W32-BLUE-RIDER-HOST', {
  ap: 6000,
  colors: ['青'],
  traits: ['少年探偵団'],
});
const SELF_TARGET = fixtureCard('W32-SELF-TARGET', { ap: 4000 });
const SELF_ATTACKER = fixtureCard('W32-SELF-ATTACKER', { ap: 7000 });
const MATCH = fixtureCard('W32-PRIVATE-MATCH');
const LOOKED = [
  fixtureCard('W32-LOOKED-1'),
  fixtureCard('W32-LOOKED-2'),
  fixtureCard('W32-LOOKED-3'),
  fixtureCard('W32-LOOKED-4'),
] as const;
const RECYCLE = fixtureCard('W32-RECYCLE');
const OPP_TARGET = fixtureCard('W32-OPP-TARGET', { ap: 4000 });
const HIGH_AP_TARGET = fixtureCard('W32-HIGH-AP-TARGET', { ap: 7000 });
const OPP_ATTACKER = fixtureCard('W32-OPP-ATTACKER', { ap: 9000 });
const OPP_DECK = [
  fixtureCard('W32-OPP-DECK-1'),
  fixtureCard('W32-OPP-DECK-2'),
  fixtureCard('W32-OPP-DECK-3'),
  fixtureCard('W32-OPP-DECK-4'),
] as const;

function fixtureCard(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: `test/${id}`,
    kind: 'character',
    names: [id],
    colors: ['青'],
    level: 1,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...overrides,
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(
  source: CardDef,
  deck: readonly string[],
  options: {
    attached?: boolean;
    host?: boolean;
    hostCard?: CardDef;
    hostState?: 'active' | 'sleep';
    selfTarget?: boolean;
    selfAttacker?: boolean;
    oppTargetCard?: CardDef;
    remove?: readonly string[];
  } = {},
): void {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...source.colors];
  state.players.self.file = Array.from(
    { length: source.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: 'W32-FILE' }),
  );
  state.players.self.hand = options.attached ? [] : [source.id];
  state.players.self.deck = [...deck];
  state.players.self.remove = [...(options.remove ?? [])];
  state.players.self.scene = options.host === false
    ? []
    : [makeChar({
      cardId: (options.hostCard ?? HOST).id,
      uid: 'host',
      state: options.hostState ?? 'active',
      setCards: options.attached ? [{ cardId: source.id, faceUp: true }] : [],
    })];
  if (options.selfTarget) {
    state.players.self.scene.push(makeChar({
      cardId: SELF_TARGET.id,
      uid: 'self-target',
      state: 'sleep',
    }));
  }
  if (options.selfAttacker) {
    state.players.self.scene.push(makeChar({
      cardId: SELF_ATTACKER.id,
      uid: 'self-attacker',
      state: 'active',
    }));
  }
  state.players.opp.scene = [
    makeChar({ cardId: (options.oppTargetCard ?? OPP_TARGET).id, uid: 'opp-target', state: 'sleep' }),
    makeChar({ cardId: OPP_ATTACKER.id, uid: 'opp-attacker', state: 'active' }),
  ];
  state.players.opp.deck = OPP_DECK.map(card => card.id);
  startCausalSession(state, `qa-wave32-${source.id}`);
  resetPresentationQueue(`qa-wave32-${source.id}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function playEvent(source: CardDef): PendingPick {
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: source.id }))
    .toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    atomVerb: 'deckRevealUntil',
    player: 'self',
    nMin: 0,
    source: { cardId: source.id, abilityId: 'a1' },
  });
  expect(pending?.nMax).toBe(Math.min(1, pending?.candidates.length ?? 0));
  return pending!;
}

function resolveLook(pending: PendingPick, pickedCardId: string | null): void {
  const pickedUid = pickedCardId === null
    ? null
    : pending.candidates.find(candidate => candidate.cardId === pickedCardId)?.uid;
  if (pickedCardId !== null) expect(pickedUid, `missing deck candidate ${pickedCardId}`).toBeDefined();
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: pickedUid ?? null,
  }))).toEqual({ ok: true });
}

function acknowledgeLookAndOrder(): void {
  if (useGameStateStore.getState().pendingDeckReveal) {
    useGameStateStore.getState().setPendingDeckReveal(null);
  }
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve',
      order: [...reorder.cardIds],
    }))).toEqual({ ok: true });
  }
}

function resolveSet(source: CardDef): void {
  // B01023/D10024 mandatory host continuation: one public choice creates a face-up set.
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    atomVerb: 'charSetCard',
    player: 'self',
    nMin: 1,
    nMax: 1,
    source: { cardId: source.id, abilityId: 'a1' },
  });
  expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['host']);
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve',
    pickedUid: 'host',
  }))).toEqual({ ok: true });
  expect(current().players.self.scene.find(character => character.uid === 'host')?.setCards)
    .toContainEqual(expect.objectContaining({ cardId: source.id, faceUp: true }));
  expect(current().players.self.remove).not.toContain(source.id);
}

function startContact(byUid: string, targetUid: string, guarderUid: string | null = null): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid, targetUid })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  return actionId;
}

function finishContact(actionId: string, first: Player, second: Player): void {
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: first, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: second, choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
}

function deploy(source: CardDef, hostState: 'active' | 'sleep' = 'active'): void {
  install(source, [MATCH.id, ...LOOKED.map(card => card.id)], { hostState });
  const look = playEvent(source);
  resolveLook(look, null);
  acknowledgeLookAndOrder();
  resolveSet(source);
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  [
    B01023,
    B01023P,
    B03041,
    B03041P,
    B06012,
    B06012P,
    D10024,
    D11007,
    HOST,
    ORDER_FLIP_HOST,
    GREEN_HOST,
    BLUE_RIDER_HOST,
    SELF_TARGET,
    SELF_ATTACKER,
    MATCH,
    ...LOOKED,
    RECYCLE,
    OPP_TARGET,
    HIGH_AP_TARGET,
    OPP_ATTACKER,
    ...OPP_DECK,
  ].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('Shuffle Romance official-QA public flow', () => {
  it('sets the used B01023 face-up, then removes it with its host after a public contact', () => {
    deploy(B01023, 'sleep');

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(current().gameResult, 'opponent auto phase must stay nonterminal').toBeUndefined();
    const actionId = startContact('opp-attacker', 'host');
    expect(readChar.ap(current(), 'host')).toBe(8000);
    finishContact(actionId, 'self', 'opp');

    expect(current().players.self.scene.some(character => character.uid === 'host')).toBe(false);
    expect(current().players.self.remove).toEqual(expect.arrayContaining([HOST.id, B01023.id]));
  });

  it.each([B01023P, D10024])('$id resolves without a host and leaves the spent event in remove', (source) => {
    install(source, LOOKED.slice(0, 2).map(card => card.id), { host: false });
    const look = playEvent(source);
    resolveLook(look, null);
    acknowledgeLookAndOrder();

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().players.self.remove).toContain(source.id);
    expect(current().gameResult).toBeUndefined();
  });

  it.each([B01023, D10024])('$id allows zero selected cards and still requires exactly one set host', (source) => {
    install(source, [MATCH.id, ...LOOKED.map(card => card.id)]);
    const look = playEvent(source);
    expect(look.candidates.map(candidate => candidate.cardId)).toContain(MATCH.id);
    resolveLook(look, null);
    acknowledgeLookAndOrder();

    expect(current().players.self.hand).not.toContain(MATCH.id);
    expect(current().players.self.deck).toEqual(expect.arrayContaining([
      MATCH.id,
      ...LOOKED.map(card => card.id),
    ]));
    resolveSet(source);
  });

  it('keeps the D10024 selected card private from the opponent and spectator projection', () => {
    install(D10024, [MATCH.id, ...LOOKED.map(card => card.id)]);
    const look = playEvent(D10024);
    expect(useGameStateStore.getState().pendingDeckReveal).toMatchObject({
      player: 'self',
      visibility: 'private',
      viewer: 'self',
      awaitingPick: true,
      revealed: [MATCH.id, ...LOOKED.map(card => card.id)],
    });
    resolveLook(look, MATCH.id);

    expect(current().players.self.hand).toContain(MATCH.id);
    expect(useGameStateStore.getState().pendingPublicHandReveal).toBeNull();
    const projected = projectReplayStateForViewer(current(), 'spectator');
    expect(projected.players.self.hand).toHaveLength(current().players.self.hand.length);
    expect(JSON.stringify(projected)).not.toContain(MATCH.id);
    acknowledgeLookAndOrder();
    resolveSet(D10024);
  });

  it('looks at every card in a short D10024 deck without refreshing, then returns a declined look', () => {
    const shortDeck = [MATCH.id, LOOKED[0].id, LOOKED[1].id];
    install(D10024, shortDeck);
    const look = playEvent(D10024);

    expect(look.candidates.map(candidate => candidate.cardId)).toEqual(shortDeck);
    expect(current().players.self.deck).toEqual(shortDeck);
    expect(current().refreshCount.self).toBe(0);
    resolveLook(look, null);
    acknowledgeLookAndOrder();
    resolveSet(D10024);

    expect(current().players.self.deck).toEqual(shortDeck);
    expect(current().refreshCount.self).toBe(0);
  });

  it('refreshes only after taking the final D10024 deck card and excludes the resolving event', () => {
    install(D10024, [MATCH.id], { remove: [RECYCLE.id] });
    const look = playEvent(D10024);
    expect(current().players.self.deck).toEqual([MATCH.id]);
    expect(current().refreshCount.self).toBe(0);

    resolveLook(look, MATCH.id);
    expect(current().players.self.hand).toContain(MATCH.id);
    expect(current().players.self.deck).toEqual([RECYCLE.id]);
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.opp.evidence).toHaveLength(1);
    expect(current().players.self.deck).not.toContain(D10024.id);
    acknowledgeLookAndOrder();
    resolveSet(D10024);

    expect(current().players.self.remove).not.toContain(D10024.id);
    expect(current().gameResult).toBeUndefined();
  });

  it.each(['self', 'opp'] as const)('grants D10024 AP +2000 when the %s player causes the host contact', (actor) => {
    deploy(D10024, actor === 'self' ? 'active' : 'sleep');
    if (actor === 'opp') {
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
      expect(current().gameResult, 'opponent auto phase must stay nonterminal').toBeUndefined();
    }

    const actionId = actor === 'self'
      ? startContact('host', 'opp-target')
      : startContact('opp-attacker', 'host');
    expect(readChar.ap(current(), 'host')).toBe(8000);
    finishContact(actionId, actor === 'self' ? 'opp' : 'self', actor);

    if (actor === 'self') {
      expect(readChar.ap(current(), 'host')).toBe(6000);
      expect(current().players.self.scene.some(character => character.uid === 'host')).toBe(true);
    } else {
      expect(current().players.self.remove).toEqual(expect.arrayContaining([HOST.id, D10024.id]));
    }
  });

  it('orders contact after the D10024 contacted effect crosses the opponent AP', () => {
    install(D10024, [], {
      attached: true,
      hostCard: ORDER_FLIP_HOST,
      hostState: 'sleep',
    });
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });

    const actionId = startContact('opp-attacker', 'host');
    const action = current().actionContexts?.[actionId];
    expect(readChar.ap(current(), 'host')).toBe(10000);
    expect(action?.firstUid).toBe('opp-attacker');
    expect(action?.secondUid).toBe('host');
  });

  it('defers contact order across a human discard decision, then resumes with post-effect AP', () => {
    install(D11007, [], {
      hostCard: D11007,
      hostState: 'active',
      oppTargetCard: HIGH_AP_TARGET,
    });

    const actionId = startContact('host', 'opp-target');
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending).toMatchObject({
      atomVerb: 'discard',
      player: 'self',
      source: { cardId: D11007.id, abilityId: 'a3' },
    });
    expect(current().actionContexts?.[actionId]?.phase).toBe('contact-order-pending');
    expect(current().actionContexts?.[actionId]?.firstUid).toBeUndefined();
    expect(current().actionContexts?.[actionId]?.secondUid).toBeUndefined();
    expect(readChar.ap(current(), 'host')).toBe(5000);

    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'effectPickResolve',
      pickedUid: pending!.candidates[0]!.uid,
    }))).toEqual({ ok: true });

    expect(readChar.ap(current(), 'host')).toBe(8000);
    expect(current().actionContexts?.[actionId]).toMatchObject({
      phase: 'action-1',
      firstUid: 'opp-target',
      secondUid: 'host',
    });
  });

  it.each([B03041, B03041P])(
    '$id grants its legal green set host AP +2000 when that host guards an opponent action',
    (source) => {
      install(source, [], {
        attached: true,
        hostCard: GREEN_HOST,
        hostState: 'active',
        selfTarget: true,
      });
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
      expect(current().gameResult, 'opponent auto phase must stay nonterminal').toBeUndefined();

      const actionId = startContact('opp-attacker', 'self-target', 'host');
      // B03041/B03041P: a guarding set host is the contacted bUid before cut-in.
      expect(current().actionContexts?.[actionId]?.phase).toBe('action-1');
      expect(readChar.ap(current(), 'host')).toBe(8000);
      finishContact(actionId, 'self', 'opp');

      expect(current().players.self.remove).toEqual(expect.arrayContaining([GREEN_HOST.id, source.id]));
    },
  );

  it.each([B06012, B06012P])(
    '$id grants its legal blue Detective Boys set host AP +2000 on an opponent contact',
    (source) => {
      install(source, [], {
        attached: true,
        hostCard: BLUE_RIDER_HOST,
        hostState: 'sleep',
      });
      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
      const optional = useGameStateStore.getState().pendingEffectOptional;
      if (optional) {
        expect(dispatchEngineAction(bindPendingDecision(optional, {
          type: 'optionalResolve',
          run: false,
        }))).toEqual({ ok: true });
      }

      const actionId = startContact('opp-attacker', 'host');
      // B06012/B06012P: the opponent-caused contacted host resolves before cut-in.
      expect(current().actionContexts?.[actionId]?.phase).toBe('action-1');
      expect(readChar.ap(current(), 'host')).toBe(8000);
      finishContact(actionId, 'self', 'opp');

      expect(current().players.self.remove).toEqual(expect.arrayContaining([BLUE_RIDER_HOST.id, source.id]));
    },
  );

  it.each([
    { source: B03041, hostCard: GREEN_HOST, guarderUid: 'opp-attacker', first: 'self', second: 'opp' },
    { source: B03041P, hostCard: GREEN_HOST, guarderUid: 'opp-attacker', first: 'self', second: 'opp' },
    { source: B06012, hostCard: BLUE_RIDER_HOST, guarderUid: null, first: 'opp', second: 'self' },
    { source: B06012P, hostCard: BLUE_RIDER_HOST, guarderUid: null, first: 'opp', second: 'self' },
  ] as const)(
    '$source.id grants AP +2000 when its host is the action-side contact participant',
    ({ source, hostCard, guarderUid, first, second }) => {
      install(source, [], { attached: true, hostCard, hostState: 'active' });

      const actionId = startContact('host', 'opp-target', guarderUid);
      expect(readChar.ap(current(), 'host')).toBe(8000);
      finishContact(actionId, first, second);
    },
  );

  it.each([
    { source: B03041, hostCard: GREEN_HOST },
    { source: B03041P, hostCard: GREEN_HOST },
    { source: B06012, hostCard: BLUE_RIDER_HOST },
    { source: B06012P, hostCard: BLUE_RIDER_HOST },
  ] as const)(
    '$source.id does not boost an unrelated observer host',
    ({ source, hostCard }) => {
      install(source, [], {
        attached: true,
        hostCard,
        hostState: 'active',
        selfAttacker: true,
      });

      const actionId = startContact('self-attacker', 'opp-target');
      expect(readChar.ap(current(), 'host')).toBe(6000);
      finishContact(actionId, 'opp', 'self');
      expect(current().players.self.scene.some(character => character.uid === 'host')).toBe(true);
    },
  );

  it('ends contact without setting order when a contact:start effect removes both participants', () => {
    const removeBoth = fixtureCard('W32-REMOVE-BOTH', {
      abilities: [{
        id: 'a1',
        type: 'triggered',
        scope: 'on-scene',
        trigger: { hook: 'contact:start', selfOnly: true },
        effect: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.targetUid', cause: 'effect' } },
            { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.byUid', cause: 'effect' } },
          ],
        },
        description: 'Wave 32 contact participant removal fixture.',
        ruleRefs: ['rules/08-contact.md'],
      }],
    });
    register(removeBoth);
    install(removeBoth, [], { hostCard: removeBoth, hostState: 'active' });
    let orderSetCount = 0;
    let contactEndCount = 0;
    event.on('contact:order-set', () => { orderSetCount += 1; });
    event.on('contact:end', () => { contactEndCount += 1; });

    const actionId = startContact('host', 'opp-target');

    expect(current().players.self.scene.some(character => character.uid === 'host')).toBe(false);
    expect(current().players.opp.scene.some(character => character.uid === 'opp-target')).toBe(false);
    expect(current().actionContexts?.[actionId]).toMatchObject({ phase: 'contact-end' });
    expect(current().actionContexts?.[actionId]?.firstUid).toBeUndefined();
    expect(current().actionContexts?.[actionId]?.secondUid).toBeUndefined();
    expect(orderSetCount).toBe(0);
    expect(contactEndCount).toBe(1);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(current().actionContexts?.[actionId]).toBeUndefined();
  });
});
