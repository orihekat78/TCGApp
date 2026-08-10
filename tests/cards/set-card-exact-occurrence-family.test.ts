import { beforeEach, describe, expect, it } from 'vitest';
import { B02033 } from '@/cards/ct-p02/B02033';
import { B07031 } from '@/cards/ct-p07/B07031';
import { B07031P } from '@/cards/ct-p07/B07031P';
import { B07055 } from '@/cards/ct-p07/B07055';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { run as runEffect } from '@/engine/effect/resolver';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import { makeChar } from '../helpers/fixtures';

type Atom = Extract<Effect, { kind: 'atom' }>;

function findSetCardRemoval(effect: Effect | undefined): Atom {
  if (!effect) throw new Error('missing effect');
  if (effect.kind === 'atom' && effect.verb === 'charRemoveSetCard') return effect;
  if (effect.kind === 'sequence' || effect.kind === 'chain' || effect.kind === 'parallel') {
    for (const step of effect.steps) {
      try {
        return findSetCardRemoval(step);
      } catch {
        // Search the remaining branches.
      }
    }
  }
  if (effect.kind === 'optional') return findSetCardRemoval(effect.effect);
  throw new Error('charRemoveSetCard not found');
}

function setCardRemoval(card: CardDef): Atom {
  const ability = card.abilities.find(candidate => {
    try {
      findSetCardRemoval(candidate.effect);
      return true;
    } catch {
      return false;
    }
  });
  return findSetCardRemoval(ability?.effect);
}

function containsSetCardRemoval(effect: Effect | undefined): boolean {
  try {
    findSetCardRemoval(effect);
    return true;
  } catch {
    return false;
  }
}

function findSetCardOptional(effect: Effect | undefined): Extract<Effect, { kind: 'optional' }> {
  if (!effect) throw new Error('missing effect');
  if (effect.kind === 'optional' && containsSetCardRemoval(effect.effect)) return effect;
  if (effect.kind === 'sequence' || effect.kind === 'chain' || effect.kind === 'parallel') {
    for (const step of effect.steps) {
      try {
        return findSetCardOptional(step);
      } catch {
        // Search the remaining branches.
      }
    }
  }
  throw new Error('set-card optional not found');
}

function setCardOptional(card: CardDef): Extract<Effect, { kind: 'optional' }> {
  for (const ability of card.abilities) {
    try {
      return findSetCardOptional(ability.effect);
    } catch {
      // Search the remaining abilities.
    }
  }
  throw new Error(`set-card optional not found for ${card.id}`);
}

function plainChar(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: `test/${id}`,
    kind: 'character',
    names: [id],
    colors: ['white'],
    level: 1,
    ap: 9000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...options,
  };
}

function context(card: CardDef, optionalRun: boolean): EffectCtx {
  return {
    source: { cardId: card.id, uid: `${card.id}#source`, abilityId: 'set-card-clause', player: 'self', area: 'scene' },
    bindings: {},
    dyn: { optionalRun },
  };
}

function scenario(card: CardDef, faceUps: boolean[], optionalRun = true): GameState {
  const state = createEmptyGameState();
  registerCardDef(card);
  registerCardDef(plainChar('HOST'));
  registerCardDef(plainChar('TARGET', { colors: ['白'], level: 3, ap: 5000 }));
  for (const [index] of faceUps.entries()) registerCardDef(plainChar(`SECRET_${index}`));
  state.players.self.scene = [makeChar({
    cardId: 'HOST',
    uid: 'host#1',
    state: 'active',
    apOverride: 9000,
    setCards: faceUps.map((faceUp, index) => ({
      cardId: `SECRET_${index}`,
      faceUp,
      instanceId: `set:host:${index}`,
    })) as never,
  })];
  if (card.id === 'B07031' || card.id === 'B07031P') {
    state.players.self.remove = ['TARGET'];
  } else {
    state.players.opp.scene = [makeChar({ cardId: 'TARGET', uid: 'target#1', state: 'sleep', apOverride: 5000 })];
  }
  runEffect(state, setCardOptional(card), context(card, optionalRun));
  _drainAllEffectPicksForTest(state, new HeuristicPolicy());
  return state;
}

function twoHostScenario(card: CardDef): GameState {
  const state = createEmptyGameState();
  registerCardDef(card);
  registerCardDef(plainChar('HOST_A'));
  registerCardDef(plainChar('HOST_B'));
  registerCardDef(plainChar('TARGET', { colors: ['白'], level: 3, ap: 5000 }));
  registerCardDef(plainChar('SECRET_A'));
  registerCardDef(plainChar('SECRET_B'));
  state.players.self.scene = [
    makeChar({ cardId: 'HOST_A', uid: 'host#a', state: 'active', apOverride: 9000, setCards: [{ cardId: 'SECRET_A', faceUp: false, instanceId: 'set:a' }] as never }),
    makeChar({ cardId: 'HOST_B', uid: 'host#b', state: 'active', apOverride: 9000, setCards: [{ cardId: 'SECRET_B', faceUp: false, instanceId: 'set:b' }] as never }),
  ];
  if (card.id === 'B07031' || card.id === 'B07031P') {
    state.players.self.remove = ['TARGET'];
  } else {
    state.players.opp.scene = [makeChar({ cardId: 'TARGET', uid: 'target#1', state: 'sleep', apOverride: 5000 })];
  }
  runEffect(state, setCardOptional(card), context(card, true));
  _drainAllEffectPicksForTest(state, new HeuristicPolicy());
  return state;
}

const family = [B02033, B07031, B07031P, B07055] as const;

function expectContinuation(card: CardDef, state: GameState, expected: boolean): void {
  if (card.id === 'B07031' || card.id === 'B07031P') {
    expect(state.players.self.scene.some(char => char.cardId === 'TARGET')).toBe(expected);
    expect(state.players.self.remove.includes('TARGET')).toBe(!expected);
    return;
  }
  expect(state.players.opp.scene.some(char => char.uid === 'target#1')).toBe(!expected);
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('fixed-two set-card removal family', () => {
  it.each([
    { card: B02033, faceDownOnly: false },
    { card: B07031, faceDownOnly: true },
    { card: B07031P, faceDownOnly: true },
    { card: B07055, faceDownOnly: true },
  ])('$card.id keeps the printed exact count and orientation', ({ card, faceDownOnly }) => {
    const removal = setCardRemoval(card);
    expect(removal.args).toMatchObject({
      player: 'self',
      side: 'self',
      n: 2,
      minimumPolicy: 'exact',
      filter: { hasSetCards: true },
    });
    expect(removal.args.faceDownOnly === true).toBe(faceDownOnly);
  });

  it.each(family)('$id removes two physical occurrences from one host before its continuation', (card) => {
    const state = scenario(card, [false, false]);
    expect(state.players.self.scene.find(char => char.uid === 'host#1')?.setCards).toEqual([]);
    expect(state.players.self.remove).toEqual(expect.arrayContaining(['SECRET_0', 'SECRET_1']));
    expectContinuation(card, state, true);
  });

  it.each(family)('$id may combine one occurrence from each of two hosts', (card) => {
    const state = twoHostScenario(card);
    expect(state.players.self.scene.filter(char => char.uid.startsWith('host#')).every(char => char.setCards.length === 0)).toBe(true);
    expect(state.players.self.remove).toEqual(expect.arrayContaining(['SECRET_A', 'SECRET_B']));
    expectContinuation(card, state, true);
  });

  it.each(family)('$id treats one eligible occurrence as an exact-payment failure', (card) => {
    const state = scenario(card, [false]);
    expect(state.players.self.scene.find(char => char.uid === 'host#1')?.setCards).toHaveLength(1);
    expect(state.players.self.remove).not.toContain('SECRET_0');
    expectContinuation(card, state, false);
  });

  it.each(family)('$id honors an optional decline without removing or continuing', (card) => {
    const state = scenario(card, [false, false], false);
    expect(state.players.self.scene.find(char => char.uid === 'host#1')?.setCards).toHaveLength(2);
    expect(state.players.self.remove).not.toEqual(expect.arrayContaining(['SECRET_0', 'SECRET_1']));
    expectContinuation(card, state, false);
  });

  it('B02033 accepts a mixed face-up/face-down pair', () => {
    const state = scenario(B02033, [true, false]);
    expect(state.players.self.scene.find(char => char.uid === 'host#1')?.setCards).toEqual([]);
    expectContinuation(B02033, state, true);
  });

  it.each([B07031, B07031P, B07055])('$id excludes face-up set cards from the exact pair', (card) => {
    const state = scenario(card, [true, false]);
    expect(state.players.self.scene.find(char => char.uid === 'host#1')?.setCards).toHaveLength(2);
    expect(state.players.self.remove).not.toEqual(expect.arrayContaining(['SECRET_0', 'SECRET_1']));
    expectContinuation(card, state, false);
  });
});
