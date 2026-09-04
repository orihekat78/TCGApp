import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B04018 } from '@/cards/ct-p04/B04018';
import { B04020 } from '@/cards/ct-p04/B04020';
import { B04023 } from '@/cards/ct-p04/B04023';
import { B04025 } from '@/cards/ct-p04/B04025';
import { B04030 } from '@/cards/ct-p04/B04030';
import { B04032 } from '@/cards/ct-p04/B04032';
import { B04035 } from '@/cards/ct-p04/B04035';
import { B04036 } from '@/cards/ct-p04/B04036';
import { B04038 } from '@/cards/ct-p04/B04038';
import { B04046 } from '@/cards/ct-p04/B04046';
import { B04049 } from '@/cards/ct-p04/B04049';
import { B04051 } from '@/cards/ct-p04/B04051';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave229: CT-P04 certification links', () => {
  it('pins the selected Wave229 contracts', () => {
    // qa: card:B04018:1cff047db42defa99d9c10428e9c621b6c071eac37f84c93bac71452277573e3
    expect(ability(B04018, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'charDisableOriginal', args: { scope: 'turn' } } });
    // qa: card:B04018:36734fdd1afd79ae6ce6120cfbdfd851414076ce12cd7eb35984bb9dbd799fed
    expect(ability(B04018, 'a1').limit).toBeUndefined();
    // qa: card:B04020:24724a7bdd74ed439861b6795dd7242b2f30cd9413262f35d42547dc0d2c5ebe
    expect(ability(B04020, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: {} });
    // qa: card:B04020:b81931704de9af84613cb5a02351a560fd8db0a630bb19f574fc3a52368cbbfc
    expect(ability(B04020, 'a1').condition).toMatchObject({ kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 3 });
    // qa: card:B04023:67a00175a6726109cac75b35df2485259e72759c0b5c278a48ac947ffdd52f2f
    expect((ability(B04023, 'a2').effect as { steps: unknown[] }).steps).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'conditional', then: expect.objectContaining({ kind: 'atom', verb: 'handAddFromDeck' }) })]));
    // qa: card:B04025:f80ee11bbdf1576f3319fc63e5072225b033dc6250426ed4a4db16a0b698c354
    expect(ability(B04025, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', optional: true }, effect: { kind: 'sequence', steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'charModifyAP', args: expect.objectContaining({ delta: 1000, scope: 'contact' }) })]) } });
    // qa: card:B04030:5e64c29e1ffcc111dbcccfe71778b02ee324354900b53f8feecdf316419a232c
    expect(ability(B04030, 'a1').effect).toMatchObject({ kind: 'sequence', steps: expect.arrayContaining([expect.objectContaining({ kind: 'conditional', then: expect.objectContaining({ kind: 'choice' }) })]) });
    // qa: card:B04030:fea86e813ffc71be74d68515b98d60749c639a2b001343462c0406961b3b900f
    expect(ability(B04030, 'a1').effect).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'deckRevealUntil', args: expect.objectContaining({ chooseMatch: 'upTo', maxN: 4 }) })]) });
    // qa: card:B04032:1c06bf42b4f0a4e87e760d612038f4bde5afe72aeb2f69ffba9c046565ef93f3
    expect(ability(B04032, 'a1').condition).toMatchObject({ kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '探偵' } }, nMin: 5 });
    // qa: card:B04035:e66d2a10a7954a6f390c38ef9deee6a111e97a8f041709cf845c223784da1be0
    expect(ability(B04035, 'a1').condition).toMatchObject({ kind: 'sceneHas', query: { filter: { trait: 'マジシャン' }, excludeSelf: true }, nMin: 1 });
    // qa: card:B04036:85b5204252fb5d0f920b8ca24a4c4a558ff4289ade94a6e6ba36333bb3add78e
    expect(ability(B04036, 'a1').condition).toMatchObject({ kind: 'sceneHas', query: { filter: { trait: '鈴木財閥' } }, nMin: 3 });
    // qa: card:B04038:c75dd53cd2f42fe1583eb7a2d46a5718ca908025308d9470fbd38556c6efded3
    expect(ability(B04038, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'removeAreaAllToDeckBottom', args: { player: 'self' } } });
    // qa: card:B04046:0e763459c54bdcf42dfb525d359b72916c0ee930f5edf66e91bf5e31883c06a5
    expect(ability(B04046, 'a3').effect).toMatchObject({ kind: 'atom', verb: 'charGrantAbility', args: { ability: { effect: { kind: 'sequence', steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'sceneRemove', args: expect.objectContaining({ cause: 'effect' }) })]) } } } });
    // qa: card:B04046:640df767ce1693a6c289ab1d9869c461083d1e678224db8ace1d58f9f308af94
    expect(ability(B04046, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'turn', player: 'self' }, continuousModifier: { lvlDeltaAuraOpp: -1 } });
    // qa: card:B04046:ecb6a9e4fbdc202c0b4c01309335e615f08fd225dffb4495f415ed9036803c7c
    expect(ability(B04046, 'a3').effect).toMatchObject({ args: { ability: { trigger: { hook: 'contact:start', selfOnly: true } } } });
    // qa: card:B04049:1f6154f44f9b68d99d89d65171c3d96732fea0c6bbecb45554c08b9776bd1bb2
    expect(ability(B04049, 'a1').effect).toMatchObject({ kind: 'conditional', if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' } });
    // qa: card:B04051:774346e7538cb548de193ca2e380c26f13042b038e0f98c364634b3708d3c45f
    expect(ability(B04051, 'a1').effect).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ kind: 'atom', verb: 'deckRevealUntil', args: expect.objectContaining({ bind: '$revealed' }) }), expect.objectContaining({ kind: 'atom', verb: 'deckToBottomBound', args: expect.objectContaining({ bindKey: '$revealed' }) })]) });
    // qa: card:B04051:8930858a0e9e1ac1be794af6be6a0c4f945f9f932f6bf4fca644e428f7222d67
    expect(ability(B04051, 'a1').effect).toMatchObject({ steps: expect.arrayContaining([expect.objectContaining({ kind: 'conditional', then: expect.objectContaining({ kind: 'atom', verb: 'handAddFromDeck' }) })]) });
  });
});
