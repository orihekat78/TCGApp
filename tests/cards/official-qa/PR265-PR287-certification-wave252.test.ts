import { describe, expect, it } from 'vitest';
import { PR265 } from '@/cards/pr-01/PR265';
import { PR269 } from '@/cards/pr-01/PR269';
import { PR270 } from '@/cards/pr-01/PR270';
import { PR271 } from '@/cards/pr-01/PR271';
import { PR274 } from '@/cards/pr-01/PR274';
import { PR275 } from '@/cards/pr-01/PR275';
import { PR276 } from '@/cards/pr-01/PR276';
import { PR278 } from '@/cards/pr-01/PR278';
import { PR279 } from '@/cards/pr-01/PR279';
import { PR281 } from '@/cards/pr-01/PR281';
import { PR286 } from '@/cards/pr-01/PR286';
import { PR287 } from '@/cards/pr-01/PR287';

function ability(card: { abilities: readonly any[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, id).toBeDefined();
  return found!;
}

describe('official QA Wave252: PR265 through PR287 certification links', () => {
  it('pins every selected Wave252 contract', () => {
    // qa: card:PR265:b229204257dd8786d8b2f1d1b01ec0a089d67aa30ac1b2a02fdc4cf74741154c
    expect(ability(PR265, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', maxN: 1, filter: { trait: '警視庁', kind: 'character' } } }, expect.anything(), { kind: 'atom', verb: 'deckToBottomBound' }] } });

    // qa: card:PR269:31607aa1d084df5546311c9007f151ad3fe4be0e439c904ad5625aba5449ffe3
    // qa: card:PR269:58763c5eec112da565cbb2892250eb844e45725c5b8575645188326a1a98dcd7
    expect(ability(PR269, 'a1')).toMatchObject({ continuousModifier: { apDelta: { dyn: '$self.partnerAreaTraitCount.ビッグジュエル * 1000' } } });
    expect(ability(PR269, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'optional' } });

    // qa: card:PR270:6b444418b53eaa4b0cd2234a2aeee84ff79aba7866f248a18188ac094b318bb4
    // qa: card:PR270:746f4f2e36b44df4fb6468035e26426d2233a68134842e5268da0addea30bb0d
    // qa: card:PR270:e8c9859ff65a57a2af2ecdc6f59d6a08e69035c40ba4b778a6c66b02d3ed7a37
    expect(ability(PR270, 'a1')).toMatchObject({ continuousModifier: { lvlDelta: 2 } });
    expect(ability(PR270, 'a2')).toMatchObject({ effect: { kind: 'conditional', if: { kind: 'sceneHas', nMin: 3, query: { filter: { levelMin: 7, levelMax: 7 } } } } });

    // qa: card:PR271:b229204257dd8786d8b2f1d1b01ec0a089d67aa30ac1b2a02fdc4cf74741154c
    expect(ability(PR271, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', maxN: 1 } }, expect.anything(), expect.anything()] } });

    // qa: card:PR274:a0692baedc0d83ca518e34f6679fd50c5febf296179e69dc6e1ddeb5fbae981a
    expect(ability(PR274, 'a1')).toMatchObject({ condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'caseColor', color: ['赤', '緑', '黄', '黒', '白'] }] }, continuousModifier: { apDeltaAura: 1000, auraExcludeSelf: true } });
    // qa: card:PR275:a0692baedc0d83ca518e34f6679fd50c5febf296179e69dc6e1ddeb5fbae981a
    expect(ability(PR275, 'a1')).toMatchObject({ continuousModifier: { apDeltaAura: 1000, auraFilter: { kind: 'character' }, auraExcludeSelf: true } });

    // qa: card:PR276:6fe11e5418640048ac99cf97c9cc3f812812e91e17d5925b91947ad842d6ab7a
    // qa: card:PR276:c7c8dcb6d4a6c2c5cb3062540711c11bc42ea95cfab749b3b005f736caeddd88
    expect(ability(PR276, 'a2')).toMatchObject({ trigger: { hook: 'action:declare', selfOnly: true }, effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'mill', args: { n: 2, gate: true } }, { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'action' } }] } } });

    // qa: card:PR278:6afacc527edb1f91971747c8e7b4a6281ce88b569f711f8e310a8222bfbc85a1
    expect(ability(PR278, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'partnerColor', color: '黄' }, effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'conditional', if: { kind: 'contactCharMatches', who: 'byUid', filter: { trait: ['警察'] } } }] } });

    // qa: card:PR279:c1f437826b40caf252061e243504d31be2f52607eee2bb9ca14dee62f4ee00fb
    expect(ability(PR279, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { opponentEventRestrict: ['remove'] } });

    // qa: card:PR281:0e88a4f091552954ddb522f6c6858e2bf997b67d641650f5887cfceaa83c971d
    // qa: card:PR281:766ba64cdf9e4355a6ba59787e59d931f36629e5d8cdf9cc4c01ebca2b24903b
    expect(ability(PR281, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'partnerColor', color: '青' } });
    expect(ability(PR281, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'conditional', if: { kind: 'sceneHas', nMin: 3, query: { filter: { trait: '少年探偵団' } } } } });

    // qa: card:PR286:503214a02f4aed5722f530357639b8f16a4d6a9d218eb826b4fa47693c36556e
    expect(ability(PR286, 'a2')).toMatchObject({ type: 'declared', condition: { kind: 'caseStatus', status: '解決編' }, effect: { kind: 'atom', verb: 'setShippuWaive', args: { player: 'self' } } });

    // qa: card:PR287:6afacc527edb1f91971747c8e7b4a6281ce88b569f711f8e310a8222bfbc85a1
    expect(ability(PR287, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'conditional', if: { kind: 'contactCharMatches', who: 'byUid', filter: { trait: ['警察'] } } }] } });
  });
});
