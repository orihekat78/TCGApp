// qa: card:B01063:f97b21e9e16f570fd0da6acab0a9cb6e819a6e4a010e86dddb5ff82c6d33902e
// qa: card:B03060:9a55ffff31c60e2c4f8366e4db4c6adbccd1c1ed549c8ead2729a2158f677dfe
// qa: card:B03060:d804147a97a3124597bed33d4eb7af2680a76345d012deffa73816429ba74c06
// qa: card:B04070:12fec323efcfb63a8fd99154204513c7e8a0a7dd8b2137035f673abe939b7329
// qa: card:B04070:67801f5374230019004fb71d2e44b9447612e33862cee613a875c907998e322d
// qa: card:B06066:ebfff172c7e5296ae9eebca963aa0676af4b47231cc4e7fea21e3174d2ee8406
// qa: card:B06078:38f862914c44e5295150203057d8bfe9725b9cd44ea215ddf6d67f815ef7518d
// qa: card:B06078:75cb4a05b1a32e0e3701dcb5a666c0af0860d1642feb89d769258be05103f59d
// qa: card:B06078:d92c9ac014707473cd695b904e8426a0f4a42423f934910e92fcf3a759363394
// qa: card:B07002:1326a9294ee6a8f8fb160e25680fb9eadb1af57c1a38f516b058d52eecea0875
// qa: card:B07002:f0d07b981c842ac4c3c074c83cd7ed6ef5256eff30968ad4072d94fc0f769789
// qa: card:B07016:0814c623c9cf5989f18d0cf72bc9d209d8d01ce16e6267afdbe253e516b17631
// qa: card:B07067:3a8bd4031ff8a75675ea411872d9e566fde4a4d87c718fdc3322b3d179a1ba1e
// qa: card:B09058:30b0036c7871fae202b4cb59e7db54eb319ca82e20a61679e2100ccc7402b72c
// qa: card:B09082:27b7a3bfeba3ba6019e645b05d472917f367ee2e729f3721ee7ce65daf8fa206
// qa: card:D01003:ec8f39df4e6edb48685670cfbba7feb53d9a4a16678b3a02b48fe1e03fb65915
// qa: card:D01003:f97b21e9e16f570fd0da6acab0a9cb6e819a6e4a010e86dddb5ff82c6d33902e
// Rules: 03-field-areas.md, 15-abilities-effects.md, 21-declared-ability-cost.md, 25-qa-effects-resolution.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B01063 } from '@/cards/ct-p01/B01063';
import { B03060 } from '@/cards/ct-p03/B03060';
import { B03060P } from '@/cards/ct-p03/B03060P';
import { B04070 } from '@/cards/ct-p04/B04070';
import { B04070P } from '@/cards/ct-p04/B04070P';
import { B06066 } from '@/cards/ct-p06/B06066';
import { B06066P } from '@/cards/ct-p06/B06066P';
import { B06078 } from '@/cards/ct-p06/B06078';
import { B06078P } from '@/cards/ct-p06/B06078P';
import { B07002 } from '@/cards/ct-p07/B07002';
import { B07002P } from '@/cards/ct-p07/B07002P';
import { B07016 } from '@/cards/ct-p07/B07016';
import { B07016P } from '@/cards/ct-p07/B07016P';
import { B07016P2 } from '@/cards/ct-p07/B07016P2';
import { B07067 } from '@/cards/ct-p07/B07067';
import { B09058 } from '@/cards/ct-p09/B09058';
import { B09058P } from '@/cards/ct-p09/B09058P';
import { B09082 } from '@/cards/ct-p09/B09082';
import { D01003 } from '@/cards/ct-d01/D01003';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { makeChar } from '../../helpers/fixtures';

const Q = {
  activeB01063: 'f97b21e9', ownerB03060: '9a55ffff', activeB03060: 'd804147a',
  stunB04070: '12fec323', ownerB04070: '67801f53', ownerB06066: 'ebfff172',
  shortB06078: '38f86291', selfB06078: '75cb4a05', ownerB06078: 'd92c9ac0',
  leaveB07002: '1326a929', ownerB07002: 'f0d07b98', ownerB07016: '0814c623',
  ownerB07067: '3a8bd403', ownerB09058: '30b0036c', ownerB09082: '27b7a3bf',
  ownerD01003: 'ec8f39df', activeD01003: 'f97b21e9',
} as const;

const PAYER = 'QA_W24_WIDE_PAYER';
const HAND = 'QA_W24_HAND';
const DRAW = 'QA_W24_DRAW';
const LOW = 'QA_W24_LOW';
const HIGH = 'QA_W24_HIGH';
const AKAI_1 = 'QA_W24_AKAI_1';
const AKAI_2 = 'QA_W24_AKAI_2';
const AKAI_3 = 'QA_W24_AKAI_3';
const PARTNER = 'QA_W24_PARTNER';
const REMOVER = 'QA_W24_REMOVER';

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const removerAbility: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene',
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'self' } },
  description: '', ruleRefs: [],
};

const fixtures = [
  fixture(PAYER, {
    names: ['佐藤美和子', '知苑大哉'], colors: ['赤', '緑', '白', '黄'], level: 7,
    traits: ['探偵', '赤井家', '怪盗', '高校生'],
  }),
  fixture(HAND, { kind: 'event', level: 0 }), fixture(DRAW),
  fixture(LOW, { level: 7, ap: 7000 }), fixture(HIGH, { level: 9, ap: 9000 }),
  fixture(AKAI_1, { level: 6, traits: ['赤井家'] }),
  fixture(AKAI_2, { level: 6, traits: ['赤井家'] }),
  fixture(AKAI_3, { level: 6, traits: ['赤井家'] }),
  fixture(PARTNER, { kind: 'partner', names: ['佐藤美和子'], colors: ['緑', '赤', '黄'], level: 0 }),
  fixture(REMOVER, { abilities: [removerAbility] }),
];

function current(): GameState {
  const value = useGameStateStore.getState().gameState;
  if (!value) throw new Error('missing Wave 24 game state');
  return value;
}

function install(state: GameState, label: string): void {
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(source: CardDef, sourceState: 'active' | 'sleep' | 'stun' = 'active'): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: PARTNER, state: 'active', location: 'partner-area' };
  state.players.self.scene = [makeChar({ cardId: source.id, uid: 'source', state: sourceState })];
  state.players.self.hand = [HAND];
  state.players.self.deck = [AKAI_1, AKAI_2, AKAI_3, DRAW];
  state.players.opp.deck = [HIGH, LOW];
  return state;
}

function abilityId(card: CardDef): string {
  if ([B04070.id, B07002.id, B07016.id, B07067.id, B09058.id].includes(card.id)) return 'a2';
  return 'a1';
}

function activate(card: CardDef, payerUid: string, extra: Record<string, unknown> = {}) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid: 'source', abilId: abilityId(card),
    costParams: { sleepChar: { uids: [payerUid] }, ...extra },
  });
}

function pending(verb: string) {
  const value = useGameStateStore.getState().pendingEffectPick;
  expect(value?.atomVerb).toBe(verb);
  return value!;
}

function pick(uid: string | null): void {
  expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: uid })).toEqual({ ok: true });
}

function expectSettled(): void {
  const store = useGameStateStore.getState();
  expect(store.pendingEffectPick).toBeNull();
  expect(store.pendingEffectOptional).toBeNull();
  expect(store.pendingEffectChoice).toBeNull();
  expect(store.activeActionId).toBeNull();
  expect(current().pendingEffects.every(entry => entry.state === 'resolved')).toBe(true);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('Wave 24 public declared sleep-cost authority', () => {
  const ownershipCases = [
    [B03060, Q.ownerB03060], [B04070, Q.ownerB04070], [B06066, Q.ownerB06066],
    [B06078, Q.ownerB06078], [B07002, Q.ownerB07002], [B07016, Q.ownerB07016],
    [B07067, Q.ownerB07067], [B09058, Q.ownerB09058], [B09082, Q.ownerB09082],
    [D01003, Q.ownerD01003],
  ] as const;

  it.each(ownershipCases)('%s %s rejects an opponent payer atomically', (card, qa) => {
    const sourceState = card.id === B07067.id ? 'sleep' : card.id === B04070.id ? 'sleep' : 'active';
    const state = base(card, sourceState);
    state.players.self.scene.push(makeChar({ cardId: PAYER, uid: 'own-payer', state: 'active' }));
    state.players.opp.scene.push(makeChar({ cardId: PAYER, uid: 'opp-payer', state: 'active' }));
    install(state, `qa-wave24-owner-${card.id}-${qa}`);
    const before = structuredClone(state);
    const extra = card.id === B04070.id ? { removeFromHand: { indices: [0] } } : {};

    expect(activate(card, 'opp-payer', extra)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toEqual(before);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it.each([
    [B01063, Q.activeB01063], [B03060, Q.activeB03060], [D01003, Q.activeD01003],
  ] as const)('%s %s requires an active non-source payer', (card, qa) => {
    for (const invalidState of ['sleep', 'stun'] as const) {
      const state = base(card);
      state.players.self.scene.push(
        makeChar({ cardId: PAYER, uid: 'invalid-payer', state: invalidState }),
        makeChar({ cardId: PAYER, uid: 'active-alternate', state: 'active' }),
      );
      install(state, `qa-wave24-active-${card.id}-${qa}-${invalidState}`);
      const before = structuredClone(state);
      expect(activate(card, 'invalid-payer')).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toEqual(before);
      expect(activate(card, 'source')).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toEqual(before);
    }
  });

  it(`${Q.activeB01063}: B01063 sleeps only the explicitly selected active non-source card`, () => {
    const state = base(B01063);
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    install(state, 'qa-wave24-b01063-explicit');
    expect(activate(B01063, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    expect(pending('sceneRemove').nMin).toBe(0);
    pick(null);
    expectSettled();
  });

  it(`${Q.ownerB03060}/${Q.activeB03060}: B03060 pays both sleep leaves and stuns only a legal target`, () => {
    const state = base(B03060);
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    state.players.opp.scene = [
      makeChar({ cardId: LOW, uid: 'low-target', state: 'active' }),
      makeChar({ cardId: HIGH, uid: 'high-decoy', state: 'active' }),
    ];
    install(state, 'qa-wave24-b03060-positive');
    expect(activate(B03060, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    const choice = pending('sceneSetState');
    expect(choice.candidates.map(card => card.uid)).toContain('low-target');
    expect(choice.candidates.map(card => card.uid)).not.toContain('high-decoy');
    pick('low-target');
    expect(current().players.opp.scene[0]?.state).toBe('stun');
    expectSettled();
  });

  it(`${Q.stunB04070}/${Q.ownerB04070}: B04070 pays the selected Sato and hand card before stun activation becomes sleep`, () => {
    const state = base(B04070, 'stun');
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    install(state, 'qa-wave24-b04070-stun');
    expect(activate(B04070, 'chosen-payer', { removeFromHand: { indices: [0] } })).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    expect(current().players.self.hand).toEqual([]);
    expect(current().players.self.remove).toContain(HAND);
    expectSettled();
  });

  it(`${Q.stunB04070}: B04070 compound payment is atomic when the hand leaf is unavailable`, () => {
    const state = base(B04070, 'stun');
    state.players.self.hand = [];
    state.players.self.scene.push(makeChar({ cardId: PAYER, uid: 'payer', state: 'active' }));
    install(state, 'qa-wave24-b04070-atomic');
    const before = structuredClone(state);
    expect(activate(B04070, 'payer', { removeFromHand: { indices: [0] } })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toEqual(before);
  });

  it(`${Q.ownerB06066}: B06066 sleeps only the chosen same-trait card and moves only the legal opponent target`, () => {
    const state = base(B06066);
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    state.players.opp.scene = [
      makeChar({ cardId: LOW, uid: 'low-target', state: 'active' }),
      makeChar({ cardId: HIGH, uid: 'high-decoy', state: 'active' }),
    ];
    install(state, 'qa-wave24-b06066-positive');
    expect(activate(B06066, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    const choice = pending('sceneToDeck');
    expect(choice.candidates.map(card => card.uid)).toEqual(['low-target']);
    pick('low-target');
    expect(current().players.opp.scene.map(card => card.uid)).toEqual(['high-decoy']);
    expect(current().players.opp.deck.at(-1)).toBe(LOW);
    expectSettled();
  });

  it(`${Q.shortB06078}: B06078 rejects a two-card deck before sleeping its selected payer`, () => {
    const state = base(B06078);
    state.players.self.deck = [AKAI_1, AKAI_2];
    state.players.self.scene.push(makeChar({ cardId: PAYER, uid: 'payer', state: 'active' }));
    install(state, 'qa-wave24-b06078-short');
    const before = structuredClone(state);
    expect(activate(B06078, 'payer')).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toEqual(before);
  });

  it(`${Q.selfB06078}/${Q.ownerB06078}: B06078 may use itself and removes exactly three cards from its own deck`, () => {
    const state = base(B06078);
    state.players.self.scene.push(makeChar({ cardId: PAYER, uid: 'other-payer', state: 'active' }));
    const opponentDeck = [...state.players.opp.deck];
    install(state, 'qa-wave24-b06078-self');
    expect(activate(B06078, 'source')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.scene.find(card => card.uid === 'other-payer')?.state).toBe('active');
    expect(current().players.self.remove).toHaveLength(3);
    expect(current().players.self.deck).toHaveLength(1);
    expect(current().players.opp.deck).toEqual(opponentDeck);
    expect(pending('sceneRemove').nMin).toBe(0);
    pick(null);
    expectSettled();
  });

  it(`${Q.shortB06078}/${Q.selfB06078}/${Q.ownerB06078}: B06078 pays the deck cost on its controller side`, () => {
    endMatchSession();
    beginMatchSession('opp');
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    useGameStateStore.getState().resetMatchSessionState();

    const shortOwner = base(B06078);
    shortOwner.turn.player = 'opp';
    shortOwner.players.self.scene = [];
    shortOwner.players.self.deck = [AKAI_1, AKAI_2, AKAI_3, DRAW];
    shortOwner.players.opp.scene = [
      makeChar({ cardId: B06078.id, uid: 'opp-source', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'opp-first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'opp-payer', state: 'active' }),
    ];
    shortOwner.players.opp.deck = [AKAI_1, AKAI_2];
    install(shortOwner, 'qa-wave24-b06078-opp-short');
    const before = structuredClone(shortOwner);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'opp-source', abilId: 'a1',
      costParams: { sleepChar: { uids: ['opp-payer'] } },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current()).toEqual(before);

    const payableOwner = base(B06078);
    payableOwner.turn.player = 'opp';
    payableOwner.players.self.scene = [];
    payableOwner.players.self.deck = [AKAI_1, AKAI_2];
    payableOwner.players.opp.scene = [
      makeChar({ cardId: B06078.id, uid: 'opp-source', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'opp-first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'opp-payer', state: 'active' }),
    ];
    payableOwner.players.opp.deck = [DRAW, HAND, LOW, AKAI_1];
    const selfDeck = [...payableOwner.players.self.deck];
    install(payableOwner, 'qa-wave24-b06078-opp-payable');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'opp-source', abilId: 'a1',
      costParams: { sleepChar: { uids: ['opp-payer'] } },
    })).toEqual({ ok: true });
    expect(current().players.opp.scene.find(card => card.uid === 'opp-first-payer')?.state).toBe('active');
    expect(current().players.opp.scene.find(card => card.uid === 'opp-payer')?.state).toBe('sleep');
    expect(current().players.opp.remove).toHaveLength(3);
    expect(current().players.opp.deck).toEqual([AKAI_1]);
    expect(current().players.self.deck).toEqual(selfDeck);
  });

  it(`${Q.leaveB07002}/${Q.ownerB07002}: B07002 turn bans survive public removal of their source`, () => {
    const state = base(B07002);
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'payer', state: 'active' }),
      makeChar({ cardId: REMOVER, uid: 'remover', state: 'active' }),
    );
    install(state, 'qa-wave24-b07002-leave');
    expect(activate(B07002, 'payer')).toEqual({ ok: true });
    expect(current().turnState.opp.cutinBanned).toBe(true);
    expect(current().turnState.opp.disguiseBanned).toBe(true);
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'remover', abilId: 'a1' })).toEqual({ ok: true });
    expect(pending('sceneRemove').candidates.map(card => card.uid)).toContain('source');
    pick('source');
    expect(current().players.self.scene.some(card => card.uid === 'source')).toBe(false);
    expect(current().turnState.opp.cutinBanned).toBe(true);
    expect(current().turnState.opp.disguiseBanned).toBe(true);
    expectSettled();
  });

  it(`${Q.ownerB07016}: B07016 sleeps the exact level-five-or-higher payer and grants assault`, () => {
    const state = base(B07016);
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
      makeChar({ cardId: LOW, uid: 'level-decoy', state: 'active' }),
    );
    install(state, 'qa-wave24-b07016-positive');
    expect(activate(B07016, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    expect(current().players.self.scene.find(card => card.uid === 'source')?.turnEffects.grantedKeywords).toContain('突撃[事件]');
    expectSettled();
  });

  it(`${Q.ownerB07067}: B07067 keeps its sleeping source and removes only the chosen level-seven target`, () => {
    const state = base(B07067, 'sleep');
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    state.players.opp.scene = [
      makeChar({ cardId: LOW, uid: 'low-target', state: 'active' }),
      makeChar({ cardId: HIGH, uid: 'high-decoy', state: 'active' }),
    ];
    install(state, 'qa-wave24-b07067-positive');
    expect(activate(B07067, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    expect(pending('sceneRemove').candidates.map(card => card.uid)).toContain('low-target');
    pick('low-target');
    expect(current().players.opp.scene.map(card => card.uid)).toEqual(['high-decoy']);
    expectSettled();
  });

  it(`${Q.ownerB09058}: B09058 draws after sleeping only the selected other Akai-family character`, () => {
    const state = base(B09058);
    state.players.self.deck = [DRAW];
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    install(state, 'qa-wave24-b09058-positive');
    expect(activate(B09058, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    expect(current().players.self.hand).toContain(DRAW);
    expectSettled();
  });

  it(`${Q.ownerB09082}: B09082 sleeps itself and the selected Chion before stunning the legal target`, () => {
    const state = base(B09082);
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    state.players.opp.scene = [
      makeChar({ cardId: LOW, uid: 'low-target', state: 'active' }),
      makeChar({ cardId: HIGH, uid: 'high-decoy', state: 'active' }),
    ];
    install(state, 'qa-wave24-b09082-positive');
    expect(activate(B09082, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'source')?.state).toBe('sleep');
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    expect(pending('sceneSetState').candidates.map(card => card.uid)).toContain('low-target');
    pick('low-target');
    expect(current().players.opp.scene[0]?.state).toBe('stun');
    expectSettled();
  });

  it(`${Q.ownerD01003}/${Q.activeD01003}: D01003 preserves the exact payer through draw-discard-LP continuation`, () => {
    const state = base(D01003);
    state.players.self.deck = [DRAW, AKAI_1];
    state.players.self.scene.push(
      makeChar({ cardId: PAYER, uid: 'first-payer', state: 'active' }),
      makeChar({ cardId: PAYER, uid: 'chosen-payer', state: 'active' }),
    );
    install(state, 'qa-wave24-d01003-positive');
    expect(activate(D01003, 'chosen-payer')).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === 'first-payer')?.state).toBe('active');
    expect(current().players.self.scene.find(card => card.uid === 'chosen-payer')?.state).toBe('sleep');
    const discard = pending('discard');
    const handCost = discard.candidates.find(card => card.cardId === HAND)!;
    pick(handCost.uid);
    expect(current().players.self.hand).toEqual([DRAW]);
    expect(current().players.self.remove).toContain(HAND);
    expect(current().players.self.scene.find(card => card.uid === 'source')?.turnEffects.lpMod_turn).toBe(1);
    expectSettled();
  });

  it('alternate printings preserve every Wave 24 sleep-cost ability', () => {
    expect([
      B03060P.abilities, B04070P.abilities, B06066P.abilities, B06078P.abilities,
      B07002P.abilities, B07016P.abilities, B07016P2.abilities, B09058P.abilities,
    ]).toEqual([
      B03060.abilities, B04070.abilities, B06066.abilities, B06078.abilities,
      B07002.abilities, B07016.abilities, B07016.abilities, B09058.abilities,
    ]);
  });
});
