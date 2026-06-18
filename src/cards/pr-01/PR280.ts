// cards/pr-01/PR280 萩原千速 (character) — engine拡張 wave#2 cluster16 (self-remove removal-observer, 2026-06-18)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 19-special-rules.md, 20-color-and-switch.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【パートナー黄】〚突撃〛（名乗り状態でもアクションできる）
//   【FILE6】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、
//     このキャラを現場からリムーブしてもよい。そうした場合、手札から〚カード名［萩原千速］〛以外の
//     レベル7以下の〚特徴［警察］〛のキャラを1枚まで登場させる。
//
// 句マッピング (certify .tmp/certify/PR280.json + verify ok / B06087.json):
//   a1: 【パートナー黄】〚突撃〛 => partnerColorKeyword({color:'黄', kw:'突撃'}) (B05108 a1 同型 = 【パートナー黒】〚突撃〛)。
//       条件不成立なら能力を持たない扱い (rules/17)。突撃 = 条件付与なので keywords[] は [] のまま。
//   a2: 【FILE6】 + 「このキャラとのコンタクトによって」 =>
//       condition and[fileAtLeast{6}, removedCharMatches{side:'opp', cause:'contact-ap', by:'self'}]
//       (B05108 a2 = fileAtLeast / D10007 a1 = removedCharMatches{opp,contact-ap,self}。両 gate を and 結合 = B09023 a1 同型。
//        【アシスト】したパートナーも file に数える = qAndA「はい、数えます」/ rules/17)。
//       「相手の現場のキャラが…リムーブされたとき」 => trigger{hook:'leave:to-remove'} (selfOnly 無 = 他者除去に反応、D10007 a1 同型)。
//       「このキャラをリムーブしてもよい。そうした場合…登場」 => optional{sequence[sceneRemove{$self,effect}, sceneEnter{...}]}
//       (B05108 a2 effect と body 同一。任意効果 = rules/15「〜してもよい」。発動キャラ離場でも後続継続 = rules/15)。
//       「手札から〚カード名[萩原千速]〛以外のレベル7以下の〚特徴[警察]〛のキャラを1枚まで」 =>
//         sceneEnter{player:'self', from:'hand', max:1, viaEffect:true,
//                    filter:{cardNameNot:'萩原千速', trait:'警察', levelMax:7, kind:'character'}}
//         (cardNameNot = cluster16 name-exclusion / B03113 同型、split-name 対応 rules/19。
//          max:1 =「1枚まで」0枚可 / viaEffect = 効果登場で色制限なし、名乗り状態、enter hook 発火 / rules/15,20)。
//   ⚠ 初の「effect に removal verb (sceneRemove $self) を含む & 【ターン1】無し」removal-observer (cluster15 spec §6.6 DEFER 境界)。
//      自己リムーブ再入の安全性は tests/cards/hagiwara-self-remove-observer.test.ts で end-to-end 実証:
//      sceneRemove{$self} が再 emit する leave:to-remove は cause:'effect'/side:own のため condition {side:'opp', cause:'contact-ap'}
//      を再合致せず → 自己 cascade 不能。event.emit は listener snapshot (registry.ts) で再入 iterator-safe、effect は queue-defer。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー黄】〚突撃〛
const a1: AbilityDef = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【FILE6】 AND 「このキャラとのコンタクトによって」(両 gate を trigger 時に評価)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'fileAtLeast', n: 6 },
      { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
    ],
  },
  // 相手の現場のキャラが…リムーブされたとき (selfOnly 無 = 他者除去に反応)
  trigger: { hook: 'leave:to-remove' },
  effect: {
    // このキャラをリムーブしてもよい。そうした場合〜 (任意効果 / rules/15)
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        // このキャラ自身をリムーブ (rules/15: 発動キャラ離場でも後続継続)
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
        // 手札から〚カード名[萩原千速]〛以外のレベル7以下の〚特徴[警察]〛のキャラを1枚まで登場
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'hand',
            max: 1,
            viaEffect: true,
            filter: { cardNameNot: '萩原千速', trait: '警察', levelMax: 7, kind: 'character' },
          },
        },
      ],
    },
  },
  description:
    '【FILE6】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、このキャラを現場からリムーブしてもよい。そうした場合、手札から〚カード名［萩原千速］〛以外のレベル7以下の〚特徴［警察］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};

export const PR280: CardDef = {
  id: 'PR280',
  no: '0706/PR280',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '19db990b06718d.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md',
  ],
};
