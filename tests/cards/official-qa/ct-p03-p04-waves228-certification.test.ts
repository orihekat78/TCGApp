import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B03111 } from '@/cards/ct-p03/B03111';
import { B03113 } from '@/cards/ct-p03/B03113';
import { B03115 } from '@/cards/ct-p03/B03115';
import { B03116 } from '@/cards/ct-p03/B03116';
import { B03118 } from '@/cards/ct-p03/B03118';
import { B03124 } from '@/cards/ct-p03/B03124';
import { B03126 } from '@/cards/ct-p03/B03126';
import { B03133 } from '@/cards/ct-p03/B03133';
import { B03134 } from '@/cards/ct-p03/B03134';
import { B04003 } from '@/cards/ct-p04/B04003';
import { B04004 } from '@/cards/ct-p04/B04004';
import { B04005 } from '@/cards/ct-p04/B04005';
import { B04011 } from '@/cards/ct-p04/B04011';
import { B04017 } from '@/cards/ct-p04/B04017';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave228: CT-P03/CT-P04 certification links', () => {
  it('pins the selected Wave228 contracts', () => {
    // qa: card:B03111:2c7998cc028501f58536dbbcb3887fb43c9235defd63c220a8b52dabf5728aeb
    expect(ability(B03111, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: expect.arrayContaining([{ kind: 'atom', verb: 'discard', args: { player: 'opp', side: 'opp', max: 1, chooser: 'source', filter: { levelMax: 7 } } }]) } });
    // qa: card:B03113:ac42b9b6b83f8330505fcbb8fc65d591f7171516a8b92793bb496f12fec2ba0e
    expect(ability(B03113, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', enterSleep: true, filter: { keyword: 'カットイン', color: '黒', levelMax: 6, cardNameNot: 'シェリー', kind: 'character' } } } });
    // qa: card:B03115:40de75b9d1cf88ded7905380320856b0b6bef08cf7f1d0dc22c9fb91936c9b5a
    expect((ability(B03115, 'a1').effect as { steps: unknown }).steps).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'sceneRemove', args: expect.objectContaining({ max: 1, side: 'either', filter: { levelMax: 7 } }) }), expect.objectContaining({ kind: 'atom', verb: 'deckRevealUntil', args: expect.objectContaining({ maxN: 3, chooseMatch: 'upTo' }) })]));
    // qa: card:B03116:6d00eabe29a7a4e6bbdca2e810c993d56415fc94c3310a33400a53ebd1b54db6
    expect(ability(B03116, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true, matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' } } });
    // qa: card:B03116:a6bb5d67e6553d8adcfe55f24e55c8fd3880aa2983846bf8aa085c859af4b3eb
    expect((ability(B03116, 'a1').effect as { effect: { steps: unknown } }).effect.steps).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'sceneEnter', args: expect.objectContaining({ from: 'remove', enterSleep: true, filter: { cardId: 'B03116', kind: 'character' } }) }), expect.objectContaining({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } })]));
    // qa: card:B03116:b1a3c7472a2248be278d144ae47014dab080904c11c3b6229b08fcb231d415ca
    expect(ability(B03116, 'a1').trigger).toMatchObject({ matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' } });
    // qa: card:B03118:2c83e05699547a122e72d36589adce2d81152f65597bff1f1551047f02568ed9
    expect(ability(B03118, 'a1')).toMatchObject({ trigger: { hook: 'cutin:used', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } }, effect: { kind: 'conditional', then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } } } });
    // qa: card:B03118:671a506d6cd45b85ab6e121432c77d00d150acccde74ac53b33970e89b80f54f
    expect(ability(B03118, 'a1')).toMatchObject({ trigger: { hook: 'cutin:used', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } } });
    // qa: card:B03124:21d4eacf7e699ac86bd9eb8eb7cdc8f1569d5274e70ee49f1b2674bf4935f406
    expect(ability(B03124, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'turn', player: 'self' }, { kind: 'or', cs: expect.arrayContaining([{ kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' }, { kind: 'charStateIs', ref: { kind: 'self' }, state: 'stun' }]) }]) }, effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } } });
    // qa: card:B03126:3940f9d86c38223db433db0533d882b61e7f9fbf6678432870a970bac4b923dc
    expect(ability(B03126, 'a2')).toMatchObject({ type: 'continuous', scope: 'on-scene', condition: { kind: 'caseStatus', status: '事件編' } });
    // qa: card:B03126:4960b906976210e8a8d17152c0f10630265edca04f7db484487532b661306134
    expect(ability(B03126, 'a4')).toMatchObject({ trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'setEvidenceGainSuppress', args: { player: 'opp' } } });
    // qa: card:B03133:1e961bf3b2c6df24acf6980f056aec9100da1150768e2ea61dd3f4a27a1abbca
    expect((ability(B03133, 'a1').effect as { steps: unknown }).steps).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'handAddFromRemove', args: expect.objectContaining({ target: expect.objectContaining({ query: { area: 'remove', side: 'self', filter: { keyword: 'カットイン', color: '黒', levelMax: 6, kind: 'character' } }, n: { min: 0, max: 2 } }) }) }), expect.objectContaining({ kind: 'atom', verb: 'sceneEnter', args: expect.objectContaining({ from: 'hand', target: expect.objectContaining({ query: { area: 'hand', side: 'self', filter: { keyword: 'カットイン', color: '黒', levelMax: 6, kind: 'character' } }, n: { min: 0, max: 1 } }) }) })]));
    // qa: card:B03134:188b2d6f83797c96358c655feb495cae9dc5623eb891b3efa0c83b3bb0489d93
    expect(B03134).toMatchObject({ useCondition: { kind: 'evidenceDiff', player: 'opp', other: 'self', n: 0 } });
    // qa: card:B04003:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
    expect(ability(B04003, 'a1')).toMatchObject({ type: 'triggered', limit: { kind: 'turn', n: 1 }, condition: { kind: 'turn', player: 'opp' }, trigger: { hook: 'effect:choose-intercept-discard' } });
    // qa: card:B04004:c4bf200070ebb849ade4f9529a877e70c1bcf4cdca3707aca8a4c08553c97c9a
    expect(ability(B04004, 'a3')).toMatchObject({ trigger: { hook: 'action:declare', matcherCondition: { kind: 'and', cs: expect.arrayContaining([{ kind: 'triggerCharMatches', side: 'opp', filter: {} }, { kind: 'triggerCharMatches', payloadKey: 'targetUid', side: 'self', filter: { cardName: '工藤新一' } }]) } }, effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } } });
    // qa: card:B04005:4c46fd7fa4a42a6490a220d032289b21718f5c35f9a380bbe6ea24b4ee5406ba
    expect(ability(B04005, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } }, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } }] } });
    // qa: card:B04011:fb85c35318daa553893c8d8f4e1e5089b71b47b1ea967fc8e2d044a229530a79
    expect(ability(B04011, 'a1')).toMatchObject({ type: 'declared', cost: { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '江戸川コナン' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 } });
    // qa: card:B04017:34b5e50478a370f3ee9ce8bf309eeb4e4825d1b3115ec9eeab3024bdaf99dfa9
    expect(ability(B04017, 'a1')).toMatchObject({ limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'sceneRemove', args: { max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } } });
  });
});
