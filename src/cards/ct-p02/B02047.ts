// cards/ct-p02/B02047 工藤有希子 (character) — engine mega-wave W3 exemplar (r51, 2026-07-03)
// rules: 08-contact.md, 09-cutin-disguise.md, 17-icons.md, 20-color-and-switch.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【変装時】LP2以上の【白】のキャラと入れ替わった場合、このキャラはこのコンタクトによってリムーブされない。
//   (変装アイコン) 【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。
//     入れ替わったキャラはデッキの下に移す）
//
// 句マッピング:
//   a1 (変装アイコン): 【変装】【事件白】【FILE6】=> icon-disguise + condition and[caseColor 白,
//       fileAtLeast 6] (D06012 同型、canDisguise が gate。rules/17 条件未達=変装不可)。
//   a2: 【変装時】=> trigger{hook:'disguise:into', selfOnly:true}。
//       「LP2以上の【白】のキャラと入れ替わった場合」=> matcherCondition{kind:'disguiseReplacedMatches',
//         filter:{lpMin:2, color:'白'}} (W3 新 primitive) — disguise:into payload.replacedChar (入替え元の
//         disguiseInto 直前 snapshot、turnEffects 保持 = 効果解決時点の実効 LP、rules/19) を filter 評価。
//       「このキャラはこのコンタクトによってリムーブされない」=> charSetTurnEffect{uid:'$self',
//         key:'contactImmune', val:true} — AP 判定 gate (flow/contact judge の ax.contactImmune snapshot) +
//         コンタクト終了時クリアは既存配線 (rules/22: AP 判定リムーブのみ免疫、カットイン直接リムーブは貫通)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'icon-disguise',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseColor', color: '白' },
      { kind: 'fileAtLeast', n: 6 },
    ],
  },
  description: '【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
    selfOnly: true,
    matcherCondition: { kind: 'disguiseReplacedMatches', filter: { lpMin: 2, color: '白' } },
  },
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'contactImmune', val: true } },
  description: '【変装時】LP2以上の【白】のキャラと入れ替わった場合、このキャラはこのコンタクトによってリムーブされない。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/23-qa-disguise-cutin.md'],
};

export const B02047: CardDef = {
  id: 'B02047',
  no: '0213/B02047',
  kind: 'character',
  names: ['工藤有希子'],
  colors: ['白'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['女優'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357230995841.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
