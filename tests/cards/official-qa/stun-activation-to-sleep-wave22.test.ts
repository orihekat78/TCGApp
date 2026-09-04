// qa: card:B04080:872de2079dce9150e76a70314a5d20400e542df72be79f07c2daed17f80158c3
// qa: card:B05027:be9bb7af3ac62c5a59fa84c917cd5a0daca7576b0ffad3bcacd869d093cc183d
// qa: card:B05096:872de2079dce9150e76a70314a5d20400e542df72be79f07c2daed17f80158c3
// qa: card:B06058:e0392238c06113cff66e959d9819ed9dd84b2cab1a32abc93bf5c445f0af575d
// qa: card:B06060:872de2079dce9150e76a70314a5d20400e542df72be79f07c2daed17f80158c3
// qa: card:B06066:d2016ba7f0daf47c893c7ab352ac82c315db3c48660a8b9ff4b29b8b9f8f973b
// qa: card:B06102:872de2079dce9150e76a70314a5d20400e542df72be79f07c2daed17f80158c3
// qa: card:B07023:872de2079dce9150e76a70314a5d20400e542df72be79f07c2daed17f80158c3
// qa: card:B07045:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B07063:be9bb7af3ac62c5a59fa84c917cd5a0daca7576b0ffad3bcacd869d093cc183d
// qa: card:B07072:872de2079dce9150e76a70314a5d20400e542df72be79f07c2daed17f80158c3
// qa: card:B07088:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B08015:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B08073:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B08075:14de44f1c173f882e1e76ecace7bdd2b0294f593504a9e99e21b1f942c8aad10
// qa: card:B09002:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B09049:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B09065:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B09070:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B10036:5183b8cdd403d09101a0c94ec18dd1f75311c707e255dd1dfc2ba97f30ae50ed
// qa: card:B10045:899194054e485f91d39bebfd4440762c1daaa6fccc7e00306ed9260493f24644
// qa: card:B10067:1d42b928a2148a21083f80eb8703446732020e0886c67f1471b742515e563d39
// qa: card:PR199:be9bb7af3ac62c5a59fa84c917cd5a0daca7576b0ffad3bcacd869d093cc183d
// qa: card:PR205:be9bb7af3ac62c5a59fa84c917cd5a0daca7576b0ffad3bcacd869d093cc183d

import { ALL_CARDS } from '@/cards';
import type { CardDef, Effect } from '@/engine/types';
import { describe, expect, it } from 'vitest';
import { runCardScenario } from '../../helpers/card-probe-harness';

type ActiveAtom = Extract<Effect, { kind: 'atom' }> & {
  verb: 'sceneSetState';
  args: Record<string, unknown>;
};

const PRINTINGS = {
  B04080: ['B04080'], B05027: ['B05027', 'B05027P'], B05096: ['B05096', 'B05096P'], B06058: ['B06058'],
  B06060: ['B06060'], B06066: ['B06066', 'B06066P'], B06102: ['B06102'], B07023: ['B07023', 'B07023P'],
  B07045: ['B07045'], B07063: ['B07063', 'B07063P'], B07072: ['B07072'], B07088: ['B07088'],
  B08015: ['B08015'], B08073: ['B08073'], B08075: ['B08075', 'B08075P'], B09002: ['B09002', 'B09002P'],
  B09049: ['B09049'], B09065: ['B09065'], B09070: ['B09070', 'B09070P'], B10036: ['B10036', 'B10036P'],
  B10045: ['B10045'], B10067: ['B10067', 'B10067P', 'B10067P2', 'B10067P3'], PR199: ['PR199'], PR205: ['PR205'],
} as const;

interface FixtureOptions {
  names?: string[];
  colors?: string[];
  level?: number;
  ap?: number;
  lp?: number;
  traits?: string[];
  keywords?: string[];
}

function fixture(id: string, options: FixtureOptions = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: options.names ?? [id], colors: options.colors ?? ['青'],
    level: options.level ?? 3, ap: options.ap ?? 3000, lp: options.lp ?? 1,
    traits: options.traits ?? [], keywords: options.keywords ?? [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function card(cardId: string): CardDef {
  const found = ALL_CARDS.find(candidate => candidate.id === cardId);
  if (!found) throw new Error('missing shipped card ' + cardId);
  return found;
}

function collectActiveAtoms(value: unknown, result: ActiveAtom[] = []): ActiveAtom[] {
  if (Array.isArray(value)) {
    for (const item of value) collectActiveAtoms(item, result);
    return result;
  }
  if (value === null || typeof value !== 'object') return result;
  const item = value as Record<string, unknown>;
  const args = item.args as Record<string, unknown> | undefined;
  if (item.kind === 'atom' && item.verb === 'sceneSetState' && args?.state === 'active') result.push(item as ActiveAtom);
  for (const nested of Object.values(item)) collectActiveAtoms(nested, result);
  return result;
}

const YELLOW_POLICE = fixture('W22_YELLOW_POLICE', { colors: ['黄'], traits: ['警察'] });
const GREEN_POLICE = fixture('W22_GREEN_POLICE', { colors: ['緑'], level: 8, traits: ['警察'] });
const POLICE = fixture('W22_POLICE', { traits: ['警察'] });
const TETSU = fixture('W22_TETSU', { names: ['鉄刃'], lp: 0 });
const YAIBA = fixture('W22_YAIBA', { traits: ['YAIBA'] });
const CHIANTI = fixture('W22_CHIANTI', { names: ['キャンティ'] });
const HATTORI = fixture('W22_HATTORI', { names: ['服部平次'] });
const JEWEL = fixture('W22_JEWEL', { traits: ['ビッグジュエル'] });
const HIGH_SCHOOL = fixture('W22_HIGH_SCHOOL', { level: 4, lp: 0, traits: ['高校生'] });
const RED = fixture('W22_RED', { colors: ['赤'] });
const HIROMITSU = fixture('W22_HIROMITSU', { names: ['諸伏景光'] });
const HAIBARA = fixture('W22_HAIBARA', { names: ['灰原哀'] });
const SATO = fixture('W22_SATO', { names: ['佐藤美和子'] });
const KUDO = fixture('W22_KUDO', { names: ['工藤新一'], level: 8 });
const RAN = fixture('W22_RAN', { names: ['毛利蘭'], level: 8 });
const FBI = fixture('W22_FBI', { traits: ['FBI'] });
const LEVEL8 = fixture('W22_LEVEL8', { level: 8 });
const LEVEL7 = fixture('W22_LEVEL7', { level: 7 });
const AOKO = fixture('W22_AOKO', { names: ['中森青子'] });
const DATE = fixture('W22_DATE', { names: ['伊達航'] });
const MOURI = fixture('W22_MOURI', { names: ['毛利小五郎'], lp: 0 });
const COST = fixture('W22_COST');
const ATTACKER = fixture('W22_ATTACKER', { ap: 5000 });
const DEFENDER = fixture('W22_DEFENDER', { ap: 4000 });
const SLEEP_A = fixture('W22_SLEEP_A');
const SLEEP_B = fixture('W22_SLEEP_B');
const OTHER = fixture('W22_OTHER');
const SHIPPU = fixture('W22_SHIPPU', { keywords: ['疾風'] });
const DECOY = fixture('W22_DECOY', { keywords: ['疾風'] });

describe('official Q&A stun activation substitution — Wave22', () => {
  it.each(Object.entries(PRINTINGS))('%s and every shipped printing carry the same active-state contract', (baseId, expected) => {
    const actual = ALL_CARDS
      .filter(candidate => new RegExp('^' + baseId + '(?:P\\d*)?$').test(candidate.id))
      .map(candidate => candidate.id)
      .sort();
    expect(actual, baseId + ' printing set').toEqual([...expected].sort());
    const baseAtoms = collectActiveAtoms(card(baseId).abilities);
    expect(baseAtoms.length, baseId + ' active atoms').toBeGreaterThan(0);
    for (const printing of expected) expect(collectActiveAtoms(card(printing).abilities), printing).toEqual(baseAtoms);
  });

  // Card-bound production dispatch: B04080.
  it('B04080 activates both yellow and green police picks; each stunned pick becomes sleep', () => {
    expect(() => runCardScenario(card('B04080'), [YELLOW_POLICE, GREEN_POLICE], {
      name: 'B04080 phase-end two-color activation',
      setup: { selfScene: [
        { cardId: 'B04080', uid: 'source' },
        { cardId: YELLOW_POLICE.id, uid: 'yellow', state: 'stun' },
        { cardId: GREEN_POLICE.id, uid: 'green', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' },
      script: [{ pickUid: 'yellow' }, { pickUid: 'green' }],
      expect: [{ kind: 'state', uid: 'yellow', state: 'sleep' }, { kind: 'state', uid: 'green', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B05027.
  it('B05027 declared active branch turns a stunned green level-8 target to sleep', () => {
    expect(() => runCardScenario(card('B05027'), [GREEN_POLICE], {
      name: 'B05027 declared active branch',
      setup: { partnerColors: ['緑'], selfScene: [
        { cardId: 'B05027', uid: 'source' }, { cardId: GREEN_POLICE.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a1' },
      script: [{ choiceIndex: 0 }, { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B05096.
  it('B05096 real cut-in dispatch turns a stunned police character to sleep', () => {
    expect(() => runCardScenario(card('B05096'), [POLICE, ATTACKER, DEFENDER], {
      name: 'B05096 opponent-turn cut-in activation',
      setup: { turn: 'opp', hand: ['B05096'], selfScene: [
        { cardId: DEFENDER.id, uid: 'defender' }, { cardId: POLICE.id, uid: 'target', state: 'stun' },
      ], oppScene: [{ cardId: ATTACKER.id, uid: 'attacker' }] },
      drive: { kind: 'cut-in', cardId: 'B05096', byUid: 'attacker', byPlayer: 'opp', targetUid: 'defender' },
      script: [{ pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B06058.
  it('B06058 real enter trigger pays the optional hand cost then converts stunned Tetsu to sleep', () => {
    expect(() => runCardScenario(card('B06058'), [TETSU, COST], {
      name: 'B06058 resolved-case enter activation',
      setup: { caseStatus: '解決編', hand: [COST.id], selfScene: [
        { cardId: 'B06058', uid: 'source' }, { cardId: TETSU.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'enter', cardId: 'B06058', uid: 'source' },
      script: ['optional:take', { pickCardId: COST.id }, { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'zone', cardId: COST.id, zone: 'remove', side: 'self', present: true }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B06060.
  it('B06060 declared active branch removes its source and converts stunned YAIBA to sleep', () => {
    expect(() => runCardScenario(card('B06060'), [YAIBA], {
      name: 'B06060 declared self-remove activation',
      setup: { selfScene: [
        { cardId: 'B06060', uid: 'source' }, { cardId: YAIBA.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a1' },
      script: [{ choiceIndex: 0 }, { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'zone', cardId: 'B06060', zone: 'remove', side: 'self', present: true }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B06066.
  it('B06066 partner-area phase-end trigger counts three sleep/stun characters and converts the stunned pick', () => {
    expect(() => runCardScenario(card('B06066'), [SLEEP_A, SLEEP_B, OTHER], {
      name: 'B06066 partner-area three-state gate',
      setup: { partnerAreaMR: { cardId: 'B06066', uid: 'partnerMR:self' }, selfScene: [
        { cardId: SLEEP_A.id, uid: 'sleep-a', state: 'sleep' },
        { cardId: SLEEP_B.id, uid: 'sleep-b', state: 'sleep' },
        { cardId: OTHER.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' }, script: [{ pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B06102.
  it('B06102 phase-end optional sleeps its source then converts stunned Chianti to sleep', () => {
    expect(() => runCardScenario(card('B06102'), [CHIANTI], {
      name: 'B06102 phase-end Chianti activation',
      setup: { selfScene: [
        { cardId: 'B06102', uid: 'source' }, { cardId: CHIANTI.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' }, script: ['optional:take', { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }, { kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B07023.
  it('B07023 phase-end optional removes its source then converts stunned Hattori to sleep', () => {
    expect(() => runCardScenario(card('B07023'), [HATTORI], {
      name: 'B07023 phase-end Hattori activation',
      setup: { selfScene: [
        { cardId: 'B07023', uid: 'source' }, { cardId: HATTORI.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' }, script: ['optional:take', { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'zone', cardId: 'B07023', zone: 'remove', side: 'self', present: true }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B07045.
  it('B07045 phase-end partner-area trait condition converts its stunned self to sleep', () => {
    expect(() => runCardScenario(card('B07045'), [JEWEL], {
      name: 'B07045 Big Jewel partner-area activation',
      setup: { partnerAreaCards: [JEWEL.id], selfScene: [{ cardId: 'B07045', uid: 'source', state: 'stun' }] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B07063.
  it('B07063 declared ability binds the LP0 high-school pick before activating that stunned target', () => {
    expect(() => runCardScenario(card('B07063'), [HIGH_SCHOOL, COST], {
      name: 'B07063 declared bind then activation',
      setup: { hand: [COST.id], selfScene: [
        { cardId: 'B07063', uid: 'source' }, { cardId: HIGH_SCHOOL.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a2', costParams: { removeFromHand: { indices: [0] } } },
      script: [{ pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }, { kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'apDelta', uid: 'target', n: 1000 }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B07072.
  it('B07072 phase-end optional removes its source then converts a stunned red target to sleep', () => {
    expect(() => runCardScenario(card('B07072'), [RED], {
      name: 'B07072 phase-end red activation',
      setup: { selfScene: [
        { cardId: 'B07072', uid: 'source' }, { cardId: RED.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' }, script: ['optional:take', { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'zone', cardId: 'B07072', zone: 'remove', side: 'self', present: true }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B07088.
  it('B07088 phase-end bond condition converts its stunned self to sleep', () => {
    expect(() => runCardScenario(card('B07088'), [HIROMITSU], {
      name: 'B07088 Hiromitsu bond activation',
      setup: { selfScene: [
        { cardId: 'B07088', uid: 'source', state: 'stun' }, { cardId: HIROMITSU.id, uid: 'bond' },
      ] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B08015.
  it('B08015 phase-end presence condition converts its stunned self to sleep', () => {
    expect(() => runCardScenario(card('B08015'), [HAIBARA], {
      name: 'B08015 Haibara presence activation',
      setup: { selfScene: [
        { cardId: 'B08015', uid: 'source', state: 'stun' }, { cardId: HAIBARA.id, uid: 'haibara' },
      ] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B08073.
  it('B08073 real phase-end all-name condition converts its stunned self to sleep', () => {
    expect(() => runCardScenario(card('B08073'), [SATO], {
      name: 'B08073 Sato bond and all-name gate',
      setup: { selfScene: [
        { cardId: 'B08073', uid: 'source', state: 'stun' }, { cardId: SATO.id, uid: 'sato' },
      ] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B08075.
  it('B08075 real event-use first option converts stunned Sato to sleep', () => {
    expect(() => runCardScenario(card('B08075'), [SATO], {
      name: 'B08075 event-use Sato activation option',
      setup: { caseColors: ['黄'], fileCount: 5, hand: ['B08075'], selfScene: [{ cardId: SATO.id, uid: 'target', state: 'stun' }] },
      drive: { kind: 'event-use', cardId: 'B08075' },
      script: ['optional:take', { pickUid: 'target' }, 'optional:decline', 'optional:decline'],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'zone', cardId: 'B08075', zone: 'remove', side: 'self', present: true }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B09002.
  it('B09002 partner-area trigger reveals a real name then converts the stunned level-8 name to sleep', () => {
    expect(() => runCardScenario(card('B09002'), [KUDO, RAN], {
      name: 'B09002 reveal then named activation',
      setup: { partnerAreaMR: { cardId: 'B09002', uid: 'partnerMR:self' }, hand: [KUDO.id], selfScene: [{ cardId: RAN.id, uid: 'target', state: 'stun' }] },
      drive: { kind: 'phase-end' }, script: [{ pickCardId: KUDO.id }, { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B09049.
  it('B09049 sleeps another character then its shipped $self active atom converts stunned self to sleep', () => {
    expect(() => runCardScenario(card('B09049'), [OTHER], {
      name: 'B09049 phase-end chained self activation',
      setup: { selfScene: [
        { cardId: 'B09049', uid: 'source', state: 'stun' }, { cardId: OTHER.id, uid: 'other' },
      ] },
      drive: { kind: 'phase-end' }, script: [{ pickUid: 'other' }],
      expect: [{ kind: 'state', uid: 'other', state: 'sleep' }, { kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B09065 a1.
  it('B09065 phase-end optional converts a stunned FBI pick to sleep', () => {
    expect(() => runCardScenario(card('B09065'), [FBI], {
      name: 'B09065 phase-end FBI activation',
      setup: { selfScene: [
        { cardId: 'B09065', uid: 'source' }, { cardId: FBI.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' }, script: ['optional:take', { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }, { kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B09065 a2.
  it('B09065 opponent-turn real leave-to-remove trigger converts a stunned FBI pick to sleep', () => {
    expect(() => runCardScenario(card('B09065'), [FBI], {
      name: 'B09065 opponent-turn leave activation',
      setup: { turn: 'opp', selfScene: [
        { cardId: 'B09065', uid: 'source' }, { cardId: FBI.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'scene-remove', uid: 'source', byPlayer: 'opp' }, script: [{ pickUid: 'target' }],
      expect: [{ kind: 'zone', cardId: 'B09065', zone: 'remove', side: 'self', present: true }, { kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B09070.
  it('B09070 partner-area forEach activates only the fired-Shippu stunned character', () => {
    expect(() => runCardScenario(card('B09070'), [SHIPPU, DECOY], {
      name: 'B09070 fired-Shippu forEach activation',
      setup: { partnerAreaMR: { cardId: 'B09070', uid: 'partnerMR:self' }, selfScene: [
        { cardId: SHIPPU.id, uid: 'target', state: 'stun', shippuFiredCharThisTurn: true },
        { cardId: DECOY.id, uid: 'decoy', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'state', uid: 'decoy', state: 'stun' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B10036.
  it('B10036 phase-end short-form pick converts only the stunned level-8 character', () => {
    expect(() => runCardScenario(card('B10036'), [LEVEL8, LEVEL7], {
      name: 'B10036 level-eight phase-end activation',
      setup: { selfScene: [
        { cardId: 'B10036', uid: 'source' },
        { cardId: LEVEL8.id, uid: 'target', state: 'stun' }, { cardId: LEVEL7.id, uid: 'decoy', state: 'stun' },
      ] },
      drive: { kind: 'phase-end' }, script: [{ pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'target', state: 'sleep' }, { kind: 'state', uid: 'decoy', state: 'stun' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B10045.
  it('B10045 real resolved-case bond trigger converts its stunned self to sleep', () => {
    expect(() => runCardScenario(card('B10045'), [AOKO], {
      name: 'B10045 resolved-case Aoko bond activation',
      setup: { caseStatus: '解決編', selfScene: [
        { cardId: 'B10045', uid: 'source', state: 'stun' }, { cardId: AOKO.id, uid: 'aoko' },
      ] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: B10067.
  it('B10067 real Date bond trigger converts its stunned self to sleep', () => {
    expect(() => runCardScenario(card('B10067'), [DATE], {
      name: 'B10067 Date bond activation',
      setup: { selfScene: [
        { cardId: 'B10067', uid: 'source', state: 'stun' }, { cardId: DATE.id, uid: 'date' },
      ] },
      drive: { kind: 'phase-end' },
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: PR199.
  it('PR199 declared second branch pays the optional hand cost then converts stunned LP0 Mouri to sleep', () => {
    expect(() => runCardScenario(card('PR199'), [MOURI, COST], {
      name: 'PR199 FILE5 second choice activation',
      setup: { fileCount: 5, hand: [COST.id], selfScene: [
        { cardId: 'PR199', uid: 'source' }, { cardId: MOURI.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a1' },
      script: [{ choiceIndex: 1 }, 'optional:take', { pickCardId: COST.id }, { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }, { kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });

  // Card-bound production dispatch: PR205.
  it('PR205 declared second branch pays the optional hand cost then converts stunned LP0 Mouri to sleep', () => {
    expect(() => runCardScenario(card('PR205'), [MOURI, COST], {
      name: 'PR205 FILE5 second choice activation',
      setup: { fileCount: 5, hand: [COST.id], selfScene: [
        { cardId: 'PR205', uid: 'source' }, { cardId: MOURI.id, uid: 'target', state: 'stun' },
      ] },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a1' },
      script: [{ choiceIndex: 1 }, 'optional:take', { pickCardId: COST.id }, { pickUid: 'target' }],
      expect: [{ kind: 'state', uid: 'source', state: 'sleep' }, { kind: 'state', uid: 'target', state: 'sleep' }],
    })).not.toThrow();
  });
});
