import { describe, expect, it } from 'vitest';
import { B04042 } from '@/cards/ct-p04/B04042';
import { B04042P } from '@/cards/ct-p04/B04042P';
import { B04084 } from '@/cards/ct-p04/B04084';
import { runCardScenario } from '../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const char = (id: string, level: number): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['白'], level, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});
const LV6 = char('AGG_LV6', 6);
const LV5 = char('AGG_LV5', 5);
const LV4 = char('AGG_LV4', 4);
const POL6 = { ...char('POL_LV6', 6), traits: ['警察'] };
const POL5 = { ...char('POL_LV5', 5), traits: ['警察'] };
const POL4 = { ...char('POL_LV4', 4), traits: ['警察'] };
const COST1 = char('B04084_COST1', 1);
const COST2 = char('B04084_COST2', 1);

describe('B04042/B04042P aggregate level pick', () => {
  it('uses the shared aggregate level cap for up to two scene characters', () => {
    for (const card of [B04042, B04042P]) {
      const effect = card.abilities[0]!.effect as {
        kind: string;
        args?: Record<string, unknown>;
      };
      expect(effect.kind).toBe('atom');
      expect(effect.args).toMatchObject({
        player: 'self',
        side: 'either',
        state: 'stun',
        max: 2,
        aggregateLevelMax: 10,
      });
    }
  });

  it('production dispatch stuns only a human-selected legal aggregate set', () => {
    runCardScenario(B04042, [LV6, LV5, LV4], {
      name: 'B04042 legal aggregate pick',
      setup: {
        hand: ['B04042'],
        caseColors: ['白'],
        partnerColors: ['白'],
        caseStatus: '解決編',
        fileCount: 6,
        selfScene: [{ cardId: LV6.id, uid: 'lv6' }],
        oppScene: [{ cardId: LV5.id, uid: 'lv5' }, { cardId: LV4.id, uid: 'lv4' }],
      },
      drive: { kind: 'event-use', cardId: 'B04042' },
      script: [{ pickCardIds: [LV6.id, LV4.id] }],
      expect: [
        { kind: 'state', uid: 'lv6', state: 'stun' },
        { kind: 'state', uid: 'lv4', state: 'stun' },
        { kind: 'state', uid: 'lv5', state: 'active' },
      ],
    });
  });
});

describe('B04084 aggregate pick and split deployment', () => {
  it('does not partially discard an exact two-card prerequisite', () => {
    runCardScenario(B04084, [POL6, COST1], {
      name: 'B04084 exact discard prerequisite is unavailable',
      setup: {
        hand: ['B04084', COST1.id],
        remove: [POL6.id],
        caseColors: ['黄'],
        partnerColors: ['黄'],
        caseStatus: '解決編',
        fileCount: 8,
      },
      drive: { kind: 'event-use', cardId: 'B04084' },
      script: ['optional:take'],
      expect: [
        { kind: 'zone', side: 'self', zone: 'hand', cardId: COST1.id, present: true },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: COST1.id, present: false },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: POL6.id, present: true },
      ],
    });
  });

  it('discards exactly two, then enters one active and the remaining selected card asleep', () => {
    const state = runCardScenario(B04084, [POL6, POL5, POL4, COST1, COST2], {
      name: 'B04084 aggregate select then split enter',
      setup: {
        hand: ['B04084', COST1.id, COST2.id],
        remove: [POL6.id, POL5.id, POL4.id],
        caseColors: ['黄'],
        partnerColors: ['黄'],
        caseStatus: '解決編',
        fileCount: 8,
      },
      drive: { kind: 'event-use', cardId: 'B04084' },
      script: [
        'optional:take',
        { pickCardIds: [COST1.id, COST2.id] },
        { pickCardIds: [POL6.id, POL4.id] },
        { pickCardId: POL6.id },
        { pickCardIds: [POL4.id] },
      ],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: COST1.id, present: true },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: COST2.id, present: true },
        { kind: 'zone', side: 'self', zone: 'scene', cardId: POL6.id, present: true },
        { kind: 'zone', side: 'self', zone: 'scene', cardId: POL4.id, present: true },
        { kind: 'zone', side: 'self', zone: 'remove', cardId: POL5.id, present: true },
      ],
    });
    expect(state.players.self.scene.find((c) => c.cardId === POL6.id)?.state).toBe('active');
    expect(state.players.self.scene.find((c) => c.cardId === POL4.id)?.state).toBe('sleep');
  });

  it('permits selecting zero characters without stale follow-up picks', () => {
    runCardScenario(B04084, [POL6, COST1, COST2], {
      name: 'B04084 zero aggregate selection',
      setup: {
        hand: ['B04084', COST1.id, COST2.id],
        remove: [POL6.id],
        caseColors: ['黄'],
        partnerColors: ['黄'],
        caseStatus: '解決編',
        fileCount: 8,
      },
      drive: { kind: 'event-use', cardId: 'B04084' },
      script: ['optional:take', { pickCardIds: [COST1.id, COST2.id] }, 'pick:skip'],
      expect: [
        { kind: 'zone', side: 'self', zone: 'remove', cardId: POL6.id, present: true },
      ],
    });
  });

  it('keeps duplicate selected printings occurrence-safe after the active entry splices remove', () => {
    const state = runCardScenario(B04084, [POL5, COST1, COST2], {
      name: 'B04084 duplicate remove occurrences',
      setup: {
        hand: ['B04084', COST1.id, COST2.id],
        remove: [POL5.id, POL5.id],
        caseColors: ['黄'],
        partnerColors: ['黄'],
        caseStatus: '解決編',
        fileCount: 8,
      },
      drive: { kind: 'event-use', cardId: 'B04084' },
      script: [
        'optional:take',
        { pickCardIds: [COST1.id, COST2.id] },
        { pickCardIds: [POL5.id, POL5.id] },
        { pickCardId: POL5.id },
        { pickCardIds: [POL5.id] },
      ],
      expect: [{ kind: 'zone', side: 'self', zone: 'remove', cardId: POL5.id, present: false }],
    });
    expect(state.players.self.scene.filter((c) => c.cardId === POL5.id).map((c) => c.state).sort()).toEqual(['active', 'sleep']);
  });
});
