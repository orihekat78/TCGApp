// qa: card:B05016:e7061b1c3b542622fb32f13182df05bfa258159452eb60cb75a2c492259385d4
// qa: card:B06048:e7061b1c3b542622fb32f13182df05bfa258159452eb60cb75a2c492259385d4
// qa: card:B06098:ffbbf31e863a23cc673a4129010f507e5c8fcf62c699d9dee26061eb41f63b14
// qa: card:B07035:e501456258551214158642016474ea2c0c3102239185d5ad41ddcbf5bf4e5a43
// qa: card:B08050:e7061b1c3b542622fb32f13182df05bfa258159452eb60cb75a2c492259385d4
// qa: card:B09073:69f4c272bb583d1196718f3af714db7147ef16e12ec51fc479a7965b60ada527
// qa: card:B09078:e7061b1c3b542622fb32f13182df05bfa258159452eb60cb75a2c492259385d4
// qa: card:B09079:e501456258551214158642016474ea2c0c3102239185d5ad41ddcbf5bf4e5a43
// qa: card:B10077:e7061b1c3b542622fb32f13182df05bfa258159452eb60cb75a2c492259385d4
// qa: card:B10097:cbba73447c81849eef2d9ca4d38c93605ca1d1733e403bbf003c73f190c42998
// Rules: viewed cards remain in the deck until the remainder moves to remove;
// only that completed move may observe deck zero and perform refresh.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ALL_CARDS, registerAll } from '@/cards';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

type Route = 'enter' | 'partner-declared' | 'leave' | 'partner-end';
type Row = { cardId: string; abilityId: string; route: Route };

const ROWS: readonly Row[] = [
  { cardId: 'B05016', abilityId: 'a1', route: 'enter' },
  { cardId: 'B06048', abilityId: 'a1', route: 'enter' },
  { cardId: 'B06098', abilityId: 'a2', route: 'partner-declared' },
  { cardId: 'B07035', abilityId: 'a1', route: 'enter' },
  { cardId: 'B08050', abilityId: 'a2', route: 'enter' },
  { cardId: 'B09073', abilityId: 'a2', route: 'leave' },
  { cardId: 'B09078', abilityId: 'a1', route: 'enter' },
  { cardId: 'B09079', abilityId: 'a1', route: 'enter' },
  { cardId: 'B10077', abilityId: 'a2', route: 'enter' },
  { cardId: 'B10097', abilityId: 'a2', route: 'partner-end' },
];

const DECOY_A = 'W51-DECOY-A';
const DECOY_B = 'W51-DECOY-B';
const REFRESH_SEED = 'W51-REFRESH-SEED';
const ATTACKER = 'W51-ATTACKER';
const BLACK_A = 'W51-BLACK-A';
const BLACK_B = 'W51-BLACK-B';

function fixture(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['青'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...overrides,
  };
}

type AtomShape = { verb: string; args: Record<string, unknown> };

function collectAtoms(node: unknown): AtomShape[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(collectAtoms);
  const value = node as Record<string, unknown>;
  if (value.kind === 'atom' && typeof value.verb === 'string') {
    return [{ verb: value.verb, args: (value.args ?? {}) as Record<string, unknown> }];
  }
  return ['steps', 'then', 'else', 'effect', 'body', 'options']
    .flatMap(key => collectAtoms(value[key]));
}

function assertRefreshCheckpointContract(node: unknown, label: string): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((child, index) => assertRefreshCheckpointContract(child, `${label}[${index}]`));
    return;
  }
  const value = node as Record<string, unknown>;
  if (value.kind === 'sequence') {
    const atoms = collectAtoms(value);
    for (const reveal of atoms.filter(atom => atom.verb === 'deckRevealUntil')) {
      if (typeof reveal.args.bind !== 'string') continue;
      const handAdds = atoms.filter(atom => atom.verb === 'handAddFromDeck');
      const remainders = atoms.filter(atom => (
        atom.verb === 'boundToRemove' && atom.args.bindKey === reveal.args.bind
      ));
      if (handAdds.length === 0 || remainders.length === 0) continue;
      handAdds.forEach(atom => {
        expect(atom.args.deferRefresh, `${label}: handAddFromDeck must defer refresh`).toBe(true);
      });
      remainders.forEach(atom => {
        expect(atom.args.refreshAfter, `${label}: boundToRemove owns refresh`).toBe(true);
      });
    }
  }
  ['steps', 'then', 'else', 'effect', 'body', 'options']
    .forEach(key => assertRefreshCheckpointContract(value[key], `${label}.${key}`));
}

function targetFor(cardId: string): CardDef {
  const id = `W51-TARGET-${cardId}`;
  switch (cardId) {
    case 'B05016': return fixture(id, { traits: ['少年探偵団'] });
    case 'B06048': return fixture(id, { traits: ['YAIBA'] });
    case 'B06098': return fixture(id, { colors: ['黒'], level: 3, keywords: ['カットイン'] });
    case 'B07035': return fixture(id, { names: ['黒羽快斗'] });
    case 'B08050': return fixture(id, { names: ['諸星大'] });
    case 'B09073': return fixture(id, { level: 7, keywords: ['疾風'] });
    case 'B09079': return fixture(id, { names: ['高木渉'] });
    case 'B10077': return fixture(id, { names: ['降谷零'] });
    case 'B10097': return fixture(id, { names: ['工藤新一'], level: 4 });
    default: throw new Error(`${cardId}: no single-choice target`);
  }
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave51 game state');
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(`qa-wave51-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function base(row: Row, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = {
    number: 6, player: row.route === 'leave' ? 'opp' : 'self',
    phase: 'main', isFirstPlayerFirstTurn: false,
  };
  state.players.self.case.colors = ['赤', '青', '緑', '黄', '白', '黒'];
  state.players.self.case.status = ['B06048', 'B07035', 'B09078'].includes(row.cardId)
    ? '事件編'
    : '解決編';
  state.players.self.file = Array.from(
    { length: 10 }, () => ({ type: 'card-back' as const, cardId: 'W51-FILE' }),
  );
  state.players.self.deck = [...deck];
  state.players.self.remove = [REFRESH_SEED];
  state.players.opp.deck = [DECOY_A, DECOY_B];

  if (row.route === 'enter') state.players.self.hand = [row.cardId];
  if (row.route === 'partner-declared') {
    state.players.self.partnerAreaMR = makeChar({ cardId: row.cardId, uid: 'partnerMR:self' });
    state.players.self.scene = [
      makeChar({ cardId: BLACK_A, uid: 'black-a' }),
      makeChar({ cardId: BLACK_B, uid: 'black-b' }),
    ];
  }
  if (row.route === 'partner-end') {
    state.players.self.partnerAreaMR = makeChar({ cardId: row.cardId, uid: 'partnerMR:self' });
  }
  if (row.route === 'leave') {
    state.players.self.scene = [makeChar({ cardId: row.cardId, uid: 'source', state: 'sleep' })];
    state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker' })];
  }
  return state;
}

function removeThroughPublicContact(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } }))
    .toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function trigger(row: Row): void {
  if (row.route === 'enter') {
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: row.cardId }))
      .toEqual({ ok: true });
    return;
  }
  if (row.route === 'partner-declared') {
    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'partnerMR:self', abilId: row.abilityId }))
      .toEqual({ ok: true });
    return;
  }
  if (row.route === 'partner-end') {
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    return;
  }
  removeThroughPublicContact();
}

function resolveDecline(): void {
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: null,
  }))).toEqual({ ok: true });
}

function prove(row: Row): string {
  const b09078 = row.cardId === 'B09078';
  const target = b09078
    ? fixture('W51-B09078-CHAR', { colors: ['白'] })
    : targetFor(row.cardId);
  const second = b09078
    ? fixture('W51-B09078-EVENT', { kind: 'event', colors: ['黄'], ap: undefined, lp: undefined })
    : fixture(DECOY_A);
  register(target);
  if (b09078) register(second);
  const looked = [target.id, second.id, DECOY_B];
  install(base(row, looked), row.cardId);

  trigger(row);
  const firstPick = useGameStateStore.getState().pendingEffectPick;
  expect(firstPick?.source).toMatchObject({ cardId: row.cardId, abilityId: row.abilityId });
  expect(current().players.self.deck, `${row.cardId}: looked cards remain in deck`).toEqual(looked);
  expect(current().players.opp.evidence, `${row.cardId}: no early refresh`).toHaveLength(0);
  expect(current().players.self.remove).toContain(REFRESH_SEED);

  resolveDecline();
  if (b09078) {
    expect(current().players.self.deck, 'B09078: first choice still does not refresh').toEqual(looked);
    expect(current().players.opp.evidence, 'B09078: no refresh between two choices').toHaveLength(0);
    resolveDecline();
  }
  expect(useGameStateStore.getState().pendingEffectPick, `${row.cardId}: decisions settled`).toBeNull();

  const expectedRefreshed = [REFRESH_SEED, ...looked, ...(row.route === 'leave' ? [row.cardId] : [])];
  expect([...current().players.self.deck].sort(), `${row.cardId}: refresh after remainder move`)
    .toEqual([...expectedRefreshed].sort());
  expect(current().players.self.remove, `${row.cardId}: remove shuffled by refresh`).toEqual([]);
  expect(current().players.opp.evidence, `${row.cardId}: refresh evidence`).toHaveLength(1);
  expect(current().players.self.hand, `${row.cardId}: declined match not added`).not.toContain(target.id);
  return row.cardId;
}

function proveSelected(row: Row, deckSize: 1 | 2 | 3): string {
  const target = row.cardId === 'B09078'
    ? fixture('W51-B09078-SELECTED-CHAR', { colors: ['白'] })
    : targetFor(row.cardId);
  register(target);
  const looked = [target.id, ...(deckSize >= 2 ? [DECOY_A] : []), ...(deckSize >= 3 ? [DECOY_B] : [])];
  install(base(row, looked), `${row.cardId}-selected-${deckSize}`);

  trigger(row);
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.source).toMatchObject({ cardId: row.cardId, abilityId: row.abilityId });
  // Card-bound matrix: B05016 B06048 B06098 B07035 B08050 B09073 B09078
  // B09079 B10077 B10097. Each row uses its real public source route.
  expect(current().players.self.deck, `${row.cardId}/${deckSize}: look is not a take`).toEqual(looked);
  expect(current().refreshCount.self, `${row.cardId}/${deckSize}: no early refresh`).toBe(0);
  expect(current().players.opp.evidence).toHaveLength(0);
  const selected = pending?.candidates.find(candidate => candidate.cardId === target.id);
  expect(selected, `${row.cardId}/${deckSize}: eligible card`).toBeTruthy();
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve', pickedUid: selected!.uid,
  }))).toEqual({ ok: true });

  if (row.cardId === 'B09078') {
    const eventPick = useGameStateStore.getState().pendingEffectPick;
    if (eventPick) {
      expect(eventPick.atomVerb).toBe('handAddFromDeck');
      expect(eventPick.candidates).toEqual([]);
      resolveDecline();
    }
  }
  expect(useGameStateStore.getState().pendingEffectPick, `${row.cardId}: selected route settled`).toBeNull();

  const expectedDeck = [
    REFRESH_SEED,
    ...looked.slice(1),
    ...(row.route === 'leave' ? [row.cardId] : []),
  ];
  expect([...current().players.self.deck].sort(), `${row.cardId}/${deckSize}: refreshed remainder`)
    .toEqual([...expectedDeck].sort());
  expect(current().players.self.remove).toEqual([]);
  expect(current().players.self.hand).toContain(target.id);
  expect(current().refreshCount.self).toBe(1);
  expect(current().players.opp.evidence).toHaveLength(1);

  // Card-bound order assertion for B05016 B06048 B06098 B07035 B08050
  // B09073 B09078 B09079 B10077 B10097.
  const actions = current().log.map(entry => entry.action);
  const boundIndex = actions.lastIndexOf('effect:boundToRemove');
  const refreshIndex = actions.lastIndexOf('refresh');
  expect(boundIndex, `${row.cardId}/${deckSize}: remainder checkpoint`).toBeGreaterThanOrEqual(0);
  expect(refreshIndex, `${row.cardId}/${deckSize}: refresh after checkpoint`).toBeGreaterThan(boundIndex);
  return row.cardId;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    fixture(DECOY_A), fixture(DECOY_B), fixture(REFRESH_SEED),
    fixture(ATTACKER, { ap: 9000 }),
    fixture(BLACK_A, { traits: ['黒ずくめの組織'] }),
    fixture(BLACK_B, { traits: ['黒ずくめの組織'] }),
  ].forEach(register);
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('Wave51 official-QA deck-look refresh timing', () => {
  it.each(ROWS)('$cardId refreshes only after its public remainder move', row => {
    expect(prove(row)).toBe(row.cardId);
  });

  const selectedCases = ROWS.flatMap(row => ([1, 2, 3] as const).map(deckSize => ({
    cardId: row.cardId, row, deckSize,
  })));
  it.each(selectedCases)('$cardId deck=$deckSize refreshes after selected-card remainder handling', ({ row, deckSize }) => {
    expect(proveSelected(row, deckSize)).toBe(row.cardId);
  });

  it('B09078 refreshes its remainder before the two-card discard', () => {
    const row = ROWS.find(candidate => candidate.cardId === 'B09078')!;
    const selectedCharacter = fixture('W51-B09078-BOTH-CHAR', { colors: ['白'] });
    const selectedEvent = fixture('W51-B09078-BOTH-EVENT', {
      kind: 'event', colors: ['黄'], ap: undefined, lp: undefined,
    });
    register(selectedCharacter);
    register(selectedEvent);
    const looked = [selectedCharacter.id, selectedEvent.id, DECOY_B];
    install(base(row, looked), 'B09078-both-selected');

    trigger(row);
    const characterPick = useGameStateStore.getState().pendingEffectPick!;
    const character = characterPick.candidates.find(candidate => candidate.cardId === selectedCharacter.id)!;
    expect(dispatchEngineAction(bindPendingDecision(characterPick, {
      type: 'effectPickResolve', pickedUid: character.uid,
    }))).toEqual({ ok: true });

    const eventPick = useGameStateStore.getState().pendingEffectPick!;
    const eventCard = eventPick.candidates.find(candidate => candidate.cardId === selectedEvent.id)!;
    expect(dispatchEngineAction(bindPendingDecision(eventPick, {
      type: 'effectPickResolve', pickedUid: eventCard.uid,
    }))).toEqual({ ok: true });

    const discard = useGameStateStore.getState().pendingEffectPick!;
    expect(discard.atomVerb).toBe('discard');
    expect(current().refreshCount.self, 'B09078: refresh precedes discard').toBe(1);
    expect([...current().players.self.deck].sort()).toEqual([DECOY_B, REFRESH_SEED].sort());
    expect(current().players.self.remove).toEqual([]);
    expect(current().players.self.hand.slice().sort())
      .toEqual([selectedCharacter.id, selectedEvent.id].sort());

    const discarded = discard.candidates.find(candidate => candidate.cardId === selectedCharacter.id)!;
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: discarded.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.remove).toEqual([selectedCharacter.id]);
    expect(current().players.self.deck).not.toContain(selectedCharacter.id);
    expect(current().players.self.hand).toEqual([selectedEvent.id]);
  });

  it('keeps every shipped look-hand-remove descriptor on the remainder refresh contract', () => {
    for (const card of ALL_CARDS) {
      for (const ability of card.abilities) {
        if ('effect' in ability) {
          assertRefreshCheckpointContract(ability.effect, `${card.id}:${ability.id}`);
        }
      }
    }
  });

  it('B07015 refreshes its remainder before its partner-area discard', () => {
    const hattori = fixture('W51-B07015-HATTORI', { names: ['服部平次'], colors: ['緑'] });
    const greenEvent = fixture('W51-B07015-EVENT', {
      kind: 'event', colors: ['緑'], level: 5, ap: undefined, lp: undefined,
    });
    register(hattori);
    register(greenEvent);
    const state = createEmptyGameState();
    state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['緑'];
    state.players.self.file = Array.from(
      { length: 10 }, () => ({ type: 'card-back' as const, cardId: 'W51-FILE' }),
    );
    state.players.self.partnerAreaMR = makeChar({ cardId: 'B07015', uid: 'partnerMR:self' });
    state.players.self.hand = [hattori.id];
    state.players.self.deck = [greenEvent.id];
    state.players.self.remove = [REFRESH_SEED];
    install(state, 'B07015-selected');

    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: hattori.id }))
      .toEqual({ ok: true });
    const reveal = useGameStateStore.getState().pendingEffectPick!;
    const selected = reveal.candidates.find(candidate => candidate.cardId === greenEvent.id)!;
    expect(dispatchEngineAction(bindPendingDecision(reveal, {
      type: 'effectPickResolve', pickedUid: selected.uid,
    }))).toEqual({ ok: true });

    const discard = useGameStateStore.getState().pendingEffectPick!;
    expect(discard.atomVerb).toBe('discard');
    expect(current().refreshCount.self).toBe(1);
    expect(current().players.self.deck).toEqual([REFRESH_SEED]);
    expect(current().players.self.remove).toEqual([]);

    const discarded = discard.candidates.find(candidate => candidate.cardId === greenEvent.id)!;
    expect(dispatchEngineAction(bindPendingDecision(discard, {
      type: 'effectPickResolve', pickedUid: discarded.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.remove).toEqual([greenEvent.id]);
    expect(current().players.self.deck).toEqual([REFRESH_SEED]);
  });

  it('B09078 no-human zero choices consume once and reach the remainder refresh', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const row = ROWS.find(candidate => candidate.cardId === 'B09078')!;
    const state = base(row, [DECOY_A, DECOY_B]);
    install(state, 'B09078-no-human-zero');

    trigger(row);

    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(current().refreshCount.self).toBe(1);
    expect([...current().players.self.deck].sort())
      .toEqual([DECOY_A, DECOY_B, REFRESH_SEED].sort());
    expect(current().players.self.remove).toEqual([]);
    const actions = current().log.map(entry => entry.action);
    expect(actions.lastIndexOf('refresh')).toBeGreaterThan(actions.lastIndexOf('effect:boundToRemove'));
  });
});
