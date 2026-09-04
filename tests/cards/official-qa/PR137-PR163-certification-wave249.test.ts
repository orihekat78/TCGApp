import { describe, expect, it } from 'vitest';
import { PR137 } from '@/cards/pr-01/PR137';
import { PR138 } from '@/cards/pr-01/PR138';
import { PR143 } from '@/cards/pr-01/PR143';
import { PR144 } from '@/cards/pr-01/PR144';
import { PR155 } from '@/cards/pr-01/PR155';
import { PR156 } from '@/cards/pr-01/PR156';
import { PR157 } from '@/cards/pr-01/PR157';
import { PR161 } from '@/cards/pr-01/PR161';
import { PR162 } from '@/cards/pr-01/PR162';
import { PR163 } from '@/cards/pr-01/PR163';

function ability(card: { abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, id).toBeDefined();
  return found!;
}

describe('official QA Wave249: PR137 through PR163 certification links', () => {
  it('pins every selected Wave249 contract', () => {
    // qa: card:PR137:972660377e7a1234e105ec6ca37df38d49a7747a333a6d01109f21f9c5fe3edc
    // qa: card:PR137:aefa15b9be82ec8dcc29b14ed78982d60c272dc8924b8d8c710a81a402973ac6
    // qa: card:PR137:ccd0535c8126075af60cd332865a48eeea60e9fea4c819bd4ba233e0e387e55f
    expect(ability(PR137, 'a1')).toMatchObject({ effect: { kind: 'choice', options: [{ kind: 'conditional', if: { kind: 'fileAtLeast', n: 7 } }, { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } }] }] } });

    // qa: card:PR143:972660377e7a1234e105ec6ca37df38d49a7747a333a6d01109f21f9c5fe3edc
    // qa: card:PR143:aefa15b9be82ec8dcc29b14ed78982d60c272dc8924b8d8c710a81a402973ac6
    // qa: card:PR143:ccd0535c8126075af60cd332865a48eeea60e9fea4c819bd4ba233e0e387e55f
    expect(ability(PR143, 'a1')).toMatchObject({ effect: { kind: 'choice', options: [{ kind: 'conditional', if: { kind: 'fileAtLeast', n: 7 } }, { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } }] }] } });

    // qa: card:PR138:4fc223eba7deeec4567bac85262d59863628572e7848c5b5cc2750c25f867bb6
    // qa: card:PR138:81cdf79a35270afed97b566149037faeb920188be9302342bc5fcc77b775c8d9
    expect(ability(PR138, 'a1')).toMatchObject({ effect: { kind: 'conditional', if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' }, then: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, filter: { trait: '黒ずくめの組織', levelMax: 6, kind: 'character' } } }] } } } });

    // qa: card:PR144:4fc223eba7deeec4567bac85262d59863628572e7848c5b5cc2750c25f867bb6
    // qa: card:PR144:81cdf79a35270afed97b566149037faeb920188be9302342bc5fcc77b775c8d9
    expect(ability(PR144, 'a1')).toMatchObject({ effect: { kind: 'conditional', if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' }, then: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, filter: { trait: '黒ずくめの組織', levelMax: 6, kind: 'character' } } }] } } } });

    // qa: card:PR155:1b7a66e8e3fda2157b1094d35aad6f35118b34314985cb59c3b0c7b06aa64264
    // qa: card:PR155:701e8dd70bb4cdf8021d89fdc8c0cdafbfb8d281747a498d436f576da20dbce4
    expect(ability(PR155, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', max: 1, enterSleep: true, filter: { cardName: '灰原哀', levelMax: 6, kind: 'character' } } }, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] } });

    // qa: card:PR161:1b7a66e8e3fda2157b1094d35aad6f35118b34314985cb59c3b0c7b06aa64264
    // qa: card:PR161:4ee1867360fe69dcc32ae106bf6665fca2c9bf3bd397482d79ed1cdd6aa4bf5b
    // qa: card:PR161:701e8dd70bb4cdf8021d89fdc8c0cdafbfb8d281747a498d436f576da20dbce4
    expect(ability(PR161, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', max: 1, enterSleep: true, filter: { cardName: '灰原哀', levelMax: 6, kind: 'character' } } }, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] } });

    // qa: card:PR156:13acb9b2198bd7007c40f60596424b56f10d3ad72e3ae58086e362c2b1883845
    expect(ability(PR156, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { target: { n: { min: 0, max: 1 } } } }, { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[事件]', scope: 'turn', target: { n: { min: 0, max: 1 }, query: { side: 'self' } } } }] } });

    // qa: card:PR162:13acb9b2198bd7007c40f60596424b56f10d3ad72e3ae58086e362c2b1883845
    expect(ability(PR162, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { target: { n: { min: 0, max: 1 } } } }, { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[事件]', scope: 'turn', target: { n: { min: 0, max: 1 }, query: { side: 'self' } } } }] } });

    // qa: card:PR157:47511f417f5a294696beca9f0b895f45baae375836c6948f5856e27f33557a9c
    expect(ability(PR157, 'a1')).toMatchObject({ condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'conditional', then: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'stun' } }, { kind: 'atom', verb: 'sceneRemove', args: { side: 'either', max: 1, filter: { levelMax: 7 } } }] } } } });

    // qa: card:PR163:47511f417f5a294696beca9f0b895f45baae375836c6948f5856e27f33557a9c
    expect(ability(PR163, 'a1')).toMatchObject({ condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'conditional', then: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'stun' } }, { kind: 'atom', verb: 'sceneRemove', args: { side: 'either', max: 1, filter: { levelMax: 7 } } }] } } } });
  });
});
