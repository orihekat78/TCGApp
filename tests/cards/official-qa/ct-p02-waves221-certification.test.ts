import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B02002 } from '@/cards/ct-p02/B02002';
import { B02003 } from '@/cards/ct-p02/B02003';
import { B02004 } from '@/cards/ct-p02/B02004';
import { B02012 } from '@/cards/ct-p02/B02012';
import { B02014 } from '@/cards/ct-p02/B02014';
import { B02018 } from '@/cards/ct-p02/B02018';
import { B02019 } from '@/cards/ct-p02/B02019';
import { B02020 } from '@/cards/ct-p02/B02020';
import { B02021 } from '@/cards/ct-p02/B02021';
import { B02025 } from '@/cards/ct-p02/B02025';
import { B02026 } from '@/cards/ct-p02/B02026';
import { B02033 } from '@/cards/ct-p02/B02033';
import { B02038 } from '@/cards/ct-p02/B02038';
import { B02039 } from '@/cards/ct-p02/B02039';
import { B02040 } from '@/cards/ct-p02/B02040';
import { B02046 } from '@/cards/ct-p02/B02046';
import { B02050 } from '@/cards/ct-p02/B02050';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave221: CT-P02 certification links', () => {
  it('pins enter, partner, action, and set-card contracts', () => {
    // qa: card:B02002:e4dc8750fdc90c094edcf6692ef42e73791f134e61cc3d17ba02fca0771c5581
    expect(ability(B02002, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'sceneHas', nMin: 1 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } } });
    // qa: card:B02003:288c106a641dbde8a3b4b5a896245dc9bb8da3acc3155f411839e225c8e11706
    expect(ability(B02003, 'a2')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'charModifyLP' } });
    // qa: card:B02004:3d5bad6ccecefdaadd90aa725a462c3990f99b44a2eb4a116301bf3fd41e7c41
    expect(ability(B02004, 'a1')).toMatchObject({ condition: { kind: 'bond', cardName: '工藤新一' }, trigger: { hook: 'reasoning:after-sleep', hooks: ['action:declare'], selfOnly: true } });
    // qa: card:B02012:99c598d5872d5554c140b03c33a74088ff73468718440070381e8f4a8af1eb96
    expect(ability(B02012, 'a2')).toMatchObject({ trigger: { hook: 'action:declare' }, condition: { kind: 'or', cs: expect.arrayContaining([expect.objectContaining({ kind: 'triggerCharMatches', side: 'self', filter: { trait: '毛利探偵事務所' } })]) } });
    // qa: card:B02014:88593a2c8b21e66237ec7e8c40874be6c01e005f90e369b033d5f02dff519194
    expect(ability(B02014, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charGrantAbility', args: { bind: '$picked' } }, { kind: 'forEach', over: { kind: 'fromBound', bindKey: '$picked' }, do: { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[事件]' } } }] } });
    // qa: card:B02018:c71818eb6a5d40508ad7b07e14f0e52f4fdca1198f218df2a9014f677b893167
    expect(ability(B02018, 'a1')).toMatchObject({ trigger: { hook: 'setcard:enter', selfOnly: true }, limit: { kind: 'turn', n: 2 } });
    // qa: card:B02018:df7b59281d182a573df49ce6c86e54eb6995eea71b5daf691f085c07ce58cc62
    expect(ability(B02018, 'a1')).toMatchObject({ effect: { kind: 'choice', options: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } }, { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } }] } });
    // qa: card:B02019:084bd1c0c7212ceac9dcc2a06f5f4c70f2923a937efed9b231ae8f440d66b062
    expect(ability(B02019, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { maxN: 5 } }, expect.objectContaining({ kind: 'conditional' }), { kind: 'atom', verb: 'deckToBottomBound', args: { order: 'shuffle' } }] } });
    // qa: card:B02019:36040207c663913a76bf2b7030b9daafb014c13663ca2925f5b95cdffd73e565
    expect(ability(B02019, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'choice' } });
    // qa: card:B02020:247ac8c7fe983ab68efeb4042a049fdd29d3f4e791973deaf6762d404f12a1fa
    expect(ability(B02020, 'a1')).toMatchObject({ trigger: { hook: 'setcard:leave', matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } } });
    // qa: card:B02020:4ef0bb784426e7ce588376640d02c4cfcfdca1b043386397c9b03242f88b026b
    expect(ability(B02020, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charSetCard' }, { kind: 'atom', verb: 'draw', args: { n: 1 } }] } });
    // qa: card:B02021:c62005cc7ec28939774f45c9304d940c076e7468e742a2035e5a64550879d7b5
    expect(ability(B02021, 'a1')).toMatchObject({ type: 'declared', effect: { kind: 'atom', verb: 'charModifyAP', args: { side: 'opp', max: 5, delta: -1000 } } });
  });

  it('pins filters, set-card occurrence selection, and switch-enter paths', () => {
    // qa: card:B02025:1fbf92783e12ea81de33d70f2415f6425bc895cd5913bfc0999f874df11b1c18
    expect(ability(B02025, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'handAddFromRemove', args: { filter: { keyword: 'カットイン', color: '緑' } } } });
    // qa: card:B02026:c8245b76f64a5c18d2ef397788520cdd43f88140f600ec58722c085c2864da15
    expect(ability(B02026, 'a1')).toMatchObject({ trigger: { hook: 'action:declare' }, condition: { kind: 'triggerCharMatches', side: 'opp' }, effect: { kind: 'atom', verb: 'draw', args: { n: 1 } } });
    // qa: card:B02033:a909826ba53b8b3766a67a9c2aa55779122dc723f38e487f6eeaa29bdaed57ca
    expect(ability(B02033, 'a1')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'charRemoveSetCard', args: { side: 'self', n: 2, minimumPolicy: 'exact' } }, expect.objectContaining({ kind: 'atom', verb: 'sceneRemove' })] } } });
    // qa: card:B02038:d80f04fd9ed2fa2cc2d120f6086e1121f6342b9135da0bfe0abfeb59a2967713
    expect(ability(B02038, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', viaEffect: true, enterSleep: true } } });
    // qa: card:B02039:b2d2473190504c7e8580af6274f15741f3adb10895f3fa15e827c82e86005cba
    expect(ability(B02039, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'bindPick', args: { side: 'either', selectionSubject: 'set-card' } }, { kind: 'setCardToEvidence', hostUid: '$host.uid' }, { kind: 'atom', verb: 'sceneRemove' }] } });
    // qa: card:B02039:eecbfe6b0191ff5e7cd4ecf435ea84f70f88527bd1dac061716fba32f38fdbd2
    expect(ability(B02039, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'either', max: 1, bind: '$host', filter: { hasSetCards: true }, selectionSubject: 'set-card' } }, { kind: 'setCardToEvidence', hostUid: '$host.uid' }, { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1 } }] } });
    // qa: card:B02040:106e80b103b8ffe9b858d82d77c3198f71e67811ec7d5cff1a786171457815f1
    expect(ability(B02040, 'a2')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'choice' } });
    expect(ability(B02040, 'a2').condition).toBeUndefined();
    // qa: card:B02046:edadc1f0bf8b00f745f8d3c037c7a85722d2338f8923c259e60c59231de86961
    expect(JSON.stringify(ability(B02046, 'a1').effect)).toContain('"color":"白"');
    expect(JSON.stringify(ability(B02046, 'a1').effect)).not.toContain('"excludeSelf":true');
    // qa: card:B02050:5978e80829eecc2a501c3a8c97ffca7a1bfaed9654209ddecdd05d1af3edbbf2
    expect(ability(B02050, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { keyword: '変装' } } }, expect.objectContaining({ kind: 'conditional' }), { kind: 'atom', verb: 'deckToBottomBound', args: { order: 'preserve' } }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B02050:b32a63d8b5cf1c8e71f20ccb817ee97888a391b5359b7618f6208aa4ca783fb9
    expect(JSON.stringify(ability(B02050, 'a1').effect)).toContain('"keyword":"変装"');
    // qa: card:B02050:f53ff4daf04e336328173588d6525fc63157aebb98153aa7f5056dffb27d5831
    expect(JSON.stringify(ability(B02050, 'a1').effect)).toContain('"cardId":"$matched.cardId"');
  });
});
