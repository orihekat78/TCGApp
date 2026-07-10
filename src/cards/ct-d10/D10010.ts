// cards/ct-d10/D10010 工藤新一 (character・パラレル) — engine A1 wave twin (charStackCard scene-source, 2026-07-11)
// rules: 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト (D10009 と同一効果。パラレル版は cardNum が同じで imageUrl のみ異なる — TSV 全文一致):
//   自分のターン終了時、自分の現場に〚カード名［毛利蘭］〛がいない場合、このキャラをリムーブする。
//   【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、デッキの下に移す。
//   【事件シャッフルロマンス】【宣言】【ターン1】自分の現場にいる〚カード名［毛利蘭］〛を1枚まで選び、
//     このキャラの下に重ねる。重ねた場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。
//
// 句マッピング: D10009.ts と同一 (同テキスト別ファイル full def 慣行、B08005P 同様)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '@/cards/_shared';

const a0: AbilityDef = {
  id: 'a0',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'not', c: { kind: 'bond', cardName: '毛利蘭' } }] },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self' } },
  description: '自分のターン終了時、自分の現場に〚カード名[毛利蘭]〛がいない場合、このキャラをリムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  effect: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, pos: 'bottom', filter: { apMax: 8000 } } },
  description: '【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2Inner: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'charStackCard', args: { fromScene: true, player: 'self', max: 1, filter: { cardName: '毛利蘭' } } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
    ],
  },
  description: '【宣言】【ターン1】自分の現場にいる〚カード名[毛利蘭]〛を1枚まで選び、このキャラの下に重ねる。重ねた場合、ターン終了時までこのキャラは〚突撃[キャラ]〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
const a2: AbilityDef = caseTraitConditioned({ trait: 'シャッフルロマンス', inner: a2Inner });

export const D10010: CardDef = {
  id: 'D10010',
  no: '0840/D10010',
  kind: 'character',
  names: ['工藤新一'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1761913165320730.jpg',
  abilities: [a0, a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
