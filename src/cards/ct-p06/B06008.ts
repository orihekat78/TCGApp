// cards/ct-p06/B06008 仮面ヤイバー (character) — engine mega-wave W4 r5 exemplar (charStackCard fromSelf, 2026-07-03)
// rules: 13-keywords.md (突撃), 15-abilities-effects.md, 16-card-set.md (重ねる), 17-icons.md (登場時),
//        22-qa-action-contact.md (アクション終了時), 25-qa-effects-resolution.md (そうした場合)
//
// 公式テキスト:
//   【登場時】自分のリムーブエリアに〚特徴［少年探偵団］〛のキャラがある場合、ターン終了時まで
//   このキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
//   このキャラのアクション終了時、自分の現場にいる〚カード名［仮面ヤイバー］〛以外のキャラを1枚選び、
//   このキャラをそのキャラの下に重ねる。（選べる場合、必ず選んで重ねる）重ねた場合、カードを1枚引く。
//
// a1: 【登場時】+「ある場合」= trigger enter selfOnly + condition removeTraitAtLeast (発動時点判定 —
//     公式Q&A「発動した時点で条件を満たしていなければ持てない」/「後でなくなっても失わない」= 1回
//     判定の turn-scope grant、rules/24 常時型でない)。
// a2: 「このキャラのアクション終了時」= trigger action:end selfOnly (rules/22: 終了時点で現場に居る
//     場合のみ — 自分がアクション主体なので満たす)。「以外のキャラを1枚選び」= fromSelf 短縮形 pick
//     n:1 (必須、0候補時のみ auto-skip =「選べる場合、必ず」)。「このキャラをそのキャラの下に重ねる」
//     = charStackCard fromSelf (mutate.scene.toStack、非リムーブ離場・rules/16 cascade・MR 非redirect)。
//     「重ねた場合、カードを1枚引く」= chain gate (rules/25)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'removeTraitAtLeast', player: 'self', trait: '少年探偵団', n: 1 },
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  description: '【登場時】自分のリムーブエリアに〚特徴［少年探偵団］〛のキャラがある場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:end', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 自分の現場にいる〚カード名［仮面ヤイバー］〛以外のキャラを1枚選び、このキャラをその下に重ねる
      { kind: 'atom', verb: 'charStackCard', args: { fromSelf: true, player: 'self', side: 'self', n: 1, filter: { cardNameNot: '仮面ヤイバー' } } },
      // 重ねた場合、カードを1枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description: 'このキャラのアクション終了時、自分の現場にいる〚カード名［仮面ヤイバー］〛以外のキャラを1枚選び、このキャラをそのキャラの下に重ねる。（選べる場合、必ず選んで重ねる）重ねた場合、カードを1枚引く。',
  ruleRefs: ['rules/16-card-set.md', 'rules/22-qa-action-contact.md', 'rules/25-qa-effects-resolution.md'],
};

export const B06008: CardDef = {
  id: 'B06008',
  no: '0633/B06008',
  kind: 'character',
  names: ['仮面ヤイバー'],
  colors: ['青'],
  level: 5,
  ap: 6000,
  lp: 0,
  traits: ['ヒーロー'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754284680561957.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/16-card-set.md'],
};
