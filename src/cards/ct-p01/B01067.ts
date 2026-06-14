// cards/ct-p01/B01067 メアリー (キャラ) — engine拡張 wave#2 cluster3 (b群, evidence:gain selfOnly)
// rules: 10-action-event.md, 07-action-flow.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   このキャラのアクション［事件］によって証拠を得たとき、相手の現場にいるレベル5以下のキャラを1枚まで選び、手札に移す。
//
// 句マッピング:
//   - 「このキャラの…証拠を得たとき」      → trigger hook 'evidence:gain' + selfOnly:true
//        (cluster3 X9: gainSelfEvidence emit のみ source={player, uid:byUid}=アクションした actor。
//         推理/効果/refresh 由来では emit しない → 「アクション［事件］によって」の語義を構造的に保証。
//         selfOnly=「このキャラの」= source.uid 一致。離場 actor は in-play scan 対象外で自然に不発)
//   - 「相手の現場にいるレベル5以下のキャラを1枚まで選び、手札に移す」
//        → sceneToHand{player:'self', max:1, side:'opp', filter:{levelMax:5}} PA短縮形
//        (出荷済同型 B06069 a2 と levelMax 違いのみ。max:1 = rules/15「〜枚まで」0枚可。
//         手札に移す行き先 = 所有者=相手の手札、mutate/scene.ts toHand 既定で統一済)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'evidence:gain',
    // 「このキャラの」アクション［事件］で証拠を得たとき (source.uid 一致、離場時不発)
    selfOnly: true,
  },
  // 相手の現場のレベル5以下を 1 枚まで選び、相手の手札に移す (sceneToHand PA短縮形)
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 5 } },
  },
  description:
    'このキャラのアクション［事件］によって証拠を得たとき、相手の現場のレベル5以下を1枚まで選び、手札に移す。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/07-action-flow.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};

export const B01067: CardDef = {
  id: 'B01067',
  no: '0057/B01067',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1714013053507659.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/07-action-flow.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};