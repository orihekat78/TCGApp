import { describe, expect, it } from 'vitest';
import type { CardDef } from '@/engine/types';
import { B05041 } from '@/cards/ct-p05/B05041';
import { B05045 } from '@/cards/ct-p05/B05045';
import { B05047 } from '@/cards/ct-p05/B05047';
import { B05048 } from '@/cards/ct-p05/B05048';
import { B05049 } from '@/cards/ct-p05/B05049';
import { B05050 } from '@/cards/ct-p05/B05050';
import { B05052 } from '@/cards/ct-p05/B05052';
import { B05061 } from '@/cards/ct-p05/B05061';
import { B05063 } from '@/cards/ct-p05/B05063';

function ability(card: CardDef, id: string) {
  const found = card.abilities.find((entry) => entry.id === id);
  expect(found, `${card.id}.${id}`).toBeDefined();
  return found!;
}

describe('official QA Wave234: CT-P05 certification links', () => {
  it('pins the selected Wave234 contracts', () => {
    // qa: card:B05041:745519738b6636093c8176d1852eb8d0f1e95ab69ef202de193c36637c95e0ec
    // qa: card:B05041:d17d2dc8f95ef31102e65a09563ef16faf64db33ad7ee696f7ee693d5a71379e
    // qa: card:B05041:d84d6419355c098a7a759dbaba8120d78702d970769fa3e32479fcdce9d17776
    expect(ability(B05041, 'a2')).toMatchObject({ type: 'continuous', scope: 'on-set-host', continuousModifier: { opponentRestrict: ['remove', 'sleep', 'stun'] } });
    // qa: card:B05045:8a1c2684c3f10a7360b6b30d40c72f789384b0aaffea08d943de1aa994be976a
    // qa: card:B05045:af84c59b94295cba97bf7b8cf952bcdd7a77fc30dc02039a57bb8580662f9c5c
    // qa: card:B05045:d2b0747e83a52d4062921d7a99440de95793db443d45339d60ee239baa8d7463
    expect(ability(B05045, 'a1').cost).toMatchObject({ kind: 'removeDeckTop', player: 'self', n: 5 });
    // qa: card:B05047:4fc0db4c14ef21dcc5ae7c7afd8b7b75124352127f861661a60512fda95fce1b
    expect(JSON.stringify(ability(B05047, 'a1').effect)).toContain('"maxN":2');
    // qa: card:B05048:37d07769d56036314740a80561f28c645df2e47302bd60e5848f36efaca529c4
    // qa: card:B05048:f2fe1bbcaae50dd0418a4b6399f172b2856f927ab1cff2a69b86c02ff6a919d0
    expect(ability(B05048, 'a1')).toMatchObject({ type: 'continuous', scope: 'on-scene', condition: { kind: 'bond', cardName: '中森青子' }, continuousModifier: { untargetableByOppEffectAura: { cardName: '中森青子' } } });
    // qa: card:B05049:4d427357618c748dfc9b3c6ea41d63d0ba54704fbec5bb30d7efbe5a53d1fc05
    // qa: card:B05049:ac62cef0c2b856a498ad5ffd83e695679c10a8b7e5b8b500857a5557bac35de3
    expect(JSON.stringify(ability(B05049, 'a1'))).toContain('"cardName":"怪盗キッド"');
    // qa: card:B05050:5edb2eb16aba5b39a2a7a9d525106f383c090236af7ab93113af9fccc1a1578e
    // qa: card:B05050:867bf08f9c5e566a485166a875c29a9717dbd11a6f76c2efaa014323b64ecd8e
    // qa: card:B05050:f55ff03c9991c8bc5de37e46ec80b0155c588a09d94513ee386610bf26eb750a
    expect(JSON.stringify(ability(B05050, 'a1'))).toContain('"verb":"handAddFromRemove"');
    // qa: card:B05052:86a08dacffcc66e68bbced54ef05ec8ecb1f2053fb6fba546e4c92430428ce94
    // qa: card:B05052:9f5e511ed9d1ffd61f530f804fe10834d03cd3e580a54de5875b29f086228993
    // qa: card:B05052:c51f6838f7814f2243bbe0560dc33c4dc896f1b0b13d486cd4223cb898983c95
    expect(ability(B05052, 'a2').cost).toMatchObject({ kind: 'choice', items: [{ kind: 'removeFromHand' }, { kind: 'removeSetCard', anyFace: true }] });
    // qa: card:B05061:269964960bfca601be26e4be065e31a459dc074d3715dcb1c51cd6691f52b4aa
    expect(JSON.stringify(ability(B05061, 'a1').effect)).toContain('"gate":true');
    // qa: card:B05063:06c268952b83e0a0d17589d4907b18c2b819a312009bc70cc73530576f1cece8
    expect(JSON.stringify(ability(B05063, 'a2').effect)).toContain('"key":"toHandOnTurnEnd"');
  });
});
