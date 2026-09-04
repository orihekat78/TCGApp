import { describe, expect, it } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { createEmptyGameState } from '@/engine/state-factory';
import type { EffectCtx } from '@/engine/types';
import { PR173 } from '@/cards/pr-01/PR173';
import { PR178 } from '@/cards/pr-01/PR178';
import { PR181 } from '@/cards/pr-01/PR181';
import { PR184 } from '@/cards/pr-01/PR184';
import { PR185 } from '@/cards/pr-01/PR185';
import { PR187 } from '@/cards/pr-01/PR187';
import { PR194 } from '@/cards/pr-01/PR194';
import { PR195 } from '@/cards/pr-01/PR195';
import { PR199 } from '@/cards/pr-01/PR199';
import { PR200 } from '@/cards/pr-01/PR200';
import { PR202 } from '@/cards/pr-01/PR202';

function ability(card: { abilities: readonly { id: string }[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, id).toBeDefined();
  return found!;
}

describe('official QA Wave250: PR173 through PR202 certification links', () => {
  it('pins every selected Wave250 contract', () => {
    // qa: card:PR173:da65e16cae13231e162a042041a5d1e771b7e1eebaaa7677d270f85b229243d7
    // qa: card:PR173:edc5088fb1200949f7b33f42f3cc6ccc10f00a622855f9f6bb8119f0549e1367
    expect(ability(PR173, 'a1')).toMatchObject({ trigger: { hook: 'reasoning:after-sleep', hooks: ['action:declare'], selfOnly: true }, effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1 } } });

    // qa: card:PR178:1def74ec3c1860ab63c3dc2a17edf91eb555337a8a83c285ea65ea755983c00b
    // qa: card:PR178:4cb3a2c75fdfb956f7d0a604ada7236d0638cbf134ed052a3c31b8e9bfa44e06
    // qa: card:PR178:921617edc35a2eea88c0d5a552b07e9a3198fa9f3e408c2859e3f6e10143b2bf
    expect(ability(PR178, 'a1')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true } }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, filter: { levelMax: 6, kind: 'character' } } }] } } });

    // qa: card:PR184:1def74ec3c1860ab63c3dc2a17edf91eb555337a8a83c285ea65ea755983c00b
    // qa: card:PR184:4cb3a2c75fdfb956f7d0a604ada7236d0638cbf134ed052a3c31b8e9bfa44e06
    // qa: card:PR184:921617edc35a2eea88c0d5a552b07e9a3198fa9f3e408c2859e3f6e10143b2bf
    expect(ability(PR184, 'a1')).toMatchObject({ effect: { kind: 'optional', effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true } }, { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', max: 1, filter: { levelMax: 6, kind: 'character' } } }] } } });

    // qa: card:PR181:bde8730b3f5070708e556b50f600887f5c48294e3e514cbb628ccf5f70e35364
    // qa: card:PR181:eb0efab2e49002e334fbec0002da988f0dad59d634a56c74e17a8775ec824805
    expect(ability(PR181, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', bind: '$matched' } }, { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃[事件]', scope: 'turn' } }, { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'toDeckBottomOnTurnEnd', val: true } }] } });

    // qa: card:PR187:bde8730b3f5070708e556b50f600887f5c48294e3e514cbb628ccf5f70e35364
    // qa: card:PR187:eb0efab2e49002e334fbec0002da988f0dad59d634a56c74e17a8775ec824805
    expect(ability(PR187, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', bind: '$matched' } }, { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$matched.uid', kw: '突撃[事件]', scope: 'turn' } }, { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$matched.uid', key: 'toDeckBottomOnTurnEnd', val: true } }] } });

    // qa: card:PR185:dd14da7698872524c315ac085764a06a1da4f85a1ef9058d53315de3c8346c06
    expect(ability(PR185, 'a1')).toMatchObject({ cost: { kind: 'pay', items: [{ kind: 'revealFromHand', n: 1, target: { n: { min: 1, max: 1 }, query: { area: 'hand', side: 'self', filter: { trait: '高校生', kind: 'character' } } } }] }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'turn' } }, { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } }] } });

    // qa: card:PR194:01e64ea9e0d149ca2362d7754c49a44727c3284f0467137dc414ec81443e2891
    expect(ability(PR194, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 2, bind: '$revealed' } }, { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', target: { query: { area: 'deck', side: 'self', fromGroupCards: '$revealed' } } } }, { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } }] } });

    // qa: card:PR195:029d99a4afb3f41b089e62aacff9ae2de7a180ae4d5fcfb7895914151db13ae8
    // qa: card:PR195:f548e534354a7630978d3687770f955ee54616a3abeed583faeaf9382120c3ce
    expect(ability(PR195, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { visibility: 'public', viewer: 'all', player: 'self', filter: { cardName: '中森青子' }, bind: '$revealed', bindMatch: '$matched' } }, { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } }, { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } }, { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } }, { kind: 'atom', verb: 'toPartnerArea', args: {} }] } });

    // qa: card:PR199:3405649bcd3102358d74f5a7c645011cc3fe89abd35af2d070f6f49437a53556
    expect(ability(PR199, 'a1')).toMatchObject({ effect: { kind: 'choice', options: [expect.anything(), { kind: 'optional', effect: { kind: 'chain', steps: [expect.anything(), { kind: 'atom', verb: 'sceneSetState', args: { state: 'active', filter: { cardName: '毛利小五郎', lpMin: 0, lpMax: 0 } } }] } }, { kind: 'atom', verb: 'charGrantKeyword', args: { target: { query: { filter: { cardName: '毛利小五郎', lpMin: 0, lpMax: 0 } } } } }] } });

    // qa: card:PR200:24724a7bdd74ed439861b6795dd7242b2f30cd9413262f35d42547dc0d2c5ebe
    expect(ability(PR200, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'sceneFaceDownSetCardCountAtLeast', player: 'self', n: 2 } });

    // qa: card:PR202:d1498ef40075f589c437f68dd8f876b22fedc5f6cf47ed3e09e1e7f130f848cb
    expect(ability(PR202, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] } });
  });

  it.each([PR178, PR184])('does not begin the optional mill when %s has fewer than three cards', (card) => {
    const state = createEmptyGameState();
    state.players.self.deck.push('PR137', 'PR138');
    state.players.self.remove.push('PR155');
    const ctx: EffectCtx = { source: { player: 'self', area: 'hand', cardId: card.id, abilityId: 'a1' }, bindings: {}, dyn: { optionalRun: true } } as EffectCtx;

    runEffect(state, ability(card, 'a1').effect!, ctx);

    expect(state.players.self.deck).toEqual(['PR137', 'PR138']);
    expect(state.players.self.remove).toEqual(['PR155']);
  });
});
