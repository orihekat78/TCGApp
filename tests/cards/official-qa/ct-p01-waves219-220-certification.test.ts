import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B01066 } from '@/cards/ct-p01/B01066';
import { B01070 } from '@/cards/ct-p01/B01070';
import { B01071 } from '@/cards/ct-p01/B01071';
import { B01074 } from '@/cards/ct-p01/B01074';
import { B01082 } from '@/cards/ct-p01/B01082';
import { B01084 } from '@/cards/ct-p01/B01084';
import { B01087 } from '@/cards/ct-p01/B01087';
import { B01093 } from '@/cards/ct-p01/B01093';
import { B01094 } from '@/cards/ct-p01/B01094';
import { B01095 } from '@/cards/ct-p01/B01095';
import { B01098 } from '@/cards/ct-p01/B01098';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find(entry => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Waves219-220: CT-P01 certification links', () => {
  it('pins Wave219 timing and contact contracts to their shipped descriptors', () => {
    // qa: card:B01066:edaa0e1ba361648239edd948d382ab032e6aa3ec2d6b56ab74076ef7f900ef33
    expect(ability(B01066, 'a1')).toMatchObject({
      trigger: { hook: 'action:declare', selfOnly: true },
      limit: { kind: 'turn', n: 1 },
      effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
    });
    // qa: card:B01070:584628115ee8268afbb7e5f2750e8116de4e9d0b5b50de0086f846b95c1bb5f4
    expect(ability(B01070, 'a1')).toMatchObject({
      trigger: { hook: 'action:declare', matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'targetUid', requireSource: true } },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'contact' } },
    });
    // qa: card:B01071:0629cda6affbe354fdca1f11834d8360b6962be881f439e6112f1742f02ebae3
    expect(ability(B01071, 'a1')).toMatchObject({ trigger: { hook: 'action:declare' }, condition: { kind: 'triggerCharMatches', side: 'self', filter: { trait: 'FBI' } } });
    // qa: card:B01071:86ec67cac26d58dedcadf7255364aeae058e00214323a15f9bbc83aadc285dee
    expect(ability(B01071, 'a2')).toMatchObject({ trigger: { hook: 'action:declare' }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B01074:b2d6edcda9d8ff9b4508bd45fe365d41afd76529aabbd7dae53e3506a04d451b
    expect(ability(B01074, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:after-sleep', selfOnly: true } });
  });

  it('pins Wave220 state, declaration, and cut-in contracts to their shipped descriptors', () => {
    const b01082Steps = (ability(B01082, 'a1').effect as { steps?: unknown[] }).steps ?? [];
    // qa: card:B01082:d5e12470a488f5fff7a5c8744ee1bf72381334453fe8ba111bb032298a5cb2f8
    expect(b01082Steps).toContainEqual(expect.objectContaining({ kind: 'atom', verb: 'sceneSetState', args: expect.objectContaining({ state: 'sleep' }) }));
    // qa: card:B01082:6feef271ccc669032b420f176f053bce3c5b7f303f22b9c5f01c2e5b9a7ceee5
    expect(b01082Steps).toContainEqual(expect.objectContaining({ kind: 'atom', verb: 'charSetTurnEffect', args: expect.objectContaining({ key: 'noAutoActivateBySourceUid' }) }));
    // qa: card:B01084:3d3d8c58f72cd0c78e056c90549b1477f66f9c57d7eacdbf9f0fd5d2b7858eae
    expect(ability(B01084, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' } });
    // qa: card:B01087:842929818fcc535ffc500f67e8e46dba53b3d1781d87bc2f2ab23ad1f3c92860
    expect(ability(B01087, 'a1')).toMatchObject({ condition: { kind: 'bond', cardName: '降谷零' }, effect: { kind: 'choice', options: [{ kind: 'atom', verb: 'charModifyLP', args: { scope: 'turn' } }, { kind: 'atom', verb: 'charModifyAP', args: { scope: 'turn' } }] } });
    // qa: card:B01093:3798706f5cec52e26c9d5ccbc1d6814abd3f7994d2c921375d34bf9aab0363e4
    expect(ability(B01093, 'a2')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil' }, { kind: 'atom', verb: 'deckPlaceSplitBound' }] } });
    // qa: card:B01094:36ccfd238657f98cfcc0bbac0c317e98925dc3ff5e8f84f78fa9dc410bcfeb1b
    expect(ability(B01094, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'handAddFromRemove', args: { target: { n: { min: 0, max: 1 } } } }, { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[キャラ]' } }] } });
    // qa: card:B01095:195760dc4300544466f618b9907f581e378f680cddb224824c7acf98a961de18
    expect((ability(B01095, 'a1').effect as { steps?: unknown[] }).steps).toContainEqual(expect.objectContaining({ kind: 'atom', verb: 'declareName', args: expect.objectContaining({ bind: 'named' }) }));
    // qa: card:B01095:7fd96e0746c8292ec5c55c1b6aabcff60e70a5f163392c0baf95cd026581e305
    expect((ability(B01095, 'a1').effect as { steps?: unknown[] }).steps).toContainEqual(expect.objectContaining({ kind: 'atom', verb: 'souza', args: expect.objectContaining({ bind: '$found' }) }));
    // qa: card:B01095:9991e7398163ddf853c2fe9cc34b3aedb480efd05be4310b9bfecd5236cad875
    expect((ability(B01095, 'a1').effect as { steps?: unknown[] }).steps).toContainEqual(expect.objectContaining({ kind: 'conditional', if: expect.objectContaining({ kind: 'boundNameMatchesDeclared', bindKey: '$found', declareKey: 'named' }) }));
    // qa: card:B01098:733555e80841438c996460ae078c931e62cc9d13cb44d30171bdc098a65b843b
    expect(ability(B01098, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.targetUid', cause: 'effect' } }, { kind: 'atom', verb: 'sceneRemove', args: { uid: '$contact.byUid', cause: 'effect' } }] } });
    // qa: card:B01098:e35b773a1e379ce698d6351adf98cfe1473473701fa9f8ec900b4efaf6280149
    expect(ability(B01098, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', selfOnly: true }, effect: { kind: 'sequence', steps: [{ args: { cause: 'effect' } }, { args: { cause: 'effect' } }] } });
  });
});
