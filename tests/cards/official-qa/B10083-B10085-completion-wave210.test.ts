// qa: card:B10083:ef8f1c5c8c1abdc6f70dd0cbdf073b3d8c558f5feeca4c12d99122b337875843
// qa: card:B10085:61d9cd0d831a239d4126b2147d98cbfe91edfa0210210716320b032953ae1fd2
// qa: card:B10085:7f73a8416b0213d70204e5cd2dd13781b9893de03c54ed92d6cc69ae3e06730c
// qa: card:B10085:8cb8a9a89ef7faf7b0da5065b7de1c4bebb4b2ca782dcda84066334408a04f4b

import { describe, expect, it } from 'vitest';
import { B10083 } from '@/cards/ct-p10/B10083';
import { B10085 } from '@/cards/ct-p10/B10085';

describe('official QA Wave210: CT-P10 arbitrary evidence and cut-in contracts', () => {
  it('binds B10083 to the shared exact-three evidence payment contract', () => {
    expect(B10083.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      cost: { kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } },
      effect: { kind: 'atom', verb: 'sceneToEvidence' },
    });
  });

  it('draws for B10085 after its optional level-nine removal is declined', () => {
    expect(B10085.abilities.find((candidate) => candidate.id === 'a1')).toMatchObject({
      effect: {
        kind: 'conditional',
        if: { kind: 'costRemovedMatches', filter: { color: '黒', keyword: 'カットイン' }, n: 3 },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'sceneRemove', args: { max: 1, filter: { levelMax: 9 } } },
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          ],
        },
      },
    });
  });

  it('triggers B10085 from any own-turn cut-in use, including a cut-in with no other result', () => {
    expect(B10085.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      type: 'triggered',
      scope: 'on-partner-area',
      condition: { kind: 'turn', player: 'self' },
      trigger: { hook: 'cutin:used', matcherCondition: { kind: 'and' } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });

  it('keeps B10085 own cut-in AP and its partner-area trigger as separate +2000 effects', () => {
    expect(B10085.abilities.find((candidate) => candidate.id === 'a2')).toMatchObject({
      effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'contact' } },
    });
    expect(B10085.abilities.find((candidate) => candidate.id === 'a3')).toMatchObject({
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'contact' } },
    });
  });
});
