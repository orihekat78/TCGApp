import { beforeEach, describe, expect, it } from 'vitest';
import { event } from '@/engine/event/index';
import { _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { runCardScenario } from '../helpers/card-probe-harness';
import { B03042 } from '@/cards/ct-p03/B03042';
import type { CardDef } from '@/engine/types';

const detective = (id: string, colors: string[]): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors, level: 3, ap: 3000, lp: 1,
  traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});
const RED = detective('B03042_RED', ['赤']);
const BLUE = detective('B03042_BLUE', ['青']);
const RED_BLUE = detective('B03042_RED_BLUE', ['赤', '青']);
const DECOY: CardDef = { ...detective('B03042_DECOY', ['黄']), traits: ['警察'] };

describe('B03042', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetRegistry(); _resetUidCounter(); _clearPendingEffectPickQueue();
  });

  it('production dispatch: top-5 window only。共有色候補は選択不能。残りはデッキ下へ', () => {
    runCardScenario(B03042, [RED, BLUE, RED_BLUE, DECOY], {
      setup: { hand: ['B03042'], deckTop: [RED.id, RED_BLUE.id, BLUE.id, DECOY.id, RED.id, RED.id], deckSize: 6, caseColors: ['緑'], partnerColors: ['緑'], fileCount: 4 },
      drive: { kind: 'event-use', cardId: 'B03042' },
      script: [{ pickCardIds: [RED.id, BLUE.id] }],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 0, cardId: DECOY.id },
        { kind: 'zone', cardId: RED.id, zone: 'hand', side: 'self', present: true },
        { kind: 'zone', cardId: BLUE.id, zone: 'hand', side: 'self', present: true },
        { kind: 'zone', cardId: RED.id, zone: 'deck', side: 'self', present: true },
        { kind: 'deckDelta', side: 'self', n: -2 },
      ],
    });
  });

  it('descriptor: a2 hirameki はリムーブの探偵を1枚まで手札へ加える', () => {
    const a2 = B03042.abilities[1]!;
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '探偵' } } });
  });

  it('Q&A: 候補があっても0枚選択できる', () => {
    runCardScenario(B03042, [RED, BLUE], {
      setup: { hand: ['B03042'], deckTop: [RED.id, BLUE.id], deckSize: 2, caseColors: ['緑'], partnerColors: ['緑'], fileCount: 4 },
      drive: { kind: 'event-use', cardId: 'B03042' }, script: ['pick:skip'],
      expect: [
        { kind: 'zone', cardId: RED.id, zone: 'hand', side: 'self', present: false },
        { kind: 'zone', cardId: BLUE.id, zone: 'deck', side: 'self', present: true },
        { kind: 'deckDelta', side: 'self', n: 0 },
      ],
    });
  });
});
