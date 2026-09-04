import { describe, expect, it } from 'vitest';
import { PR288 } from '@/cards/pr-01/PR288';
import { PR289 } from '@/cards/pr-01/PR289';
import { PR290 } from '@/cards/pr-01/PR290';
import { PR291 } from '@/cards/pr-01/PR291';
import { PR295 } from '@/cards/pr-01/PR295';
import { PR296 } from '@/cards/pr-01/PR296';
import { PR297 } from '@/cards/pr-01/PR297';
import { PR304 } from '@/cards/pr-01/PR304';

function ability(card: { abilities: readonly any[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, id).toBeDefined();
  return found!;
}

describe('official QA Wave253: PR288 through PR304 completion links', () => {
  it('pins every selected Wave253 contract', () => {
    // qa: card:PR288:7e995814959f1317d5d3a0209d1a4fe2bdd07f8bce570f7d1491700501592010
    // qa: card:PR288:c609f7a1a0c521302172c1f974c7bd0f428812c87dbbe14e019da0d62c3a0c72
    // qa: card:PR288:c84d7aad4528fd6d980afa11b31629dd80c57a9c461526f6b41e76abb0604128
    expect(ability(PR288, 'a1')).toMatchObject({
      trigger: { hook: 'action:declare', selfOnly: true },
      effect: {
        kind: 'sequence',
        steps: [
          { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', n: 1, faceDown: true, bind: '$flipSelf' } },
          { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', n: 1, faceDown: true, bind: '$flipOpp' } },
          { kind: 'conditional', if: { kind: 'and', cs: [{ kind: 'bound', key: '$flipSelf', presence: 'matched' }, { kind: 'bound', key: '$flipOpp', presence: 'matched' }] }, then: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, scope: 'turn' } } },
        ],
      },
    });

    // qa: card:PR289:0f38c3e3a0b30b4967584db56acb4a7efc728e772d40ac0961a9bacfcef37274
    // qa: card:PR295:0f38c3e3a0b30b4967584db56acb4a7efc728e772d40ac0961a9bacfcef37274
    for (const card of [PR289, PR295]) {
      expect(ability(card, 'a1')).toMatchObject({
        scope: 'on-scene', trigger: { hook: 'action:end', selfOnly: true },
        condition: { kind: 'and', cs: [{ kind: 'fileAtLeast', n: 7 }, { kind: 'stackedCountAtLeast', ref: { kind: 'self' }, n: 1 }] },
        effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } }, { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } }] },
      });
    }

    // qa: card:PR290:2df117b4e7028ef4376342cff4bf2e8030099380c27068ff85c417d76460bfc6
    // qa: card:PR296:2df117b4e7028ef4376342cff4bf2e8030099380c27068ff85c417d76460bfc6
    for (const card of [PR290, PR296]) {
      expect(ability(card, 'a3')).toMatchObject({
        type: 'declared',
        effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { key: 'mustGuard', val: true, target: { kind: 'pick', query: { area: 'scene', side: 'opp', filter: { kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
      });
    }

    // qa: card:PR291:61e88f63f25893434026dec6f473208ea19c5d06253006706b27c71989c017a6
    // qa: card:PR291:ec31c5dddbe5f539b6ea135012db27b2effa395944a49efb6b11c035be747e5d
    // qa: card:PR297:61e88f63f25893434026dec6f473208ea19c5d06253006706b27c71989c017a6
    // qa: card:PR297:ec31c5dddbe5f539b6ea135012db27b2effa395944a49efb6b11c035be747e5d
    for (const card of [PR291, PR297]) {
      expect(ability(card, 'a1')).toMatchObject({
        trigger: { hook: 'effect:declared', selfOnly: true },
        condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '白' }, { kind: 'caseStatus', status: '解決編' }] },
        effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMin: 7000 } } }, { kind: 'atom', verb: 'toPartnerArea', args: {} }, { kind: 'conditional', if: { kind: 'bond', cardName: '怪盗キッド' }, then: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', viaEffect: true, enterSleep: true } } }] },
      });
    }

    // qa: card:PR304:fd298447ad15716de7a161bbcce756016aeb5cffc6829bcf2e58b91fdb4ad5a0
    expect(ability(PR304, 'a3')).toMatchObject({
      trigger: { hook: 'contact:start', matcherCondition: { kind: 'contactOpponentApHigher' } },
      condition: { kind: 'turn', player: 'self' },
      effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } }, { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 3000, scope: 'contact' } }] },
    });
  });
});
