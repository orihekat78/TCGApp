// cards/ct-p06/B06007 灰原哀 (キャラ) — engine#4 sceneToHand batch #3 (a2 = enter choice)
// rules: 11-reasoning.md (ミスリード), 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【パートナー青】【登場時】以下から1つ選んで行う。
//     ・ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//     ・相手の現場にいるレベル7以下のキャラを1枚まで選び、手札に移す。
//     ・カードを2枚引く。
//
// a1: 〚ミスリード1〛 (misreadX shared helper)
// a2: enter + 【パートナー青】 + 3 options choice (突撃付与 / bounce / draw 2)

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '../_shared/index.js';

const a1 = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // option 1: ターン終了時まで 突撃 を $self に付与
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
      // option 2: 相手 level≤7 を 1枚 bounce
      {
        kind: 'atom',
        verb: 'sceneToHand',
        args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 7 } },
      },
      // option 3: カードを 2 枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
    ],
  },
  description: '【パートナー青】【登場時】3択: 突撃付与 / 相手 lv≤7 bounce / 2 ドロー。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06007: CardDef = {
  id: 'B06007',
  no: '0632/B06007',
  kind: 'character',
  names: ['灰原哀'],
  colors: ['青'],
  level: 7, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [],
  rarity: 'R',
  imageUrl: '1754284680555681.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
