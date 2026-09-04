import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B05066 } from '@/cards/ct-p05/B05066';
import { B05071 } from '@/cards/ct-p05/B05071';
import { B05072 } from '@/cards/ct-p05/B05072';
import { B05075 } from '@/cards/ct-p05/B05075';
import { B05076 } from '@/cards/ct-p05/B05076';
import { B05077 } from '@/cards/ct-p05/B05077';
import { B05080 } from '@/cards/ct-p05/B05080';
import { B05082 } from '@/cards/ct-p05/B05082';
import { B05086 } from '@/cards/ct-p05/B05086';
import { B05088 } from '@/cards/ct-p05/B05088';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave235: CT-P05 certification links', () => {
  it('pins the selected Wave235 contracts', () => {
    // qa: card:B05066:c1d131174b1c3670dd5949367607cecb0113ea8dd17704c6b21f0a4ab4d3f039
    // qa: card:B05066:e7696529447cdd4105353e743deb4b9055acf506a6063542ebd4b356f440e195
    expect(ability(B05066, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove' }, effect: { kind: 'atom', verb: 'sceneRemove', args: { filter: { levelMax: 8 } } } });
    // qa: card:B05071:545181f6d1f23bdc6c2301ce1b9086310e240a37baf779eb1dbccb317e39394d
    // qa: card:B05071:c07c3f8ad74eff2c29025e058e4559422062b44dae7e59dbe57af843b2fadb0a
    expect(ability(B05071, 'a1')).toMatchObject({ trigger: { hook: 'action:pre-target', selfOnly: true }, effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'] } } });
    // qa: card:B05072:3f01d7e7fbad53026ccb7a8191dafddf0b076f10214d39ea60912673597e875b
    expect(ability(B05072, 'a1')).toMatchObject({ trigger: { hook: 'phase:main:start' }, effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'discard' }, { kind: 'atom', verb: 'handAddFromRemove', args: { filter: { cardName: ['赤井秀一', 'ライ'] } } }] } });
    // qa: card:B05075:24cf16c15551dab0130d679d4fda19070b9be436c7b6460bcd533ef9bf2d63d6
    // qa: card:B05075:85bbad44b48d21c570b1213d51888aca2a6a55a514c99873a4ba05e9254f5b4e
    expect(ability(B05075, 'a2')).toMatchObject({ type: 'declared', effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false } } });
    // qa: card:B05076:54fa4ff4de63f3cf433dca3c54731cce244bb95165955ad394dc8785c031109c
    // qa: card:B05076:dc0ee81fc3b86d9f66fdfcf38ed2605f54b66e534557bdde0a7a1d99a0eaa51d
    // qa: card:B05076:e38956dd4cbd8054602a5e4bfe2a6bb9975ac9f1a94716e2df291eeb333990ab
    expect(ability(B05076, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' }, effect: { kind: 'conditional', if: { kind: 'not', c: { kind: 'sceneHas', nMin: 3 } }, then: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } } } });
    // qa: card:B05077:985434e7e5f8ec9c7065c3b225fabbfce250ebb9396e1ac97657433204d6ca22
    // qa: card:B05077:dbe168ad932636f12c379c40a5b42ab9dba63d2c2483f719efe7dc4ee16d5358
    expect(ability(B05077, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true }, condition: { kind: 'turn', player: 'opp' } });
    // qa: card:B05080:20d3bd9688f426ef4cb8f8650966b01e04c617b2922e17f10b260005d50afcec
    // qa: card:B05080:58dc3d46f2304f1245f49e16712f7df972c16f8be96eb08d51b6cb1fc7375e91
    expect(ability(B05080, 'a2')).toMatchObject({ limit: { kind: 'turn', n: 1 }, trigger: { hook: 'reasoning:after-sleep', matcherCondition: { kind: 'triggerCharMatches', side: 'opp' } } });
    // qa: card:B05082:51de3c143838c348f32a12d2252063f7ac6b6d884ab75fc3ef24a003df5b1731
    expect(JSON.stringify(ability(B05082, 'a1').effect)).toContain('deckRevealUntil');
    // qa: card:B05086:9ec6fd3072a58784c509d476f310f272f900999a399e9fc9fc0ec8de66db4c8e
    // qa: card:B05086:cc735d4ca44499df42f128aed8ac0e0d9be88ce23408ec6eb0ba5e87d9c243a5
    expect(ability(B05086, 'a1')).toMatchObject({ trigger: { hook: 'action:declare', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { color: '黄' } } }, effect: { kind: 'atom', verb: 'sceneRemove' } });
    // qa: card:B05088:9862605d3cacb3306bf10b3e03c8a0d6eec9287bc3d5c4a1ef3dd64b9f344b07
    expect(ability(B05088, 'a3')).toMatchObject({ type: 'declared', cost: { kind: 'pay' } });
    expect(JSON.stringify(ability(B05088, 'a3').cost)).toContain('removeAreaToDeckBottom');
  });
});
