// cards/ct-p05/B05007 妃英理 (character) — Wave A 刈り取り (engine A3 wave setActionCutinBanFilter 解禁, 2026-07-11)
// rules: 03-field-areas.md (スリープ/スイッチ), 07-action-flow.md (アクション), 09-cutin-disguise.md (カットイン),
//        13-keywords.md (絆), 15-abilities-effects.md, 17-icons.md (【登場時】/【絆】/【宣言】/【ターン1】),
//        19-special-rules.md (複数名), 20-color-and-switch.md (スイッチ), 21-declared-ability-cost.md,
//        22-qa-action-contact.md / 25-qa-effects-resolution.md (「〜がアクションしたとき」発動タイミング)
//
// 公式テキスト:
//   【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の〚カード名［工藤新一］〛か
//     レベル6以下の〚特徴［毛利探偵事務所］〛のキャラを1枚まで登場させ、カードを1枚引く。
//   【絆毛利小五郎】【宣言】【ターン1】〚手札を1枚リムーブする〛：このターン中、自分の現場にいる
//     〚特徴［毛利探偵事務所］〛のキャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない。
//
// 句マッピング:
//   - a1 【登場時】このキャラをスリープさせてもよい。そうした場合、…登場させ、カードを1枚引く
//        => triggered{enter, selfOnly} + optional{ sequence[ sceneSetState{$self,sleep}, sceneEnter{hand,filterAny}, draw ] }
//        [src/cards/ct-p07/B07008.ts a1 が同 idiom (optional{sequence[sceneSetState $self sleep, tail]})。
//         「してもよい」= optional (AI/human 辞退可)。sequence は各 step 独立 (no-apply-break しない、resolver.ts
//         sequence case) — 公式Q&A「キャラを1枚も登場させずにカードを1枚引くことはできますか？→はい」に整合
//         (登場0枚でも draw は必ず実行) → chain ではなく sequence が必須。sleep→登場→draw の印字順。]
//   - 手札からレベル6以下の[工藤新一]か[毛利探偵事務所]のキャラを1枚まで登場させ
//        => sceneEnter{player:'self', from:'hand', max:1, viaEffect:true, filterAny:[{cardName:'工藤新一',levelMax:6,
//           kind:'character'},{trait:'毛利探偵事務所',levelMax:6,kind:'character'}]}
//        [src/cards/ct-p02/B02004.ts a1 が同族 exemplar (filterAny の 妃英理/毛利探偵事務所、from:'remove')。
//         本カードは「手札から」なので from:'hand'。「1枚まで」= max:1 (min0)。「か」= filterAny (OR)。
//         公式Q&A: 現場5枚時もスイッチで登場可 (sceneEnter が switch を engine 側で処理、rules/20)。]
//   - a2 【絆毛利小五郎】= condition bond / 【宣言】【ターン1】= declared + limit turn:1 /
//        〚手札を1枚リムーブする〛= cost removeFromHand n:1
//        => declared + condition{bond,毛利小五郎} + limit{turn,1} + cost{removeFromHand,pick hand n1}
//        [src/cards/ct-p01/B01087.ts a1 (bond+declared+limit) / src/cards/ct-p01/B01088.ts a1 (removeFromHand cost pick)。
//         コスト「自分の」省略 = 自分の手札 (rules/21)。]
//   - このターン中、[毛利探偵事務所]のキャラがアクションしたとき、アクション終了時まで相手は【カットイン】使用不可
//        => atom setActionCutinBanFilter{filter:{trait:'毛利探偵事務所'}} (player 既定 self)
//        [engine A3 wave 新 verb。turnState[self].actionCutinBanOppFilter を arm し、canCutIn (flow/contact.ts) が
//         現行アクションの actor を filter と live 照合して相手 cutin を封じる (probe: tests/cards/night-wA3/
//         B05007-action-cutin-ban.test.ts)。「アクションしたとき」= filter 一致キャラのアクション中のみ (将来登場
//         キャラにも適用) / 「アクション終了時まで」= action スコープ / 清掃 = turn:start。公式Q&A: 【変装】は封じない
//         (canCutIn のみ gate) / 条件を満たすたびに発動 (per-char flag 不要) = 本 arm 機構で自然成立。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  // このキャラをスリープさせてもよい。そうした場合、手札からLv6以下の[工藤新一]/[毛利探偵事務所]を1枚まで登場させ、1枚引く。
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        // このキャラをスリープさせ、
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
        // 手札からレベル6以下の[工藤新一]かレベル6以下の[毛利探偵事務所]のキャラを1枚まで登場させ、
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            from: 'hand',
            max: 1,
            viaEffect: true,
            filterAny: [
              { cardName: '工藤新一', levelMax: 6, kind: 'character' },
              { trait: '毛利探偵事務所', levelMax: 6, kind: 'character' },
            ],
          },
        },
        // カードを1枚引く。(公式Q&A: 登場0枚でも必ず引く → sequence の独立 tail)
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description:
    '【登場時】このキャラをスリープさせてもよい。そうした場合、手札からレベル6以下の〚カード名［工藤新一］〛かレベル6以下の〚特徴［毛利探偵事務所］〛のキャラを1枚まで登場させ、カードを1枚引く。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'bond', cardName: '毛利小五郎' }, // 【絆毛利小五郎】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 〚手札を1枚リムーブする〛
  cost: {
    kind: 'removeFromHand',
    target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
    n: 1,
  },
  // このターン中、[毛利探偵事務所]のキャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない。
  effect: { kind: 'atom', verb: 'setActionCutinBanFilter', args: { filter: { trait: '毛利探偵事務所' } } },
  description:
    '【絆毛利小五郎】【宣言】【ターン1】〚手札を1枚リムーブする〛：このターン中、自分の現場にいる〚特徴［毛利探偵事務所］〛のキャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const B05007: CardDef = {
  id: 'B05007',
  no: '0513/B05007',
  kind: 'character',
  names: ['妃英理'],
  colors: ['青'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['弁護士'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1745322178395678.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
