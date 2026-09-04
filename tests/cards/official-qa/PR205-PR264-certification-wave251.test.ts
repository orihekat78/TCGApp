import { describe, expect, it } from 'vitest';
import { PR205 } from '@/cards/pr-01/PR205';
import { PR206 } from '@/cards/pr-01/PR206';
import { PR208 } from '@/cards/pr-01/PR208';
import { PR230 } from '@/cards/pr-01/PR230';
import { PR234 } from '@/cards/pr-01/PR234';
import { PR237 } from '@/cards/pr-01/PR237';
import { PR240 } from '@/cards/pr-01/PR240';
import { PR243 } from '@/cards/pr-01/PR243';
import { PR263 } from '@/cards/pr-01/PR263';
import { PR264 } from '@/cards/pr-01/PR264';

function ability(card: { abilities: readonly any[] }, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, id).toBeDefined();
  return found!;
}

describe('official QA Wave251: PR205 through PR264 certification links', () => {
  it('pins every selected Wave251 contract', () => {
    // qa: card:PR205:3405649bcd3102358d74f5a7c645011cc3fe89abd35af2d070f6f49437a53556
    expect(ability(PR205, 'a1')).toMatchObject({ effect: { kind: 'choice', options: [expect.anything(), { kind: 'optional', effect: { kind: 'chain', steps: [expect.anything(), { kind: 'atom', verb: 'sceneSetState', args: { state: 'active', filter: { cardName: '毛利小五郎', lpMin: 0, lpMax: 0 } } }] } }, expect.anything()] } });

    // qa: card:PR206:24724a7bdd74ed439861b6795dd7242b2f30cd9413262f35d42547dc0d2c5ebe
    expect(ability(PR206, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'sceneFaceDownSetCardCountAtLeast', player: 'self', n: 2 } });

    // qa: card:PR208:d1498ef40075f589c437f68dd8f876b22fedc5f6cf47ed3e09e1e7f130f848cb
    expect(ability(PR208, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }] } });

    // qa: card:PR230:b4a8eef517d1fc39a2e8760b15141491a14c4b756f84fe2a7693d0324a84fe3a
    expect(ability(PR230, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'either' } }, do: { kind: 'atom', verb: 'sceneSetState', args: { state: 'sleep' } } } });

    // qa: card:PR234:83cbb1fa76659f08434c0d65ce25d3d07996ba2a32146fcf57ef83183cf931a9
    expect(ability(PR234, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'sequence' } });
    // qa: card:PR234:dddf69263368e5862ebc38fe23eb8483a4d3b027a25774c236d0972439572db1
    expect(ability(PR234, 'a2')).toMatchObject({ trigger: { hook: 'setcard:leave' }, effect: { kind: 'optional' } });

    // qa: card:PR237:19cef72cbb8fc9c2443725d732d71aff2166d0e2f3addc7b04555001d58e8eec
    // qa: card:PR237:64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179
    // qa: card:PR237:79b5f759d0ad2071f3618dd6d9719f809e5dae0cc3bb3b8b7d2ef6584e2d9cf2
    expect(ability(PR237, 'a1')).toMatchObject({ trigger: { hook: 'contact:start', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$trigger.bUid' } } });
    expect(ability(PR237, 'a2')).toMatchObject({ trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'mill', args: { player: 'self', n: 5 } } });

    // qa: card:PR240:dddf69263368e5862ebc38fe23eb8483a4d3b027a25774c236d0972439572db1
    expect(ability(PR240, 'a2')).toMatchObject({ trigger: { hook: 'setcard:leave' }, effect: { kind: 'optional' } });

    // qa: card:PR243:19cef72cbb8fc9c2443725d732d71aff2166d0e2f3addc7b04555001d58e8eec
    // qa: card:PR243:64b0dfa40059e5ed0dddfd2e25c4185a31f5b45ddba7798437a0e7508255c179
    // qa: card:PR243:79b5f759d0ad2071f3618dd6d9719f809e5dae0cc3bb3b8b7d2ef6584e2d9cf2
    // qa: card:PR243:8cc7d91bb5cdd4d71c3a80faccc29c5622f1ff316b29d9c183c8f41d9517dd3d
    expect(ability(PR243, 'a1')).toMatchObject({ trigger: { hook: 'contact:start', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$trigger.bUid' } } });
    expect(ability(PR243, 'a2')).toMatchObject({ trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'mill', args: { player: 'self', n: 5 } } });

    // qa: card:PR263:31607aa1d084df5546311c9007f151ad3fe4be0e439c904ad5625aba5449ffe3
    expect(ability(PR263, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDelta: { dyn: '$self.partnerAreaTraitCount.ビッグジュエル * 1000' } } });

    // qa: card:PR264:6b444418b53eaa4b0cd2234a2aeee84ff79aba7866f248a18188ac094b318bb4
    // qa: card:PR264:746f4f2e36b44df4fb6468035e26426d2233a68134842e5268da0addea30bb0d
    // qa: card:PR264:84193315d729094fa050d7415999f5a5a0f3ff8d68f14389f492f3f4347d43a0
    // qa: card:PR264:e8c9859ff65a57a2af2ecdc6f59d6a08e69035c40ba4b778a6c66b02d3ed7a37
    expect(ability(PR264, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'caseStatus', status: '解決編' }, continuousModifier: { lvlDelta: 2 } });
    expect(ability(PR264, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'sceneHas', nMin: 3, query: { filter: { levelMin: 7, levelMax: 7 } } }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { kw: '突撃[事件]', scope: 'turn' } } } });
  });
});
