// qa: card:B09097:0237a0c142d5e7feca1b4e4a9e92d3bf06f73c90344a81fa1ae51d869726b9b3
// qa: card:B09097:b7713abe7876ef1ad566c125fa172a4f2a13b192f2b22a4a2cea136020526dac
// qa: card:B09101:e4bfd093e51f7de5f557e06b272adb54e6d73f1329c7ee205a9406d7f885cd01
// qa: card:B09102:2c4400fb754558e01719a011fef8dd61a940683187cb23450c6aef9de67b3131
// qa: card:B09102:58e653d9c49856dc9de4392d6e300c58ecfbd1f8a97358141cef1a2af866c307
// qa: card:B09103:2d507903ab36126f938c276a8a8c062abb57b56f33145ef337d80dedb53883ce
// qa: card:B09103:c5e5dfbc5f228baa2e8456d556f8e0c51ee6af40acbfa37469da20356b5c7ad8
// qa: card:B09104:2ff985085270588f156ddf5ca26bf7b0a1b52d2f4f81c92ef94584017075c82a

import { describe, expect, it } from 'vitest';
import { B09097 } from '@/cards/ct-p09/B09097';
import { B09101 } from '@/cards/ct-p09/B09101';
import { B09102 } from '@/cards/ct-p09/B09102';
import { B09103 } from '@/cards/ct-p09/B09103';
import { B09104 } from '@/cards/ct-p09/B09104';

describe('official QA Wave196: CT-P09 trigger and condition contracts', () => {
  it('keeps B09097 discard state in its ordered draw and mill chain', () => {
    expect(B09097.abilities.find(ability => ability.id === 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { color: ['赤', '黒'] }, bind: '$removed' } }, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } }, { kind: 'conditional', if: { kind: 'boundMatchesFilter', bindKey: '$removed', filter: { levelMin: 7 } }, then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 3 } } }] } });
    expect(JSON.stringify(B09097.abilities.find(ability => ability.id === 'a1')?.effect)).toContain('mill');
  });

  it('gates B09101 solely on the controlling case trait', () => {
    expect(B09101.abilities.find(ability => ability.id === 'a1')).toMatchObject({ condition: { kind: 'caseTrait', trait: '犯人' } });
  });

  it('evaluates B09102 at the trigger path and exposes its Hirameki as a separate optional path', () => {
    expect(B09102.abilities.find(ability => ability.id === 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true }, condition: { kind: 'and' } });
    expect(B09102.abilities.find(ability => ability.id === 'a2')).toMatchObject({ trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'sceneRemove' } });
  });

  it('keeps B09103 trace AP live and its entry mill fixed at three', () => {
    expect(B09103.abilities.find(ability => ability.id === 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { apDelta: 2000 } });
    expect(B09103.abilities.find(ability => ability.id === 'a2')).toMatchObject({ effect: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 3 } } });
  });

  it('selects B09104 from printed scene-remove holders irrespective of its own turn gate', () => {
    expect(B09104.abilities.find(ability => ability.id === 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'charGrantKeyword', args: { target: { query: { filter: { keyword: '現場リムーブ時', kind: 'character' }, excludeSelf: true } } } } });
  });
});
