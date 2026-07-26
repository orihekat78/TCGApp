import { describe, expect, it } from 'vitest';

import { B10028 } from '@/cards/ct-p10/B10028';
import { B10029 } from '@/cards/ct-p10/B10029';
import { B10030 } from '@/cards/ct-p10/B10030';

describe('CT-P10 early existing-DSL cluster', () => {
  it('B10028 counts every own 高校生 for its self-turn cut-in', () => {
    expect(B10028.abilities).toEqual([
      expect.objectContaining({
        type: 'triggered',
        scope: 'on-hand',
        condition: { kind: 'turn', player: 'self' },
        effect: {
          kind: 'atom',
          verb: 'charModifyAP',
          args: {
            uid: '$contact.byUid',
            delta: { dyn: '$self.sceneTrait.高校生 * 1000' },
            scope: 'contact',
          },
        },
      }),
    ]);
  });

  it('B10029 retains the conditional optional sleep-to-recover chain', () => {
    expect(B10029.abilities[0]).toMatchObject({
      type: 'triggered',
      trigger: { hook: 'enter', selfOnly: true },
      condition: {
        kind: 'sceneHas',
        query: { area: 'scene', side: 'self', filter: { cardName: ['服部平次', '遠山和葉'] } },
        nMin: 1,
      },
      effect: {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
            { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { color: '緑', kind: 'event' } } },
          ],
        },
      },
    });
  });

  it('B10030 sets a card only in 解決編 and restricts its cut-in to green Police', () => {
    expect(B10030.abilities[0]).toMatchObject({
      type: 'triggered',
      condition: { kind: 'caseStatus', status: '解決編' },
      trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', player: 'self', fromDeckTop: true, faceUp: false } },
    });
    expect(B10030.abilities[1]).toMatchObject({
      type: 'triggered',
      scope: 'on-hand',
      condition: { kind: 'contactCharMatches', who: 'byUid', filter: { color: '緑', trait: '警察' } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
    });
  });
});
