import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B05008 } from '@/cards/ct-p05/B05008';
import { B05009 } from '@/cards/ct-p05/B05009';
import { B05011 } from '@/cards/ct-p05/B05011';
import { B05012 } from '@/cards/ct-p05/B05012';
import { B05013 } from '@/cards/ct-p05/B05013';
import { B05014 } from '@/cards/ct-p05/B05014';
import { B05015 } from '@/cards/ct-p05/B05015';
import { B05017 } from '@/cards/ct-p05/B05017';
import { B05019 } from '@/cards/ct-p05/B05019';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave232: CT-P05 certification links', () => {
  it('pins the selected Wave232 contracts', () => {
    // qa: card:B05008:21d6509308bdb795ff3bb4ac7cf3cf633446badca80a94dad0fe1cc8632e16e6
    expect(ability(B05008, 'a1')).toMatchObject({ type: 'continuous', scope: 'on-scene', continuousModifier: { untargetableByOppEffect: true } });
    // qa: card:B05008:ff2f1fcb4229d3294e14ee3a62a8df409888bc7b4df524b6908af6cfe113e36a
    expect(ability(B05008, 'a1').condition).toMatchObject({ kind: 'bond', cardName: '江戸川コナン' });
    // qa: card:B05009:21d6509308bdb795ff3bb4ac7cf3cf633446badca80a94dad0fe1cc8632e16e6
    expect(ability(B05009, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'enterSource', viaEffect: true, sourceFilter: { kind: 'character' }, side: 'self' }, effect: { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃', scope: 'turn' } } });
    // qa: card:B05011:0d310607ecb1545941beca62cb928c162123c380c3ec000be0d418c018300f0c
    expect(ability(B05011, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:end', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '毛利小五郎' } } } });
    // qa: card:B05011:3b685813b3b6006e643ed5a3ea2ffe4f560a1bfba591df13fbb02e700820b75a
    expect(ability(B05011, 'a1')).toMatchObject({ scope: 'on-scene', effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } });
    // qa: card:B05011:fdf0e7bb69340e2482c0c50771f3fd6ddc8255cd26087077034f8656ea6cc269
    expect(ability(B05011, 'a1').condition).toBeUndefined();
    // qa: card:B05012:3899553b8a296bf8d0a2eddb0e39953faad9e1431c5b354af07eaf1613305f62
    expect(ability(B05012, 'a2')).toMatchObject({ type: 'continuous', scope: 'on-scene', continuousModifier: { grantNames: ['毛利小五郎'], grantTraits: ['探偵'] } });
    // qa: card:B05012:5fefa13e3e1ec369059584a4e3780dce6c812967407c386c362581aee3ffc6b0
    expect(B05012.names).not.toContain('毛利小五郎');
    // qa: card:B05012:6681496337b6b860882efb39054adf511be39c0b7611589984f21060fd21df2e
    expect(B05012.traits).not.toContain('探偵');
    // qa: card:B05013:84e243eb4cca4e3333cfc9cf98b770240221c6fd3cb8eb27269fdb313ef9702e
    expect(ability(B05013, 'a1').effect).toMatchObject({ kind: 'atom', verb: 'evidenceFlipDown', args: { cardIds: '$pick.cardIds', target: { query: { area: 'evidence', side: 'self', faceUp: true }, n: { min: 0, max: 2 } } } });
    // qa: card:B05014:479ad34f9dcdfe2dc4f49d880a05ab3a67daf3eabf22b980493ac4fdb4a686e4
    expect(ability(B05014, 'a1').effect).toMatchObject({ kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneToHand', args: { uid: '$self' } }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, enterSleep: true } }] });
    // qa: card:B05014:ba90f3b6108e08fb39263d96a24b73dad3381d7e65da8b23a3dc7ce21215c2ad
    expect(ability(B05014, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' } });
    // qa: card:B05015:cc04273aef13ed488452011a0de876fe80d01700fa604333278a0f424be4783f
    expect(ability(B05015, 'a1')).toMatchObject({ trigger: { hook: 'misread:performed' }, condition: { kind: 'triggerPlayerIs', side: 'opp' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 3000, scope: 'turn' } } });
    // qa: card:B05017:4ffe47185f00d4469a8eea7cbf5b60d598c353e39d6f3ce1562bcdd419739aa1
    expect(JSON.stringify(ability(B05017, 'a1').effect)).toContain('"presence":"matched"');
    // qa: card:B05017:81f216bbf120832d5ee7069a5a9a801167cdc13b1b42649fdcb9c198b4ad39a5
    expect((ability(B05017, 'a1').effect as { steps: unknown[] }).steps).toContainEqual(expect.objectContaining({ kind: 'atom', verb: 'deckRevealUntil', args: expect.objectContaining({ filter: { color: '青', kind: 'event' }, bindMatch: '$matched' }) }));
    // qa: card:B05019:3b685813b3b6006e643ed5a3ea2ffe4f560a1bfba591df13fbb02e700820b75a
    expect(ability(B05019, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:after-sleep', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { cardName: '毛利小五郎' } } } });
    // qa: card:B05019:97dd73293b15d9e7277bda2a4dea14fbcf528517d4623af0364d9cad015711f4
    expect(JSON.stringify(ability(B05019, 'a1'))).toContain('"cause":"effect"');
    // qa: card:B05019:fdf0e7bb69340e2482c0c50771f3fd6ddc8255cd26087077034f8656ea6cc269
    expect(JSON.stringify(ability(B05019, 'a1').effect)).toContain('"lpMax":0');
  });
});
