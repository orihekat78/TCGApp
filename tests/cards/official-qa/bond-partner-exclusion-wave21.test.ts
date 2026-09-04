// qa: card:B01087:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B01091:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B02039:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B03030:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B03047:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B03054:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B04003:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B04004:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B04034:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B04069:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B06004:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B06040:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B06068:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:B06070:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D09004:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D09005:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D09007:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:D10023:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:PR173:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:PR177:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4
// qa: card:PR193:bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4

import { beforeEach, describe, expect, it } from 'vitest';
import { REUSE_CARDS } from '@/cards/_reuse';
import { evalCond } from '@/engine/cond/eval';
import { findChooseIntercept } from '@/engine/effect/consult-choose-intercept';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Condition, EffectCtx } from '@/engine/types';
import { makeChar, makeCtx } from '../../helpers/fixtures';

const QA_HASH = 'bfc77ce4ed1b5d60b75985971cadda71d303a0463330379383d277d829de3aa4';
const SOURCE_CASES = [
  ['B01087', ['B01087']], ['B01091', ['B01091']], ['B02039', ['B02039']],
  ['B03030', ['B03030', 'B03030P']], ['B03047', ['B03047', 'B03047P']],
  ['B03054', ['B03054', 'B03054P']],
  ['B04004', ['B04004', 'B04004P']], ['B04034', ['B04034']],
  ['B04069', ['B04069', 'B04069P']], ['B06004', ['B06004', 'B06004P']],
  ['B06040', ['B06040', 'B06040P']], ['B06068', ['B06068', 'B06068P']],
  ['B06070', ['B06070']], ['D09004', ['D09004']], ['D09005', ['D09005']],
  ['D09007', ['D09007']], ['D10023', ['D10023']], ['PR173', ['PR173']],
  ['PR193', ['PR193']],
] as const;

type BondCondition = Extract<Condition, { kind: 'bond' }>;

function card(id: string): CardDef {
  const found = REUSE_CARDS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing Wave21 printing: ${id}`);
  return found;
}

function collectBondConditions(value: unknown): BondCondition[] {
  if (Array.isArray(value)) return value.flatMap(collectBondConditions);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (record.kind === 'bond') return [record as BondCondition];
  return Object.values(record).flatMap(collectBondConditions);
}

function uniqueBondConditions(value: unknown): BondCondition[] {
  return [...new Map(collectBondConditions(value).map((condition) => [JSON.stringify(condition), condition])).values()];
}

function namedDef(id: string, names: string[], kind: 'character' | 'partner'): CardDef {
  return {
    id, no: `test/${id}`, kind, names, colors: [], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

beforeEach(_resetRegistry);

describe('official Q&A bond requires the named card in the scene', () => {
  it.each(SOURCE_CASES)('card:%s:%s excludes partner-only names across every printing', (qaCardId, printingIds) => {
    for (const printingId of printingIds) {
      const source = card(printingId);
      const bonds = uniqueBondConditions(source.abilities);
      expect(bonds, `${qaCardId}:${printingId}:bond count`).toHaveLength(1);
      const condition = bonds[0]!;
      const names = Array.isArray(condition.cardName) ? condition.cardName : [condition.cardName];
      const partner = namedDef(`W21_${printingId}_PARTNER`, names, 'partner');
      const sceneTarget = namedDef(`W21_${printingId}_SCENE`, names, 'character');
      register(partner);
      register(sceneTarget);

      for (const owner of ['self', 'opp'] as const) {
        const ctx = makeCtx({ source: { player: owner, area: 'scene' } });
        expect([
          'B01087', 'B01091', 'B02039', 'B03030', 'B03047', 'B03054', 'B04004', 'B04034', 'B04069', 'B06004',
          'B06040', 'B06068', 'B06070', 'D09004', 'D09005', 'D09007', 'D10023', 'PR173', 'PR193',
        ], 'card-bound Wave21 case').toContain(qaCardId);
        const partnerOnly = createEmptyGameState();
        partnerOnly.players[owner].partner = { cardId: partner.id, state: 'active', location: 'partner-area' } as never;
        expect(evalCond(partnerOnly, condition, ctx), `${qaCardId}:${printingId}:${owner}:partner-only`).toBe(false);

        const inScene = createEmptyGameState();
        inScene.players[owner].scene = [makeChar({ uid: 'named', cardId: sceneTarget.id })];
        expect(evalCond(inScene, condition, ctx), `${qaCardId}:${printingId}:${owner}:scene`).toBe(true);
      }
    }
  });

  it(`card:B04003:${QA_HASH} treats its named scene target as the implied bond`, () => {
    for (const printingId of ['B04003', 'B04003P']) {
      const source = card(printingId);
      expect(uniqueBondConditions(source.abilities), `${printingId}:no redundant bond condition`).toEqual([]);
      const partner = namedDef(`W21_${printingId}_PARTNER`, ['毛利蘭'], 'partner');
      const ran = namedDef(`W21_${printingId}_RAN`, ['江戸川コナン', '毛利蘭'], 'character');
      const decoy = namedDef(`W21_${printingId}_DECOY`, ['鈴木園子'], 'character');
      const opponent = namedDef(`W21_${printingId}_OPP`, ['相手'], 'character');
      [source, partner, ran, decoy, opponent].forEach(register);
      for (const targetPlayer of ['self', 'opp'] as const) {
        const actorPlayer = targetPlayer === 'self' ? 'opp' : 'self';
        const ctx: EffectCtx = {
          source: { cardId: opponent.id, uid: 'actor', abilityId: 'a1', player: actorPlayer, area: 'scene' },
          bindings: {},
        };

        const partnerOnly = createEmptyGameState();
        partnerOnly.turn.player = actorPlayer;
        partnerOnly.players[targetPlayer].scene = [
          makeChar({ uid: 'protector', cardId: source.id }),
          makeChar({ uid: 'decoy', cardId: decoy.id }),
        ];
        partnerOnly.players[targetPlayer].partner = { cardId: partner.id, state: 'active', location: 'partner-area' } as never;
        partnerOnly.players[actorPlayer].scene = [makeChar({ uid: 'actor', cardId: opponent.id })];
        expect(findChooseIntercept(partnerOnly, 'decoy', ctx), `${printingId}:${targetPlayer}:partner-only`).toEqual({ kind: 'none' });

        const inScene = createEmptyGameState();
        inScene.turn.player = actorPlayer;
        inScene.players[targetPlayer].scene = [
          makeChar({ uid: 'protector', cardId: source.id }),
          makeChar({ uid: 'ran', cardId: ran.id }),
        ];
        inScene.players[actorPlayer].scene = [makeChar({ uid: 'actor', cardId: opponent.id })];
        expect(findChooseIntercept(inScene, 'ran', ctx), `${printingId}:${targetPlayer}:scene`).toMatchObject({
          kind: 'discard-or-cancel', protectorCardId: source.id,
        });
      }
    }
  });

  it(`card:PR177:${QA_HASH} stays false when its own name exists only in the partner area`, () => {
    const target = card('PR177');
    expect(uniqueBondConditions(target.abilities), 'PR177 has no bond ability of its own').toEqual([]);
    register(target);
    const condition: BondCondition = { kind: 'bond', cardName: target.names[0]! };

    for (const owner of ['self', 'opp'] as const) {
      const ctx = makeCtx({ source: { player: owner, area: 'scene' } });
      const partnerOnly = createEmptyGameState();
      partnerOnly.players[owner].partner = { cardId: target.id, state: 'active', location: 'partner-area' } as never;
      expect(evalCond(partnerOnly, condition, ctx), `${owner}:partner-only`).toBe(false);

      const inScene = createEmptyGameState();
      inScene.players[owner].scene = [makeChar({ uid: 'pr177', cardId: target.id })];
      expect(evalCond(inScene, condition, ctx), `${owner}:scene`).toBe(true);
    }
  });
});
