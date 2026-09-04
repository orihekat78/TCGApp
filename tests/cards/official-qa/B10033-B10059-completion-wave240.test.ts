import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B10033 } from '@/cards/ct-p10/B10033';
import { B10039 } from '@/cards/ct-p10/B10039';
import { B10043 } from '@/cards/ct-p10/B10043';
import { B10044 } from '@/cards/ct-p10/B10044';
import { B10045 } from '@/cards/ct-p10/B10045';
import { B10046 } from '@/cards/ct-p10/B10046';
import { B10047 } from '@/cards/ct-p10/B10047';
import { B10052 } from '@/cards/ct-p10/B10052';
import { B10056 } from '@/cards/ct-p10/B10056';
import { B10057 } from '@/cards/ct-p10/B10057';
import { B10059 } from '@/cards/ct-p10/B10059';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave240: CT-P10 certification links', () => {
  it('pins the selected Wave240 contracts', () => {
    // qa: card:B10033:3bbd1d1b862db20515ace88f7b77bb80a1e73060ca14fb51e01c6ef2419444d4
    expect(ability(B10033, 'a1')).toMatchObject({ type: 'continuous', scope: 'on-hand', condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'turn', player: 'self' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: ['服部平蔵', '遠山銀司郎'], kind: 'character' } } }] }, continuousModifier: { lvlDeltaInHand: -3 } });
    // qa: card:B10033:9f4769d3c53c3a4b75cee387381d8e5531479a94f9db23a1824bbfc03901451f
    expect(ability(B10033, 'a2')).toMatchObject({ condition: { kind: 'partnerColor', color: '緑' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 }, cause: 'effect' } }, { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, filter: { kind: 'character', trait: '警察' }, fromDeckTop: true, faceUp: false } }] } });
    // qa: card:B10039:f71db3a3f927c06d71c5c94afe897e034493622abe700f6975d8dd93ed6de2a4
    expect(ability(B10039, 'a1')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'caseColor', color: ['緑', '白'], combine: 'and' }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', maxN: 4, filter: { color: ['緑', '白'] } } }, { kind: 'conditional' }, { kind: 'atom', verb: 'deckToBottomBound' }] } });
    // qa: card:B10043:15ed0fc61eff44c27005645722fcef5b05ef2d4b2c607fe5113d22269d54bb5f
    expect(ability(B10043, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'マジシャン' } }, nMin: 5 }, continuousModifier: { lpDelta: 1 } });
    // qa: card:B10043:84c2c8595672367690563de981068c2c254a6c67db18a57c191321c9912a2d25
    expect(ability(B10043, 'a2')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'opp' } });
    // qa: card:B10043:bc3d7f65823aeeb5dee947dacf18b7d76b43644abd9022f602995dbc125b87f2
    expect(ability(B10043, 'a2')).toMatchObject({ effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: 'マジシャン', cardNameNot: '真田一三' } } } });
    // qa: card:B10044:bc3d7f65823aeeb5dee947dacf18b7d76b43644abd9022f602995dbc125b87f2
    expect(ability(B10044, 'a1')).toMatchObject({ trigger: { hook: 'disguise:into', selfOnly: true }, effect: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', side: 'self', max: 1, filter: { cardName: '毛利蘭' }, delta: 2000, scope: 'turn' } } });
    // qa: card:B10045:cc6efaf0713b32c3f1122ee0e565e5cb6ae55918de4d00c5f22aec913accb9c6
    expect(ability(B10045, 'a1')).toMatchObject({ id: 'a1', type: 'icon-misread' });
    // qa: card:B10045:e078d18a077ba22a2030da9a730213bc657f60ab3d2f492af955041f069323fc
    expect(ability(B10045, 'a2')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '中森青子' }, { kind: 'caseStatus', status: '解決編' }, { kind: 'turn', player: 'self' }] }, effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } } });
    // qa: card:B10046:1cd9615ce532cfecb8835eecc8433cda27c4ebd7aaaa05cc7df10b9676f62e29
    expect(ability(B10046, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { cardName: '怪盗キッド' } } }, then: { kind: 'sequence', steps: [expect.objectContaining({ kind: 'atom', verb: 'bindPick' }), expect.objectContaining({ kind: 'conditional' })] } } });
    // qa: card:B10046:dd7b1474be7216392ab1546a39bfb5fbfa37ac1a62e01c6b0475dc949c77fa7d
    expect(ability(B10046, 'a1')).toMatchObject({ effect: { kind: 'conditional', then: { kind: 'sequence', steps: [expect.anything(), expect.objectContaining({ kind: 'conditional' })] } } });
    // qa: card:B10047:fac3ccc84f2aee3eba1f3fd4dc22d5cd5c14486619d0ea7b84219010b18ac2c2
    expect(ability(B10047, 'a0')).toMatchObject({ type: 'continuous', scope: 'on-hand', condition: { kind: 'caseName', name: '工藤新一NYの事件' }, continuousModifier: { colorIgnoreOnHandUse: true } });
    // qa: card:B10052:60bc571b2b7fbd182856b3fc57ec8ed167504073a034957e36be8fe49059137b
    expect(ability(B10052, 'a1')).toMatchObject({ trigger: { hook: 'phase:end:start' }, effect: { kind: 'conditional', if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { kind: 'character', hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] } } }, then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } } });
    // qa: card:B10052:685833a68d06da220456d118eeeaaa41518d2442d24ee467eb174be91fd6a023
    expect(ability(B10052, 'a2')).toMatchObject({ trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { kind: 'character', hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] } } }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyLevel', args: { player: 'self', side: 'opp', max: 1, filter: { kind: 'character' }, delta: -1, scope: 'turn' } } });
    // qa: card:B10056:d522c349d49dbe32302bc6a811447910856bbf5d3e8ad6b04675e2b6ffba930d
    expect(ability(B10056, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDeltaAura: 1000, auraFilter: { kind: 'character', traitAll: ['女流棋士', '棋士'] }, auraExcludeSelf: true } });
    // qa: card:B10057:0ef4b36903d9bb7a953ba43ff1ddda947939d66a64a069bd1385cbe9165546ab
    expect(ability(B10057, 'a1')).toMatchObject({ type: 'continuous', condition: { kind: 'scratchTrace', player: 'self', v: '発見済' }, continuousModifier: { grantKeywords: expect.any(Function), printedKeywordWhenIconValid: true } });
    // qa: card:B10057:4e28d911eb70f7a6f4a739a9351e68b599c4409a91a7a6497ce311f9967561fc
    expect(ability(B10057, 'a2')).toMatchObject({ trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { kind: 'character', color: '黒' } } }] }, effect: { kind: 'sequence', steps: [{ kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } }, { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' }, state: 'sleep' } }] } });
    // qa: card:B10059:19ef5920c502d5e47a4f7ded3dda685b3b800593cba30c492e69196b7fde291e
    expect(ability(B10059, 'a1')).toMatchObject({ type: 'continuous', scope: 'on-scene', condition: { kind: 'caseStatus', status: '解決編' }, continuousModifier: { lvlDelta: 5 } });
    // qa: card:B10059:f057f840e33f5ffb76b3a98fae3263501d43796c04786de6da633ee7188a5b6d
    expect(ability(B10059, 'a2')).toMatchObject({ scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, condition: { kind: 'turn', player: 'self' }, effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } } });
  });
});
