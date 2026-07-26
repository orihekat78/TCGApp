import { describe, expect, it } from 'vitest';
import { B10036, B10036P } from '@/cards/ct-p10/B10036';
import { REUSE_CARDS } from '@/cards';

describe('B10036 鈴木園子', () => {
  it('models the own turn-end activation and the declared generated contact', () => {
    expect(B10036.abilities.find((ability) => ability.id === 'a1')).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
      condition: { kind: 'turn', player: 'self' },
      effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'active', target: { n: { min: 0, max: 1 }, query: { area: 'scene', side: 'self', filter: { kind: 'character', levelMin: 8 } } } } },
    });

    const declared = B10036.abilities.find((ability) => ability.id === 'a2')!;
    expect(declared).toMatchObject({
      type: 'declared', scope: 'on-scene',
      condition: { kind: 'and', cs: [
        { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
        { kind: 'partnerColor', color: '白' },
        { kind: 'caseStatus', status: '解決編' },
      ] },
      cost: { kind: 'sleepSelf' },
    });
    expect(declared.effect).toMatchObject({ kind: 'sequence', steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: 'target' } },
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: 'actor', excludeSelf: true, state: ['sleep'] } },
      { kind: 'atom', verb: 'startContact', args: { actorUid: '$actor.uid', targetUid: '$target.uid' } },
    ] });
  });

  it('keeps alternate art mechanically identical', () => {
    expect(B10036P).toMatchObject({
      ...B10036, id: 'B10036P', no: '1096/B10036P', rarity: 'SRP', imageUrl: '1783904116960645.jpg', abilities: B10036.abilities,
    });
  });

  it('registers exactly the printed base and P variants without duplicate IDs', () => {
    expect(REUSE_CARDS.filter((card) => card.id === 'B10036')).toEqual([B10036]);
    expect(REUSE_CARDS.filter((card) => card.id === 'B10036P')).toEqual([B10036P]);
    expect(new Set(REUSE_CARDS.map((card) => card.id)).size).toBe(REUSE_CARDS.length);
  });
});
