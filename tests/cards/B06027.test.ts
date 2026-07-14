import { describe, expect, it } from 'vitest';
import { B06027 } from '@/cards/ct-p06/B06027';

describe('B06027 カマキリ男＆ナマコ男＆ヒトデ男', () => {
  it('registers its cutin and case-closed hirameki self reentry', () => {
    const card = B06027;
    expect(card?.kind).toBe('character');
    const hirameki = card?.abilities.find(ability => ability.id === 'a2');
    expect(hirameki).toMatchObject({
      scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      condition: { kind: 'caseStatus', status: '解決編' },
      effect: {
        kind: 'atom', verb: 'sceneEnter',
        args: { player: 'self', cardId: '$occurrence.cardId', enterSleep: true, sourceRequired: true },
      },
    });
  });
});
