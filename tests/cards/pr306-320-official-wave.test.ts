import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PR306 } from '@/cards/pr-01/PR306';
import { PR307 } from '@/cards/pr-01/PR307';
import { PR308 } from '@/cards/pr-01/PR308';
import { PR309 } from '@/cards/pr-01/PR309';
import { PR310 } from '@/cards/pr-01/PR310';
import { PR311 } from '@/cards/pr-01/PR311';
import { PR312 } from '@/cards/pr-01/PR312';
import { PR313 } from '@/cards/pr-01/PR313';
import { PR314 } from '@/cards/pr-01/PR314';
import { PR315 } from '@/cards/pr-01/PR315';
import { PR316 } from '@/cards/pr-01/PR316';
import { PR317 } from '@/cards/pr-01/PR317';
import { PR318 } from '@/cards/pr-01/PR318';
import { PR319 } from '@/cards/pr-01/PR319';
import { PR320 } from '@/cards/pr-01/PR320';
import { D11013 } from '@/cards/ct-d11/D11013';
import { B04006 } from '@/cards/ct-p04/B04006';
import { B04053 } from '@/cards/ct-p04/B04053';
import { B10058 } from '@/cards/ct-p10/B10058';
import { B10082 } from '@/cards/ct-p10/B10082';

function abilitySnapshot(abilities: unknown): unknown {
  return JSON.parse(JSON.stringify(abilities, (_key, value) => typeof value === 'function' ? value() : value));
}

describe('PR306–PR320 official authority wave', () => {
  it('keeps promo family cards independent from other card modules', () => {
    const cards = ['PR306', 'PR311', 'PR312', 'PR313', 'PR314', 'PR315', 'PR316', 'PR317', 'PR318', 'PR319'];
    for (const id of cards) {
      const source = readFileSync(resolve(process.cwd(), `src/cards/pr-01/${id}.ts`), 'utf8');
      expect(source, id).not.toMatch(/from ['"](?:\.\.\/|\.\/)/);
      expect(source, id).not.toMatch(/from ['"]@\/cards\/(?!_shared\/)/);
    }
  });

  it('ships every approved PR306-PR320 printing', () => {
    const cards = [
      PR306, PR307, PR308, PR309, PR310, PR311, PR312, PR313, PR314,
      PR315, PR316, PR317, PR318, PR319, PR320,
    ];
    expect(cards.map((card) => card.id), 'PR306-PR320 registration').toEqual([
      'PR306', 'PR307', 'PR308', 'PR309', 'PR310', 'PR311', 'PR312', 'PR313',
      'PR314', 'PR315', 'PR316', 'PR317', 'PR318', 'PR319', 'PR320',
    ]);
    expect(cards.map((card) => [card.id, card.no, card.names[0]]), 'official printing identity').toEqual([
      ['PR306', '0940/PR306', '萩原千速'],
      ['PR307', '1160/PR307', '灰原哀'],
      ['PR308', '1161/PR308', 'ジョディ・スターリング'],
      ['PR309', '1162/PR309', '降谷零'],
      ['PR310', '1163/PR310', 'ベルモット'],
      ['PR311', '0411/PR311', '工藤新一'],
      ['PR312', '0445/PR312', '赤井秀一'],
      ['PR313', '1160/PR313', '灰原哀'],
      ['PR314', '1161/PR314', 'ジョディ・スターリング'],
      ['PR315', '1162/PR315', '降谷零'],
      ['PR316', '1163/PR316', 'ベルモット'],
      ['PR317', '0411/PR317', '工藤新一'],
      ['PR318', '0445/PR318', '赤井秀一'],
      ['PR319', '1117/PR319', '世良真純'],
      ['PR320', '1164/PR320', '警察学校の風呂掃除'],
    ]);
  });

  it('keeps exact-printing clones semantically equal to their proven families', () => {
    expect(PR306.abilities, 'PR306').toEqual(D11013.abilities);
    expect(PR311.abilities, 'PR311').toEqual(B04006.abilities);
    expect(PR312.abilities, 'PR312').toEqual(B04053.abilities);
    expect(PR317.abilities, 'PR317').toEqual(B04006.abilities);
    expect(PR318.abilities, 'PR318').toEqual(B04053.abilities);
    expect(PR319.abilities, 'PR319').toEqual(B10058.abilities);
    expect(PR320.abilities, 'PR320').toEqual(B10082.abilities);
  });

  it('keeps same-card reprints behavior-identical', () => {
    expect(abilitySnapshot(PR313.abilities), 'PR313').toEqual(abilitySnapshot(PR307.abilities));
    expect(abilitySnapshot(PR314.abilities), 'PR314').toEqual(abilitySnapshot(PR308.abilities));
    expect(abilitySnapshot(PR315.abilities), 'PR315').toEqual(abilitySnapshot(PR309.abilities));
    expect(abilitySnapshot(PR316.abilities), 'PR316').toEqual(abilitySnapshot(PR310.abilities));
  });

  it('keeps the ordered removal-before-level-down and optional top-card flows', () => {
    const removeThenLevel = PR308.abilities[0]!.effect as { steps: Array<{ kind: string; then?: { verb?: string } }> };
    expect(removeThenLevel.steps[0], 'PR308 removal first').toMatchObject({ kind: 'conditional', then: { verb: 'sceneRemove' } });
    expect(removeThenLevel.steps[1], 'PR308 level-down second').toMatchObject({ verb: 'charModifyLevel', args: { delta: -1, scope: 'turn' } });
    expect(PR309.abilities[1], 'PR309 leave trigger').toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true } });
    const privateTopCard = PR309.abilities[1]!.effect as { steps: Array<{ args?: unknown }> };
    expect(privateTopCard.steps[0], 'PR309 private top card').toMatchObject({ args: { maxN: 1, visibility: 'private', viewer: 'self' } });
    expect(PR309.abilities[2], 'PR309 action actor stun').toMatchObject({
      trigger: { hook: 'evidence:remove-by-action' },
      effect: { args: { uid: '$trigger.byUid', state: 'stun' } },
    });
    expect(PR310.abilities[1], 'PR310 self effect attribution').toMatchObject({
      trigger: { matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' } },
    });
    expect(PR320.abilities, 'PR320 case abilities').toHaveLength(2);
  });
});
