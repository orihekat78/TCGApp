// B04055 — removal observer + removed-trait deck reveal.
// rules: 15-abilities-effects, 25-qa-effects-resolution; card Q&A
import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';
import { sceneChar } from '../helpers/fixtures';
import { B04055 } from '@/cards/ct-p04/B04055';

const RED_VICTIM: CardDef = { id: 'RED_VICTIM', no: 'RED_VICTIM', kind: 'character', names: ['red victim'], colors: ['赤'], level: 1, ap: 1000, lp: 1, traits: ['FBI'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const BLUE_VICTIM: CardDef = { id: 'BLUE_VICTIM', no: 'BLUE_VICTIM', kind: 'character', names: ['blue victim'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: ['FBI'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const MATCH: CardDef = { id: 'MATCH', no: 'MATCH', kind: 'character', names: ['match'], colors: ['黄'], level: 1, ap: 1000, lp: 1, traits: ['FBI'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const DECOY: CardDef = { id: 'DECOY', no: 'DECOY', kind: 'character', names: ['decoy'], colors: ['黄'], level: 1, ap: 1000, lp: 1, traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter => sceneChar(cardId, uid, { state });

function board(opts: { turn?: 'self' | 'opp'; hostState?: 'active' | 'sleep'; victim?: 'RED_VICTIM' | 'BLUE_VICTIM'; deck?: string[] } = {}): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: opts.turn ?? 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sc('B04055', 'amanda', opts.hostState ?? 'sleep'), sc(opts.victim ?? 'RED_VICTIM', 'victim')];
  s.players.self.deck = opts.deck ?? ['MATCH', 'TAIL'];
  return s;
}

function removeVictim(s: GameState): GameState {
  return produce(s, d => {
    mutate.scene.removeToRemove(d, 'victim', 'effect', undefined, { byPlayer: 'opp' });
    runAllUntilEmpty(d);
  });
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); resetDefRegistry(); _resetUidCounter();
  for (const d of [B04055, RED_VICTIM, BLUE_VICTIM, MATCH, DECOY]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B04055 アマンダ・ヒューズ a1', () => {
  it('opponent turn: a sleeping Amanda observes another own red removal and must add a sharing reveal', () => {
    const after = removeVictim(board());
    expect(after.players.self.hand).toEqual(['MATCH']);
    expect(after.players.self.deck).toEqual(['TAIL']);
  });

  it('non-sharing reveal goes to deck bottom, never hand', () => {
    const after = removeVictim(board({ deck: ['DECOY', 'TAIL'] }));
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.deck).toEqual(['TAIL', 'DECOY']);
  });

  it.each([
    ['own turn', { turn: 'self' as const }],
    ['Amanda active', { hostState: 'active' as const }],
    ['other color', { victim: 'BLUE_VICTIM' as const }],
  ])('%s does not trigger', (_label, opts) => {
    const after = removeVictim(board(opts));
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.deck).toEqual(['MATCH', 'TAIL']);
  });

  it('turn 1: a second qualifying removal in the same turn cannot reveal again', () => {
    const after = produce(board(), d => {
      mutate.scene.removeToRemove(d, 'victim', 'effect', undefined, { byPlayer: 'opp' });
      runAllUntilEmpty(d);
      d.players.self.scene.push(sc('RED_VICTIM', 'victim2'));
      d.players.self.deck.push('MATCH');
      mutate.scene.removeToRemove(d, 'victim2', 'effect', undefined, { byPlayer: 'opp' });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand).toEqual(['MATCH']);
    expect(after.players.self.deck).toEqual(['TAIL', 'MATCH']);
  });

  it('simultaneous removal Q&A: Amanda absent at resolution cannot trigger', () => {
    const after = produce(board(), d => {
      mutate.scene.removeToRemove(d, 'amanda', 'effect', undefined, { byPlayer: 'opp' });
      mutate.scene.removeToRemove(d, 'victim', 'effect', undefined, { byPlayer: 'opp' });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.deck).toEqual(['MATCH', 'TAIL']);
  });
});
