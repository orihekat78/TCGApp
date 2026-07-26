import { describe, expect, it } from 'vitest';
import { B10026, B10026P } from '@/cards/ct-p10/B10026';
import { B10027, B10027P } from '@/cards/ct-p10/B10027';

describe('CT-P10 early set-card cluster', () => {
  it('B10026 removes only a facedown set card before its level-bounded follow-up', () => {
    const [ability] = B10026.abilities;
    expect(ability.cost).toEqual({ kind: 'sleepSelf' });
    expect(ability.effect).toMatchObject({
      kind: 'chain', steps: [
        { kind: 'atom', verb: 'charRemoveSetCard', args: { side: 'either', faceDownOnly: true, bind: '$removedSet' } },
        { kind: 'conditional', if: { kind: 'bound', key: '$removedSet', presence: 'matched' }, then: { kind: 'atom', verb: 'sceneRemove', args: { filter: { levelMaxBound: { bindKey: '$removedSet' } } } } },
      ],
    });
    expect(B10026P).toMatchObject({ id: 'B10026P', rarity: 'CP' });
  });

  it('B10027 changes itself only after a facedown set card was removed', () => {
    const [ability] = B10027.abilities;
    expect(ability).toMatchObject({ condition: { kind: 'partnerColor', color: '緑' }, limit: { kind: 'turn', n: 1 } });
    expect(ability.effect).toMatchObject({
      kind: 'chain', steps: [
        { kind: 'atom', verb: 'charRemoveSetCard', args: { side: 'either', faceDownOnly: true, bind: '$removedSet' } },
        { kind: 'conditional', if: { kind: 'bound', key: '$removedSet', presence: 'matched' }, then: { kind: 'chain' } },
      ],
    });
    expect(B10027P).toMatchObject({ id: 'B10027P', rarity: 'CP' });
  });
});
