import { describe, expect, it } from 'vitest';
import { D10004 } from '@/cards/ct-d10/D10004';
import { D10005 } from '@/cards/ct-d10/D10005';
import { D10006 } from '@/cards/ct-d10/D10006';
import { D10011 } from '@/cards/ct-d10/D10011';
import { D10012 } from '@/cards/ct-d10/D10012';
import { D10022 } from '@/cards/ct-d10/D10022';
import { D10023 } from '@/cards/ct-d10/D10023';
import { D11003 } from '@/cards/ct-d11/D11003';
import { D11004 } from '@/cards/ct-d11/D11004';
import { D11005 } from '@/cards/ct-d11/D11005';
import { D11006 } from '@/cards/ct-d11/D11006';

function ability(card: { id: string; abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave245: CT-D10 through CT-D11 certification links', () => {
  it('pins the selected Wave245 contracts', () => {
    // qa: card:D10004:857c38ab302c08c38f3b72a03279e754a87fabcc6c3ef2396e7000b45e0b23ca
    expect(ability(D10004, 'a2')).toMatchObject({ effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { filter: { cardName: 'シャッフルロマンス' }, bind: '$revealed', bindMatch: '$matched' } },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle' },
    ] } });

    // qa: card:D10005:46af55041184719c7faa8bc233bee9f9b1e528464a4993ec738ef62e20bbd8c5
    expect(ability(D10005, 'a1')).toMatchObject({ condition: { kind: 'caseTrait', trait: 'シャッフルロマンス' }, effect: { kind: 'conditional', if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' }, then: { kind: 'optional' } } });
    // qa: card:D10005:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
    expect(ability(D10005, 'a1')).toMatchObject({ effect: { kind: 'conditional', then: { effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, viaEffect: true, filter: { cardName: '黒衣の騎士・スペイド', levelMax: 8, kind: 'character' } } },
    ] } } } });
    // qa: card:D10005:a5a1c9c943eaa2f03b9e59152158a33e761ccbeb0ed01a9525107e7ea148240a
    expect(ability(D10005, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'bond', cardName: '工藤新一' }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'useEventFromHand', args: { max: 1, filter: { cardName: 'シャッフルロマンス', kind: 'event' } } } });

    // qa: card:D10006:46af55041184719c7faa8bc233bee9f9b1e528464a4993ec738ef62e20bbd8c5
    expect(ability(D10006, 'a1')).toMatchObject({ condition: { kind: 'caseTrait', trait: 'シャッフルロマンス' }, effect: { kind: 'conditional', if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' }, then: { kind: 'optional' } } });
    // qa: card:D10006:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
    expect(ability(D10006, 'a1')).toMatchObject({ effect: { kind: 'conditional', then: { effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, filter: { cardName: '黒衣の騎士・スペイド', levelMax: 8, kind: 'character' } } },
    ] } } } });
    // qa: card:D10006:a5a1c9c943eaa2f03b9e59152158a33e761ccbeb0ed01a9525107e7ea148240a
    expect(ability(D10006, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'bond', cardName: '工藤新一' }, limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'useEventFromHand', args: { max: 1, filter: { cardName: 'シャッフルロマンス', kind: 'event' } } } });

    // qa: card:D10011:0f39c0f87594ba4ac70a22ad407f7bde5842e22c92d19ce70677d45c54631978
    expect(ability(D10011, 'a2')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'conditional', then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } } } });
    // qa: card:D10012:18266db4732b9571ebae419afbd36f26fb54fb836c7752251e64e6dad817b4d1
    expect(ability(D10012, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } },
    ] } });

    // qa: card:D10022:a5a1c9c943eaa2f03b9e59152158a33e761ccbeb0ed01a9525107e7ea148240a
    expect(ability(D10022, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'character' }, side: 'self' }, effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } });
    // qa: card:D10022:ff5c23732b0ad1c68576c6c869ce0a582a769a264d7392b56fb2e8404173f21b
    expect(ability(D10022, 'a2')).toMatchObject({ trigger: { hook: 'leave:to-remove' }, condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '工藤新一' }, { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' }] }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } });

    // qa: card:D10023:a5a1c9c943eaa2f03b9e59152158a33e761ccbeb0ed01a9525107e7ea148240a
    // qa: card:D10023:da65e16cae13231e162a042041a5d1e771b7e1eebaaa7677d270f85b229243d7
    // qa: card:D10023:edc5088fb1200949f7b33f42f3cc6ccc10f00a622855f9f6bb8119f0549e1367
    expect(ability(D10023, 'a1')).toMatchObject({ condition: { kind: 'bond', cardName: '工藤新一' }, limit: { kind: 'turn', n: 1 }, trigger: { hook: 'reasoning:after-sleep', hooks: ['action:declare'], selfOnly: true }, effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, viaEffect: true, filterAny: [
      { cardName: '妃英理', levelMax: 5, kind: 'character' },
      { trait: '毛利探偵事務所', levelMax: 5, kind: 'character' },
    ] } } });

    // qa: card:D11003:9d272c7c3508a2f78da6114f96a3952e7166c3d259891325284ff5b15b95773d
    expect(ability(D11003, 'a2')).toMatchObject({ condition: { kind: 'and', cs: [{ kind: 'caseTrait', trait: '婚活パーティー' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 2 }] }, cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, filter: { apMax: 6000 } } } });
    // qa: card:D11004:9d272c7c3508a2f78da6114f96a3952e7166c3d259891325284ff5b15b95773d
    expect(ability(D11004, 'a2')).toMatchObject({ condition: { kind: 'and', cs: [{ kind: 'caseTrait', trait: '婚活パーティー' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 2 }] }, cost: { kind: 'sleepSelf' } });

    // qa: card:D11005:398c6d64539fb3ff23ab377e3bb5f06201f3194d915a8bb51fcfcc30a5bfaead
    expect(ability(D11005, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', cause: 'effect', filter: { kind: 'character', apMaxSource: true } } } });
    // qa: card:D11005:4bf810bc28b567f8e488307942f98b59832da683b18568da79ebd09c491994ee
    expect(ability(D11005, 'a2')).toMatchObject({ type: 'declared', cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'mustBeTargeted', val: true, scope: 'opp-turn' } } });
    // qa: card:D11006:4bf810bc28b567f8e488307942f98b59832da683b18568da79ebd09c491994ee
    expect(ability(D11006, 'a2')).toMatchObject({ type: 'declared', cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'mustBeTargeted', val: true, scope: 'opp-turn' } } });
  });
});
