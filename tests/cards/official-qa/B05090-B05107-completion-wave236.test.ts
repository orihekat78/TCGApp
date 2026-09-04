import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B05090 } from '@/cards/ct-p05/B05090';
import { B05091 } from '@/cards/ct-p05/B05091';
import { B05093 } from '@/cards/ct-p05/B05093';
import { B05094 } from '@/cards/ct-p05/B05094';
import { B05095 } from '@/cards/ct-p05/B05095';
import { B05096 } from '@/cards/ct-p05/B05096';
import { B05097 } from '@/cards/ct-p05/B05097';
import { B05101 } from '@/cards/ct-p05/B05101';
import { B05102 } from '@/cards/ct-p05/B05102';
import { B05103 } from '@/cards/ct-p05/B05103';
import { B05106 } from '@/cards/ct-p05/B05106';
import { B05107 } from '@/cards/ct-p05/B05107';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave236: CT-P05 certification links', () => {
  it('pins the selected Wave236 contracts', () => {
    // qa: card:B05090:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
    // qa: card:B05090:6f9410ff616747af138034b21e4841c850da9b6b6d0dd8993c64cfa3bc090b1b
    expect(ability(B05090, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence', steps: [{ kind: 'choice' }, { kind: 'conditional' }, { kind: 'conditional' }] } });
    // qa: card:B05091:609e333a3590a8551d0867a7e64a3007fdca662df5a629ad6db6f55ee2497726
    expect(ability(B05091, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'bond', cardName: '降谷零' } });
    // qa: card:B05093:7bb2673d75370e56ee9b7ec8378ef524330bb3a8d590db6bdd01c48058a9ab95
    expect(JSON.stringify(ability(B05093, 'a1').effect)).toContain('deckReveal');
    // qa: card:B05094:90976e6f76d693f34044d7a3da5741b8f202cd109d3c957c80e0e6c88c6ea5f5
    // qa: card:B05094:f225a218227fdfa9b03201995e23f6532b97a7303ad0ccf6a1817d6814180124
    expect(JSON.stringify(ability(B05094, 'a1').effect)).toContain('deckRevealUntil');
    // qa: card:B05095:e868f2ff827bc830105448ea3da2060309c9851fa456ea4c325a9146c3f76c9e
    expect(ability(B05095, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyAP' } });
    // qa: card:B05096:2e6fbc5561e3e58d89fe1de157954ad40fafb24d3b7eb4e0a0fcbca23dd8a088
    // qa: card:B05096:f93a2659346899a7ff80fb8ed4b5248f01756c1a96ce538d8aa1ec49e3c160cc
    expect(ability(B05096, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'sceneSetState', args: { state: 'active', filter: { trait: '警察' } } } });
    // qa: card:B05097:4688bc9fab690514b01edcdced3733b77f257c5ce5789a65e6ca65e8bc6299a9
    // qa: card:B05097:9aa650322d1d377c52800c70e5c9d1177988595f1d876b2c0d496d77f238343b
    expect(ability(B05097, 'a2')).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'choice', chooser: 'self' } });
    // qa: card:B05101:fcb088168e8eed0fb44bc091cfbc93e9c1e03bb406b7265e63897cf78b6a4fac
    expect(ability(B05101, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'opp' }, trigger: { hook: 'leave:to-remove' } });
    // qa: card:B05102:896e7f971bcbe04b73d781740ad92d90d1accbb6fabee38d1c2271ea998bf3ae
    // qa: card:B05102:942ec5b4b6be9414e535212b514d9756f16366e58375ac84326d633cf167c19a
    expect(ability(B05102, 'a2')).toMatchObject({ trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'handAddFromRemove' } });
    // qa: card:B05103:85bca6e687747e9828127d44562cd74632555553b989f05863d2831e3bb83a30
    // qa: card:B05103:d60238c0b2bcb2dc2a61e6699692dcfc328a673bc74786e5f2d0b3ce9d7fff0e
    expect(ability(B05103, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove' }, { kind: 'conditional' }] } });
    // qa: card:B05106:8cf5eb4950e8312b31db28d2a069e5e170b1397f652a1eea210717feb81f21da
    expect(ability(B05106, 'a2')).toMatchObject({ type: 'declared', scope: 'on-partner-area', effect: { kind: 'chain' } });
    // qa: card:B05107:150d56974382234fa2cb62dac296c05a3a7d2907212678dac248eba3aca5ed11
    // qa: card:B05107:55c1684550ee77dd3bfeade13f5afdfea81d1937606b0ddda1a334b6ec2fda33
    expect(ability(B05107, 'a1')).toMatchObject({ trigger: { hook: 'leave:to-remove', selfOnly: true, matcherCondition: { cause: 'effect', byPlayer: 'self' } }, effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', enterSleep: true, filter: { cardId: 'B05107' } } } });
  });
});
