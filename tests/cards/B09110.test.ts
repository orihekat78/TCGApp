import { describe, expect, it } from 'vitest';
import { B09110 } from '@/cards/ct-p09/B09110';
import { B09110P } from '@/cards/ct-p09/B09110P';
import { runCardScenario } from '../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const victim: CardDef = { id: 'B09110_VICTIM', no: 'test/V', kind: 'character', names: ['A&B', 'A', 'B'], colors: ['青'], level: 7, ap: 1, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const decoy: CardDef = { ...victim, id: 'B09110_DECOY', names: ['X'] };
const match: CardDef = { ...victim, id: 'B09110_MATCH', names: ['B'] };
const tail: CardDef = { ...victim, id: 'B09110_TAIL', names: ['Z'] };
const tail2: CardDef = { ...victim, id: 'B09110_TAIL2', names: ['Y'] };

describe('B09110 赤井秀一&ジン', () => {
  it('P is structural twin without shared definition identity', () => {
    const printed = (card: CardDef) => ({ ...card, id: '', no: '', rarity: '', imageUrl: '' });
    expect(printed(B09110P)).toEqual(printed(B09110));
    expect(B09110P.abilities).not.toBe(B09110.abilities);
  });

  it('production enter dispatch snapshots every removed split-name, reveals through its match, then removes the window', () => {
    const state = runCardScenario(B09110, [victim, decoy, match, tail, tail2], {
      name: 'B09110 enter removed-name snapshot',
      setup: { caseStatus: '事件編', caseColors: ['赤', '黒'], oppDeckSize: 0, selfScene: [{ cardId: 'B09110', uid: 'host' }], oppScene: [{ cardId: victim.id, uid: 'victim' }], oppDeckTop: [decoy.id, match.id, tail.id, tail2.id] },
      drive: { kind: 'enter', cardId: 'B09110', uid: 'host' }, script: [{ pickUid: 'victim' }],
      expect: [],
    });
    expect(state.log).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'effect:sceneRemove', target: 'victim' })]));
    const reveal = state.log.find(x => x.action === 'effect:deckRevealUntil')!;
    const moved = state.log.find(x => x.action === 'effect:boundToRemove')!;
    expect(reveal.result).toBe('revealed=2 matched=B09110_MATCH');
    expect(moved.result).toBe('2');
    expect(state.players.opp.deck).toEqual([tail.id, tail2.id]);
    expect(state.log.some(x => x.action === 'refresh')).toBe(false);
  });

  it('refreshes only at the explicit empty-deck boundary after the two-card reveal window moves', () => {
    const state = runCardScenario(B09110, [victim, decoy, match], {
      name: 'B09110 two-card window refresh boundary',
      setup: { caseStatus: '\u4e8b\u4ef6\u7de8', caseColors: B09110.colors, oppDeckSize: 0, selfScene: [{ cardId: 'B09110', uid: 'host' }], oppScene: [{ cardId: victim.id, uid: 'victim' }], oppDeckTop: [decoy.id, match.id] },
      drive: { kind: 'enter', cardId: 'B09110', uid: 'host' }, script: [{ pickUid: 'victim' }], expect: [],
    });
    expect(state.log.find(x => x.action === 'effect:deckRevealUntil')?.result).toBe('revealed=2 matched=B09110_MATCH');
    expect(state.log.some(x => x.action === 'refresh')).toBe(true);
  });
});
