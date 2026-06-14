// cards/ct-p05/B05108 バーボン (キャラ) — engine拡張 wave#2 cluster3 (action-lifecycle trigger, 2026-06-14)
// rules: 05-turn-phases.md, 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 20-color-and-switch.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【パートナー黒】〚突撃〛（登場したターンからすぐにアクションできる）
//   【FILE6】このキャラのアクション終了時、このキャラを現場からリムーブしてもよい。
//     そうした場合、手札からレベル7以下の【黒】のキャラを1枚まで登場させる。
//
// 句マッピング:
//   a1: 【パートナー黒】〚突撃〛 => partnerColorKeyword({color:'黒', kw:'突撃'}) (D01005 同型 = 【パートナー青】〚突撃〛)。
//       continuous grantKeywords。条件不成立なら能力を持たない扱い (rules/17)。
//   a2: 【FILE6】 => condition fileAtLeast{n:6} (rules/17。【アシスト】したパートナーも数える = qAndA「はい、数えます」)。
//       このキャラのアクション終了時 => trigger{hook:'action:end', selfOnly:true} (cluster3 新 hook)。
//         qAndA: このキャラが先に現場を離れ⇒アクション終了 の順で進むため、終了時に現場不在なら不発動
//         (= action:end emit は source=actor の in-play 在場時のみ成立。selfOnly で source.uid 一致を gate / rules/22)。
//         qAndA: コンタクト相手が離場してもこのキャラが現場にいれば発動 (= 自身の在場のみが条件)。
//       このキャラをリムーブしてもよい。そうした場合、…登場させる (任意効果、rules/15 §「〜してもよい」) =>
//         optional{sequence[...]} (B05019 a1 同型 = 「このキャラをリムーブしてもよい。そうした場合…」)。
//         1) このキャラ自身をリムーブ => sceneRemove{uid:'$self', cause:'effect'} (rules/15: 発動キャラ離場でも後続継続)。
//         2) 手札からレベル7以下の【黒】のキャラを1枚まで登場 =>
//            sceneEnter{player:'self', from:'hand', max:1, viaEffect:true, filter:{levelMax:7, color:'黒', kind:'character'}}
//            (B03012 a1 同型。max:1 = 「1枚まで」0枚可 / rules/15。viaEffect = 効果登場で色制限を受けない / rules/20。
//             qAndA: 効果で登場したキャラの【登場時】能力は発動する = 通常登場 = enter hook 発火、名乗り状態)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー黒】〚突撃〛
const a1: AbilityDef = partnerColorKeyword({ color: '黒', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【FILE6】(条件不成立なら能力を持たない扱い / rules/17。アシスト中パートナーも数える)
  condition: { kind: 'fileAtLeast', n: 6 },
  // このキャラのアクション終了時 (離場後はアクション終了の順で不発動 / rules/22 qAndA)
  trigger: { hook: 'action:end', selfOnly: true },
  effect: {
    // このキャラを現場からリムーブしてもよい。そうした場合〜 (任意効果 / rules/15)
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        // このキャラ自身をリムーブ (rules/15: 発動キャラが現場を離れても後続効果は継続)
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
        // 手札からレベル7以下の【黒】のキャラを1枚まで登場 (0枚可 / 効果登場で色制限なし / rules/15,20)
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'hand',
            max: 1,
            viaEffect: true,
            filter: { levelMax: 7, color: '黒', kind: 'character' },
          },
        },
      ],
    },
  },
  description:
    '【FILE6】このキャラのアクション終了時、このキャラを現場からリムーブしてもよい。そうした場合、手札からレベル7以下の【黒】のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const B05108: CardDef = {
  id: 'B05108',
  no: '0604/B05108',
  kind: 'character',
  names: ['バーボン'],
  colors: ['黒'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1746628078749217.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
