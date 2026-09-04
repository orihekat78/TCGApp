import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B06016 } from '@/cards/ct-p06/B06016';
import { B06017 } from '@/cards/ct-p06/B06017';
import { B06018 } from '@/cards/ct-p06/B06018';
import { B06025 } from '@/cards/ct-p06/B06025';
import { B06026 } from '@/cards/ct-p06/B06026';
import { B06028 } from '@/cards/ct-p06/B06028';
import { B06032 } from '@/cards/ct-p06/B06032';
import { B06033 } from '@/cards/ct-p06/B06033';
import { B06035 } from '@/cards/ct-p06/B06035';
import { B06037 } from '@/cards/ct-p06/B06037';
import { B06038 } from '@/cards/ct-p06/B06038';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave238: CT-P06 certification links', () => {
  it('pins the selected Wave238 contracts', () => {
    // qa: card:B06012:57403b2d19b8b528fcd5426a65814839cfc293100cfdcce09c518127ed94eec0
    // qa: card:B06012:bd67dbe9cade0deddafb4cbadad23f58738d4185aa2f881da6e9284c89d2f555
    expect(ability(B06012, 'a2')).toMatchObject({ scope: 'on-set-host', trigger: { hook: 'contact:start' }, condition: { kind: 'charMatches', filter: { trait: '少年探偵団' } }, effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, scope: 'contact' } } });
    // qa: card:B06016:23a740f620086ad342c47dd447df4a799b42fbe6dd7969e47638689a9cb31947
    // qa: card:B06016:eaa965ba1260e6f987035fce6a1df51650b1f6923ad53aec1782c6fa0b33b8c9
    expect(ability(B06016, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'partnerColor', color: '緑' }, effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'mill', args: { n: 3, gate: true } }, { kind: 'atom', verb: 'sceneRemove', args: { max: 1, filter: { apMax: 8000 } } }] } } });
    // qa: card:B06017:9b784e18994d29858b6b12d02bf7ddc0e040914733a510db8aca6110febbb969
    expect(ability(B06017, 'a3')).toMatchObject({ type: 'icon-disguise', condition: { kind: 'and', cs: [{ kind: 'caseTrait', trait: 'YAIBA' }, { kind: 'fileAtLeast', n: 5 }] } });
    // qa: card:B06018:4ee1867360fe69dcc32ae106bf6665fca2c9bf3bd397482d79ed1cdd6aa4bf5b
    // qa: card:B06018:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
    expect(ability(B06018, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'caseTrait', trait: 'YAIBA' }, effect: { kind: 'optional', effect: { kind: 'chain' } } });
    // qa: card:B06025:085495deba9be1de9b97404442112016cc77d5e038728923c3023be0f228d891
    // qa: card:B06025:ca1a43dd9230f4f902c30074c88754f646cb56368872f76e14bf7f49da2282fc
    expect(ability(B06025, 'a2')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { max: 1, gateOnMissing: true } }, { kind: 'atom', verb: 'sceneEnter', args: { exactSelectedCardIndex: true, sourceRequired: true } }] } });
    // qa: card:B06026:6d15fbf77a9dac13a56381d3bff5ef7c2ced93af64575333a0d59050ed5e828b
    expect(ability(B06026, 'a2')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true }, condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'selfToEvidence', args: { faceUp: true } } });
    // qa: card:B06028:26711353e65faa3ad8bf70080ce579d0169370e3ea4c6cc02a11bffe428431ce
    // qa: card:B06028:564401e1c83ef88c670ab4df1a4469f0b77be52524ef301fef318a984d8a1805
    expect(ability(B06028, 'a1')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, condition: { kind: 'and' }, effect: { kind: 'atom', verb: 'sceneRemove', args: { cause: 'effect' } } });
    // qa: card:B06032:86a4a404874542f92ec0f62d0c53d353688fb60d9ccc6b8a1a86023868ee2daa
    // qa: card:B06032:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
    expect(ability(B06032, 'a1')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'optional', effect: { kind: 'chain' } } });
    // qa: card:B06033:7b131bec4c8adf645897bcb899c9cf6491cf6d8e5ef91869c2620968e6ac1995
    expect(ability(B06033, 'a1')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'chain' }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'hand', max: 1, filter: { trait: 'YAIBA', levelMax: 6 } } }] } });
    // qa: card:B06035:9e8f0558023c02a4b87236725dd1b3167831cd8d4708d5563ef872ea2abd278a
    expect(ability(B06035, 'a2')).toMatchObject({ scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, condition: { kind: 'and' }, effect: { kind: 'optional', effect: { kind: 'chain' } } });
    // qa: card:B06037:2d3f6690dad859b1151219ac434ed0ec7538bd216ef8e3ae3de1789fe8b7cd07
    // qa: card:B06037:bf097a63850607886d0f45140dbaa871815f7bd018e31c8d22ecb346375ac8a8
    expect(ability(B06037, 'a2')).toMatchObject({ type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'turn', bind: '$picked' } }, { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'actionTargetsActive', val: true } }] } });
    // qa: card:B06038:dbd263c01fd82009a9183c98060a919ce66f7ae8ccb9ffb6afdfd2ff8e8aac89
    expect(ability(B06038, 'a3')).toMatchObject({ trigger: { hook: 'evidence:gain', selfOnly: true }, effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } } });
  });
});
