import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B03028 } from '@/cards/ct-p03/B03028';
import { B03029 } from '@/cards/ct-p03/B03029';
import { B03031 } from '@/cards/ct-p03/B03031';
import { B03032 } from '@/cards/ct-p03/B03032';
import { B03033 } from '@/cards/ct-p03/B03033';
import { B03035 } from '@/cards/ct-p03/B03035';
import { B03038 } from '@/cards/ct-p03/B03038';
import { B03040 } from '@/cards/ct-p03/B03040';
import { B03041 } from '@/cards/ct-p03/B03041';
import { B03042 } from '@/cards/ct-p03/B03042';
import { B03046 } from '@/cards/ct-p03/B03046';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave224: CT-P03 certification links', () => {
  it('pins forced green-event reveal and turn-one optionality', () => {
    // qa: card:B03028:83647f799c39e707707e99a54c45e787f38527a585c58b1c9864b6d86c2bcf91
    expect(ability(B03028, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { color: '緑', kind: 'event' }, bind: '$revealed', bindMatch: '$matched' } }, expect.anything(), { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } }, { kind: 'atom', verb: 'deckShuffle' }] } });
    // qa: card:B03028:a65a25a1eb6dfd4bb92665c599e72f3b1640055984ce4ac017127fc5bdc86746
    expect(JSON.stringify(ability(B03028, 'a1').effect)).toContain('"cardId":"$matched.cardId"');
    // qa: card:B03028:a93b9aaf8ad6a16ee8cbd1f123e13b804da2fdb54acd945b41e50cb358ed2a5d
    expect(ability(B03028, 'a2')).toMatchObject({ limit: { kind: 'turn', n: 1 }, effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'discard', args: { n: 1 } }, expect.anything()] } } });
  });

  it('pins private cost order and mandatory Heiji acquisition', () => {
    // qa: card:B03029:19a4b679d3740149e84c92436ba930bd97aaee9ff007a7e94e71b6944a565c73
    expect(ability(B03029, 'a1')).toMatchObject({ cost: { kind: 'pay', items: [expect.anything(), { kind: 'removeAreaToDeckBottom', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '緑', kind: 'event' } }, n: { min: 2, max: 2 } } }] } });
    // qa: card:B03031:adb921ad218c26313013dc28c96e1975bd3cf6b843711b233bb89080233f61c7
    expect(ability(B03031, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { filter: { cardName: '服部平次', levelMin: 8 }, bindMatch: '$matched' } }, { kind: 'conditional', then: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } }, { kind: 'atom', verb: 'discard', args: { n: 1 } }] } }, expect.anything(), expect.anything()] } });
    // qa: card:B03031:bc9292718a8312216fde2f2c08bbdebd15f1ebe3bfdae763239879fda2c0e607
    expect(ability(B03031, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil' }, expect.anything(), { kind: 'atom', verb: 'deckToBottomBound', args: { bindKey: '$revealed' } }, { kind: 'atom', verb: 'deckShuffle' }] } });
  });

  it('pins independent partner keyword and set-host aura semantics', () => {
    // qa: card:B03032:e88d166e6c88702e03e1793d3339b883bcf5dc52161d5a09d27e0ae268436ccd
    expect(ability(B03032, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'partnerColor', color: '緑' }, continuousModifier: { grantKeywords: expect.any(Function) } });
    // qa: card:B03033:1ea93e74eb99356ff1ae226c8e51daa2fb6c1109101006bdb6c3777a79f72963
    expect(ability(B03033, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { apDeltaAuraOpp: -1000, auraFilterOpp: { hasSetCards: true, kind: 'character' } } });
    // qa: card:B03033:ba8317971d0cf08aec46afea5d802c5c891110ec2af5551402dd0d3c68d883ba
    expect(ability(B03033, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDeltaAuraOpp: -1000 } });
    // qa: card:B03033:e0b65c7b32899b4f47f84b7048f97cb7fee3ddaac8c945c9e96d887550675395
    expect(ability(B03033, 'a1').type).toBe('continuous');
  });

  it('pins self-only declared costs and reasoning timing', () => {
    // qa: card:B03035:7bae736cff2018ee42cdab05f84e6f235475cac323ccedc2feec700c2251bc63
    expect(ability(B03035, 'a1')).toMatchObject({ cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeSetCard', n: 1, anyFace: true }] }, effect: { kind: 'atom', verb: 'draw', args: { n: 1 } } });
    // qa: card:B03038:54fb4af056b07232c5a41ed53a697aad9f30338fa1638762288377010dd900f9
    expect(ability(B03038, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:after-sleep', matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: { lpMin: 1 } } }, effect: { kind: 'optional' } });
    // qa: card:B03038:69e199932fd560a44e6a162acecc62722889266a8c251bfabdc4f43befacb9e8
    expect(ability(B03038, 'a1')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'draw', args: { n: 1 } }, { kind: 'atom', verb: 'charSetTurnEffect', args: { key: 'suppressReasoningEvidence', val: true } }] } } });
  });

  it('pins top-only evidence peek, mandatory guard, and optional detective picks', () => {
    // qa: card:B03040:70f71b0f9f4c0c73f6a86f5c7fc026252fb92e60b00bd8c9ce1bf7b1196d174c
    expect(ability(B03040, 'a1')).toMatchObject({ trigger: { hook: 'evidence:gain', hooks: ['reasoning:end'], matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } }, effect: { kind: 'atom', verb: 'peekOwnEvidence', args: { player: 'self' } } });
    // qa: card:B03040:d07c9e214041b64fc9e918fd03f69c23c68453fe7a8e496810494e47db1f904f
    expect(ability(B03040, 'a1')).toMatchObject({ condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B03041:9fb761bbff252841c87d829dbab80bf66463818f395a9a96f5897cf429842e71
    expect(ability(B03041, 'b03041_set_forceguard')).toMatchObject({ type: 'continuous', scope: 'on-set-host', continuousModifier: { grantKeywords: expect.any(Function) } });
    // qa: card:B03042:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
    expect(ability(B03042, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [expect.anything(), { kind: 'atom', verb: 'handAddFromDeck', args: { target: { kind: 'pick', n: { min: 0, max: 2 }, query: { distinctColors: true } } } }, { kind: 'atom', verb: 'deckToBottomBound', args: { order: 'shuffle' } }] } });
  });

  it('pins stun auto-phase exception without blocking effect activation', () => {
    // qa: card:B03046:26fd62d82c20b9647c8cc16c9d2949864278d1881e5f9808bb24185f24a732dd
    expect(ability(B03046, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'partnerColor', color: '白' }, continuousModifier: { opponentRestrict: ['stunAutoActivate'] } });
    // qa: card:B03046:64d2db5e73abba1d7e23a17d6c6ff854e38b4937d4d58d43799c4a1651d805d5
    expect(ability(B03046, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneSetState', args: { side: 'either', max: 1, state: 'stun' } } });
  });
});
