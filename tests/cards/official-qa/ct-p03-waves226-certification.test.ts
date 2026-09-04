import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B03069 } from '@/cards/ct-p03/B03069';
import { B03074 } from '@/cards/ct-p03/B03074';
import { B03075 } from '@/cards/ct-p03/B03075';
import { B03076 } from '@/cards/ct-p03/B03076';
import { B03077 } from '@/cards/ct-p03/B03077';
import { B03078 } from '@/cards/ct-p03/B03078';
import { B03081 } from '@/cards/ct-p03/B03081';
import { B03084 } from '@/cards/ct-p03/B03084';
import { B03085 } from '@/cards/ct-p03/B03085';
import { B03086 } from '@/cards/ct-p03/B03086';
import { B03087 } from '@/cards/ct-p03/B03087';
import { B03088 } from '@/cards/ct-p03/B03088';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave226: CT-P03 certification links', () => {
  it('pins mandatory opponent evidence, declared costs, and additive auras', () => {
    // qa: card:B03069:b34f939ceba2f547ad6f01ee968061869d0f8abc4e72fa0d51c20b0c14a53ee1
    expect(ability(B03069, 'a2')).toMatchObject({ condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'optional', effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } }, { kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1 } }] } } });
    // qa: card:B03074:cfaf7713d44f1abf5442770d5dbb1828c51f175509107a722f48cc79bae3b708
    expect(ability(B03074, 'a1')).toMatchObject({ limit: { kind: 'turn', n: 2 }, cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: ['赤井秀一', 'ライ'] } }, n: { min: 1, max: 1 } } } });
    // qa: card:B03075:adb7d52d8ebee97a3ddeae144be2c4b0e5b938c6772150552cca5e6ff2fd3124
    expect(ability(B03075, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDeltaAura: 1000, auraFilter: { color: '赤', kind: 'character' }, auraExcludeSelf: true } });
  });

  it('pins evidence and guard contracts', () => {
    // qa: card:B03076:2c84b78e008aa2e148d41f0f7987d8ae5c6fc9560011818b110bcc132060f7c2
    expect(ability(B03076, 'a2')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'draw', args: { n: 1 } } });
    // qa: card:B03077:dcb82eb7ead1f604b3c064e7ef8c95d90ff7fd41fdaa61704d8e6aa96f01c15d
    expect(ability(B03077, 'a1')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', fromTop: true } }, { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } }] } } });
    // qa: card:B03078:a985517684015a58e7ed7b638d9a0a18cdbb4580fdf117c98e4f4e5a0a81c363
    expect(ability(B03078, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { grantKeywords: expect.any(Function) } });
    expect(ability(B03078, 'a1').continuousModifier?.grantKeywords?.()).toEqual(['text:sleepGuard']);
    // qa: card:B03078:ab717b877440ccf12ca439ca47f1e70ed75377326ed0c3b03b7cdd1d12d9b1f0
    expect(ability(B03078, 'a1').continuousModifier?.grantKeywords?.()).toContain('text:sleepGuard');
    // qa: card:B03078:3459835ef11734bdac00b08e5c35eeac6f76f4792302ddac9d6ffee79e1a71be
    expect(ability(B03078, 'a1').scope).toBe('on-scene');
  });

  it('pins independent event sequencing and evidence movement', () => {
    // qa: card:B03081:4c46e482554c1e8621cdf1dd31a4f1df7b33c611b48695d07c3b02146fdee39b
    expect(ability(B03081, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneToHand', args: { target: { kind: 'pick', query: { area: 'scene', side: 'opp' }, n: { min: 0, max: 1 } } } }, { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } }] } });
    // qa: card:B03084:4cd1e8036091c51f36ef895e120577383b7160074287ee7d73fbebb74054ab82
    expect(ability(B03084, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'evidenceToDeckBottom', args: { player: 'opp', target: { kind: 'pick', query: { area: 'evidence', side: 'opp' }, n: { min: 0, max: 1 } } } }, { kind: 'atom', verb: 'sceneToEvidence', args: { player: 'opp', max: 1, filter: { levelMax: 7 }, faceUp: true } }] } });
    // qa: card:B03084:f2399915ee5c1b7aeab6906e5393b25263bf76824baa8c4ead8f2507b62a6c2a
    expect(ability(B03084, 'a1').effect).toMatchObject({ kind: 'sequence', steps: [{ kind: 'atom', verb: 'evidenceToDeckBottom', args: { target: { kind: 'pick', query: { area: 'evidence', side: 'opp' } } } }, expect.anything()] });
    // qa: card:B03084:d60238c0b2bcb2dc2a61e6699692dcfc328a673bc74786e5f2d0b3ce9d7fff0e
    expect(ability(B03084, 'a1')).toMatchObject({ effect: { kind: 'sequence' } });
    expect(ability(B03084, 'a1').effect).not.toMatchObject({ kind: 'chain' });
  });

  it('pins chained remove access, refresh timing, and entry-time keyword grants', () => {
    // qa: card:B03085:61dcd29262634521aaa07d0e63dcc1e0805849b9cc9f90d3910b3ac1f4f75d91
    expect(ability(B03085, 'a1')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', enterSleep: true, target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { trait: '警察', levelMax: 6, kind: 'character' } }, n: { min: 0, max: 1 } } } }] } } });
    // qa: card:B03085:a67e8f5fafb2be06f21abc12900155ec9a0cf9e0ee76c48982fe11899e9a70e4
    expect(ability(B03085, 'a2')).toMatchObject({ scope: 'on-evidence', condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } } });
    // qa: card:B03086:3f33b3f9d68b5490b3ef453c5bb02e675d28b6e4911d489e591c058068f7ebf7
    expect(ability(B03086, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { maxN: 3, bind: '$revealed', bindMatch: '$matched' } }, expect.anything(), { kind: 'atom', verb: 'boundToRemove', args: { bindKey: '$revealed', refreshAfter: true } }] } });
    // qa: card:B03087:9376e67f5b612e4009f7f91e3df6b878a97b927dac00a4403189d96e2aa03350
    expect(ability(B03087, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'opp' }, nMin: 3 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[キャラ]', scope: 'turn' } } } });
    // qa: card:B03087:b720ed600026056588b853c3d8c667dfb3d6d635a36f97d7138b94f7f2345bf8
    expect(ability(B03087, 'a1')).toMatchObject({ condition: { kind: 'partnerColor', color: '黄' }, effect: { kind: 'conditional', if: { kind: 'sceneHas', nMin: 3 } } });
  });

  it('pins permanent AP and legal active/self target selection', () => {
    // qa: card:B03088:63ef8e33c64e8eee1aa1e8caa9cbe8ed3caaaabb112828f3764484478cfce276
    expect(ability(B03088, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'either', filter: { levelMax: 7 }, delta: 1000, scope: 'permanent', bind: '$picked' } }, { kind: 'atom', verb: 'sceneSetState', args: { uid: '$picked.uid', state: 'active' } }, expect.anything(), expect.anything()] } });
    // qa: card:B03088:5a4999726e0fc32bc0789f91b5a02b5de6702355d0e149df27c161568e92a980
    expect(ability(B03088, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { side: 'either', max: 1 } }, expect.anything(), expect.anything(), expect.anything()] } });
  });
});
