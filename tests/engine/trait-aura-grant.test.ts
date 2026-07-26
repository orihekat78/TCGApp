import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { mutate } from '@/engine/mutate';
import { char as charRead } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import { sceneChar } from '../helpers/fixtures';
import type { AbilityDef, CardDef, Condition, ContinuousModifier, GameState } from '@/engine/types';

const OFFICE = '毛利探偵事務所';
const AURA = (over: Partial<AbilityDef> = {}): AbilityDef => ({
  id: 'office-aura', type: 'continuous', scope: 'on-scene',
  continuousModifier: {
    grantTraitsAura: [OFFICE],
    auraFilter: { kind: 'character', cardName: '妃英理' },
  } as unknown as ContinuousModifier,
  description: '自分の現場にいる妃英理は毛利探偵事務所を持つ。', ruleRefs: [], ...over,
});

function char(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const HOLDER = char('HOLDER', { abilities: [AURA()] });
const ALL_HOLDER = char('ALL_HOLDER', { abilities: [AURA({ continuousModifier: { grantTraitsAura: [OFFICE] } as unknown as ContinuousModifier })] });
const TURN_HOLDER = char('TURN_HOLDER', { abilities: [AURA({ condition: { kind: 'turn', player: 'self' } })] });
const HAND_SCOPE_HOLDER = char('HAND_SCOPE_HOLDER', { abilities: [AURA({ scope: 'on-hand' })] });
const ERI = char('ERI', { names: ['妃英理'], traits: ['弁護士'] });
const OTHER = char('OTHER', { names: ['毛利蘭'], traits: ['高校生'] });
const TRAIT_ALL = char('TRAIT_ALL', { traits: ['A'] });
const TRAIT_AURA = char('TRAIT_AURA', { abilities: [AURA({ continuousModifier: { grantTraitsAura: [OFFICE], auraFilter: { kind: 'character', traitAll: ['A', 'B'] } } as unknown as ContinuousModifier })] });
const RECURSIVE_HOLDER = char('RECURSIVE_HOLDER', { abilities: [AURA({ continuousModifier: { grantTraitsAura: ['B'], auraFilter: { kind: 'character', trait: 'B' } } as unknown as ContinuousModifier })] });
const BLANK = char('BLANK');

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

function sceneTraitUids(s: GameState): string[] {
  return candidates(s, { kind: 'all', query: { area: 'scene', side: 'self', filter: { trait: OFFICE } } } as never, { source: { player: 'self', area: 'scene' }, bindings: {} })
    .filter(candidate => candidate.kind === 'char').map(candidate => candidate.uid).sort();
}

beforeEach(() => {
  _resetRegistry();
  [HOLDER, ALL_HOLDER, TURN_HOLDER, HAND_SCOPE_HOLDER, ERI, OTHER, TRAIT_ALL, TRAIT_AURA, RECURSIVE_HOLDER, BLANK].forEach(register);
});

describe('continuous grantTraitsAura', () => {
  it('shares effective traits between display reader, target filter, and distinct-name sceneHas without affecting the opponent', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(HOLDER.id, 'holder'), sceneChar(ERI.id, 'eri'), sceneChar(OTHER.id, 'other'));
    s.players.opp.scene.push(sceneChar(ERI.id, 'opp-eri'));

    expect(charRead.traits(s, 'eri').sort()).toEqual(['弁護士', OFFICE]);
    expect(sceneTraitUids(s)).toEqual(['eri']);
    expect(evalCond(s, { kind: 'sceneHas', query: { area: 'scene', side: 'self', distinctNames: true, filter: { trait: OFFICE } }, nMin: 1 } as Condition, { source: { player: 'self', uid: 'holder', area: 'scene' }, bindings: {} })).toBe(true);
    expect(charRead.traits(s, 'opp-eri')).toEqual(['弁護士']);
  });

  it('can include both aura bearer and another own character, never the opponent side', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(ALL_HOLDER.id, 'holder'), sceneChar(OTHER.id, 'other'));
    s.players.opp.scene.push(sceneChar(OTHER.id, 'opp-other'));

    expect(charRead.traits(s, 'holder')).toContain(OFFICE);
    expect(charRead.traits(s, 'other')).toContain(OFFICE);
    expect(charRead.traits(s, 'opp-other')).not.toContain(OFFICE);
  });

  it('stops immediately when its holder leaves or its original text is disabled', () => {
    const s = state();
    const holder = sceneChar(HOLDER.id, 'holder');
    s.players.self.scene.push(holder, sceneChar(ERI.id, 'eri'));
    expect(charRead.traits(s, 'eri')).toContain(OFFICE);

    holder.keywordOverrides.disabledOriginal = true;
    expect(charRead.traits(s, 'eri')).not.toContain(OFFICE);
    holder.keywordOverrides.disabledOriginal = false;
    mutate.scene.removeToRemove(s, holder.uid, 'effect');
    expect(charRead.traits(s, 'eri')).not.toContain(OFFICE);
  });

  it('uses the bearer’s own condition and ignores an aura declared outside its active scope', () => {
    const conditioned = state();
    conditioned.players.self.scene.push(sceneChar(TURN_HOLDER.id, 'holder'), sceneChar(ERI.id, 'eri'));
    expect(charRead.traits(conditioned, 'eri')).toContain(OFFICE);
    conditioned.turn.player = 'opp';
    expect(charRead.traits(conditioned, 'eri')).not.toContain(OFFICE);

    const wrongScope = state();
    wrongScope.players.self.scene.push(sceneChar(HAND_SCOPE_HOLDER.id, 'hand-holder'), sceneChar(ERI.id, 'scope-eri'));
    expect(charRead.traits(wrongScope, 'scope-eri')).not.toContain(OFFICE);
  });

  it('honors traitAll filters using temporary traits and does not erase those temporary grants after the aura disappears', () => {
    const s = state();
    const holder = sceneChar(TRAIT_AURA.id, 'holder');
    const target = sceneChar(TRAIT_ALL.id, 'target');
    s.players.self.scene.push(holder, target);
    mutate.char.grantTrait(s, target.uid, 'B', 'turn');

    expect(charRead.traits(s, target.uid).sort()).toEqual(['A', 'B', OFFICE]);
    mutate.scene.removeToRemove(s, holder.uid, 'effect');
    expect(charRead.traits(s, target.uid).sort()).toEqual(['A', 'B']);
  });

  it('deduplicates overlapping auras while preserving a target’s printed trait', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(HOLDER.id, 'one'), sceneChar(HOLDER.id, 'two'), sceneChar(ERI.id, 'eri'));

    expect(charRead.traits(s, 'eri').filter(trait => trait === OFFICE)).toHaveLength(1);
    expect(charRead.traits(s, 'eri')).toContain('弁護士');
  });

  it('does not bootstrap a trait aura from the very trait it is trying to grant', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(RECURSIVE_HOLDER.id, 'holder'), sceneChar(BLANK.id, 'blank'));

    expect(charRead.traits(s, 'blank')).not.toContain('B');
  });
});
