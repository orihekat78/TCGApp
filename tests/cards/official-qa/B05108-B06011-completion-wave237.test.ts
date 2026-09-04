import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B05108 } from '@/cards/ct-p05/B05108';
import { B05110 } from '@/cards/ct-p05/B05110';
import { B05114 } from '@/cards/ct-p05/B05114';
import { B05116 } from '@/cards/ct-p05/B05116';
import { B05120 } from '@/cards/ct-p05/B05120';
import { B06003 } from '@/cards/ct-p06/B06003';
import { B06004 } from '@/cards/ct-p06/B06004';
import { B06008 } from '@/cards/ct-p06/B06008';
import { B06010 } from '@/cards/ct-p06/B06010';
import { B06011 } from '@/cards/ct-p06/B06011';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave237: CT-P05/CT-P06 certification links', () => {
  it('pins the selected Wave237 contracts', () => {
    // qa: card:B05108:539d662d763a316dbed21c57208b2b70b54025061463342a6b6eae7fb401789f
    // qa: card:B05108:82bf4c26c2b32be909ba3e30dde7411bd141b06c77f8c4abae4192d2a1d68f0c
    expect(ability(B05108, 'a2')).toMatchObject({ condition: { kind: 'fileAtLeast', n: 6 }, trigger: { hook: 'action:end', selfOnly: true }, effect: { kind: 'optional' } });
    // qa: card:B05110:6f9410ff616747af138034b21e4841c850da9b6b6d0dd8993c64cfa3bc090b1b
    expect(ability(B05110, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'caseStatus', status: '事件編' }, continuousModifier: { printedKeywordWhenIconValid: true } });
    // qa: card:B05114:844962a343a6a8cb30e74e7af29660bfc18ffe26f0529a82c9560dbb086c5248
    // qa: card:B05114:df09df0cd47f269cc1fa9e9b1be466e3dcd064fb59a53004e0de3397aaa2e768
    expect(ability(B05114, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'selfToDeckBottom' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { cardName: 'バーボン' } } }, { kind: 'conditional' }, { kind: 'atom', verb: 'deckToBottomBound' }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B05116:47135bcebe41874f06f36319a3ddb99f2cd3a8ea2ff4ecbcfa7eef77d85768a7
    // qa: card:B05116:591941330ed685d92393564b7c3f5654a5a39a8a607f466572ad125f55ed3121
    // qa: card:B05116:da2d1d94463f8d15c325fdc475e401008c7aa82bb449aef2dd61de22c6667fdf
    expect(ability(B05116, 'a1')).toMatchObject({ type: 'continuous', scope: 'on-scene', continuousModifier: { mustBeSelectedByOppEvent: true } });
    // qa: card:B05120:0344326f0d096542a20d08638ac7053181e88bdbe689d4c051caf0b6bac71225
    // qa: card:B05120:97d413b6a4f8525037a1a5086bdf7aab4b9be106060fbf76a7e56787106b4ea4
    expect(ability(B05120, 'a2')).toMatchObject({ type: 'continuous', continuousModifier: { handUseRestrictFilter: { trait: ['探偵'] } } });
    // qa: card:B06003:081470430b695c050ff4896b4e65c2431c47293ebc8f43eb533feee101388d2f
    // qa: card:B06003:fced1d015e08a0f883b45e00d8ddbcb8f165831c0288c0eec8547f20fb413147
    expect(ability(B06003, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'selfLpDeltaTurn', delta: -2 }, effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'sleep' } } });
    // qa: card:B06004:2cdfbf4e0f6aa22ba6ade98705a08b6f260291f3e528e236990015cc0230538c
    expect(ability(B06004, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'and' }, continuousModifier: { apDeltaAura: 1000, auraFilter: { cardName: '毛利蘭', kind: 'character' } } });
    // qa: card:B06008:1bea434f8670949f1cf80b187764e6b79b18648c8fc2aff378c8d644ed53e5a3
    // qa: card:B06008:908852c38dd812fd1f4d2e327024bbc4152e5b70275cf065faf6fbd7df2679ff
    expect(ability(B06008, 'a2')).toMatchObject({ trigger: { hook: 'action:end', selfOnly: true }, effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'charStackCard', args: { fromSelf: true, n: 1 } }, { kind: 'atom', verb: 'draw', args: { n: 1 } }] } });
    // qa: card:B06010:988a97e65ef9c51bf74af50e707e48ba23e53682d786f1a982d7523689cdf8c6
    expect(ability(B06010, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'selfToDeckBottom' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { trait: '高校生', kind: 'character' } } }, { kind: 'conditional' }, { kind: 'atom', verb: 'deckToBottomBound' }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B06011:055bf4554f6680db8530406f0bed1b4160569aa3536855c1f57607967e7ba6c9
    // qa: card:B06011:29ce0665c1a75d6902ba1bd387a77600dbdcfadb54470e09a6a9c73b805e0723
    expect(ability(B06011, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'partnerColor', color: '青' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { levelMin: 7, cardName: '工藤新一' } } }, { kind: 'conditional' }, { kind: 'atom', verb: 'deckToBottomBound' }, { kind: 'atom', verb: 'deckShuffle' }] } });
  });
});
