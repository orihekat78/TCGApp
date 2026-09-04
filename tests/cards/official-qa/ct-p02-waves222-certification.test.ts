import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B02051 } from '@/cards/ct-p02/B02051';
import { B02052 } from '@/cards/ct-p02/B02052';
import { B02053 } from '@/cards/ct-p02/B02053';
import { B02057 } from '@/cards/ct-p02/B02057';
import { B02062 } from '@/cards/ct-p02/B02062';
import { B02063 } from '@/cards/ct-p02/B02063';
import { B02074 } from '@/cards/ct-p02/B02074';
import { B02077 } from '@/cards/ct-p02/B02077';
import { B02083 } from '@/cards/ct-p02/B02083';
import { B02084 } from '@/cards/ct-p02/B02084';
import { B02086 } from '@/cards/ct-p02/B02086';
import { B02087 } from '@/cards/ct-p02/B02087';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave222: CT-P02 certification links', () => {
  it('pins event use, set-card replacement, and evidence observer contracts', () => {
    // qa: card:B02051:648a3177a46c394a555a53d6f209840adac175b6c4dde376303f1d23414d8735
    expect(ability(B02051, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'sceneSetState', args: { side: 'self', state: 'sleep', max: 1 } }, { kind: 'atom', verb: 'sceneRemove', args: { filter: { levelMax: 7 } } }] } });
    // qa: card:B02052:4279ef5515bddec3da3bb8fc3b06a0303facdad8a44c48791d05604515fa912c
    expect(ability(B02052, 'a3')).toMatchObject({ trigger: { hook: 'setcard:leave' }, condition: { kind: 'turn', player: 'opp' }, limit: { kind: 'turn', n: 1 }, setCardRemovalReplacement: { kind: 'move-to-own-scene' } });
    // qa: card:B02052:8c29474894830c0e81a2dcd7dede2266ac469f756b9902065d56e211676af966
    expect(ability(B02052, 'a3')).toMatchObject({ setCardRemovalReplacement: { filter: { kind: 'character', trait: '怪盗' } } });
    // qa: card:B02053:103bba8d80d45436d9abd3a79d485795332ace66604422e7dc17f35f0db4c6e9
    expect(ability(B02053, 'a1')).toMatchObject({ trigger: { hook: 'effect:declared', selfOnly: true }, effect: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', viaEffect: true } } });
    // qa: card:B02053:4c9bcb41fa62148c6c95b1bd9495ae55a6e2cdce01318835ba0d5cedba7d96f2
    expect(ability(B02053, 'a1')).toMatchObject({ effect: { kind: 'atom', verb: 'sceneEnter', args: { max: 1, filter: { color: '白', trait: '怪盗', levelMax: 7, kind: 'character' } } } });
    // qa: card:B02057:73cd9b8968f1669e05a06dcf3783f75041dc28d9bf0971d87c745b06a10f3f05
    expect(ability(B02057, 'a2')).toMatchObject({ type: 'declared', cost: { kind: 'sleepSelf' }, limit: { kind: 'turn', n: 1 } });
    expect(ability(B02057, 'a2').condition).toBeUndefined();
    // qa: card:B02062:44b8a61af958ed9edacf9ae587a996a212d37a0cfb0c368f6e8b30078542d13e
    expect(ability(B02062, 'a1')).toMatchObject({ trigger: { hook: 'evidence:removed', matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } }, effect: { kind: 'atom', verb: 'draw', args: { n: 1 } } });
    // qa: card:B02062:ebaefdb1535191a9076b6b3c7993f2a36bd5359338dcc9802076b76d5e8cb984
    expect(ability(B02062, 'a1')).toMatchObject({ trigger: { hook: 'evidence:removed', matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' } }, limit: { kind: 'turn', n: 1 } });
    // qa: card:B02063:e741b01ff46c5a7b42c122e972c5836385332a40f95f185ebda71ae2ebda7767
    expect(ability(B02063, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { opponentRestrict: ['cutin'] } });
  });

  it('pins entry, draw, removal, contact, and next-hint contracts', () => {
    // qa: card:B02074:41db26f1485f6927cf2aee560ab61b43cc0ac8d4726a95860ac4dde0d5a508de
    expect(ability(B02074, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { filter: { trait: '警察' }, excludeSelf: true }, nMin: 1 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } } });
    // qa: card:B02074:65bfc79d1ce20a012c4bb2056ea9dcf5c81704919fc0acec16bfde9ce62971cd
    expect(ability(B02074, 'a1')).toMatchObject({ effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { excludeSelf: true }, nMin: 1 }, then: { kind: 'atom', verb: 'charGrantKeyword' } } });
    // qa: card:B02077:d80f04fd9ed2fa2cc2d120f6086e1121f6342b9135da0bfe0abfeb59a2967713
    expect(ability(B02077, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, effect: { kind: 'conditional', then: { kind: 'atom', verb: 'sceneEnter', args: { from: 'remove', viaEffect: true, enterSleep: true } } } });
    // qa: card:B02083:e97e3a0bdb4dc1324e9cd2d2d7706227a880c7702bdcd367169dbd0c5c221f67
    expect(ability(B02083, 'a1')).toMatchObject({ effect: { kind: 'sequence', steps: [{ kind: 'forEach', over: { kind: 'all', query: { side: 'opp', state: ['stun'] } }, do: { kind: 'atom', verb: 'draw', args: { n: 1 } } }, { kind: 'conditional', then: { kind: 'atom', verb: 'sceneSetState', args: { state: 'stun' } } }] } });
    // qa: card:B02084:40fe7fe9a42e0cc53a2d869e7307b57e578331caf3f51f4d26fa5840acaacc55
    expect(ability(B02084, 'a1')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'charSetCard', args: { fromSelf: true, filter: { levelMin: 6, kind: 'character' } } }, { kind: 'atom', verb: 'sceneRemove', args: { filter: { levelMax: 6, kind: 'character' } } }] } });
    // qa: card:B02084:7e5b155633b6e3b448ec6356ecf309bb725c8ea39764f423043c0c5f96741a14
    expect(ability(B02084, 'b02084_set_self_leave')).toMatchObject({ trigger: { hook: 'setcard:leave' }, condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'atom', verb: 'handAddFromRemove' } });
    // qa: card:B02086:5c091bc95c34692bb769cb0d98682c9369ffceeb168a9496459ee9438af547fe
    expect(ability(B02086, 'a2')).toMatchObject({ trigger: { hook: 'disguise:into', selfOnly: true }, effect: { kind: 'optional', else: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'contactImmune_action', val: true } } } });
    // qa: card:B02086:765546065a448b560b43290d6632fae27634c9c377a1aae32f1a0532b4ee5e2e
    expect(ability(B02086, 'a2')).toMatchObject({ effect: { kind: 'optional', chooser: 'opp-of-owner', effect: { kind: 'atom', verb: 'discard', args: { player: 'opp' } } } });
    // qa: card:B02087:18485b08aaf71c37dce1f7952b7f4382610c83a5c07f19db06d8ede4d712d9e5
    expect(ability(B02087, 'a1')).toMatchObject({ type: 'continuous', continuousModifier: { colorIgnoreOnNextHint: true } });
    // qa: card:B02087:3868b60e47beaf75074a2cdd7c9c455cf4f36f8c0e95020c83ab338dab748f8b
    expect(ability(B02087, 'a2')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'opp', max: 1, bind: '$removedSet', filter: { hasSetCards: true } } }, { kind: 'conditional', if: { kind: 'bound', key: '$removedSet', presence: 'matched' }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } } }] } });
    // qa: card:B02087:7d8bb98d9586f9573b10f3eb83715c1a41c24c9c4f61d8f2bd63d82736e0693a
    expect(ability(B02087, 'a2')).toMatchObject({ effect: { kind: 'chain', steps: [{ kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'opp', max: 1, filter: { hasSetCards: true }, bind: '$removedSet' } }, { kind: 'conditional', if: { kind: 'bound', key: '$removedSet', presence: 'matched' }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } } }] } });
  });
});
