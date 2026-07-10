// cards/ct-p07/B07008 小嶋元太 (character) — M2後半 mini-wave (lvlDeltaInHandPer) 同梱 exemplar
// rules: rules/12-next-hint.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/03-field-areas.md
// 公式テキスト:
//   【パートナー青】【解決編】【自分ターン中】手札にあるこのキャラは、自分の現場にいる〚カード名［阿笠博士］〛か
//     〚特徴［少年探偵団］〛のキャラ1枚につき、レベル－1される。
//   【FILE5】【登場時】このキャラをスリープさせてもよい。そうした場合、相手の現場にいるレベル8以下のキャラを1枚まで選び、手札に移す。
// 公式QA:
//   - 「レベルがマイナスされた状態で使用した（登場した）このキャラは、現場でもそのレベルのままですか？」→ いいえ。
//     手札にある間だけ (現場ではレベル8) → lvlDeltaInHandPer は hand gate 専用 (effectiveHandLevel 4 site のみ、scene level 読み不変)
//   - 「《江戸川コナン/0001/B01005》が現場にいる状態でネクストヒント使用 → 何レベル以下を選べる?」→ 元のレベル (8以下)。
//     他カードが手札のこのカードのレベルを参照する場合は元レベル (本 modifier は手札使用 gate 専用) — 公式QA 通りの非対称
//   - 「FILE5 でネクストヒントし使用 → 【登場時】発動?」→ いいえ (手札に1枚加えて FILE4 → 【FILE5】不成立。condition は解決時参照 rules/25)
//   - 「【FILE（5）】はアシストしたパートナーも数える?」→ はい (rules/17、fileAtLeast は file.length 直読で該当)
// 句マッピング:
//   - 【パートナー青】 => {kind:'partnerColor', color:'青'} [VERBATIM B01009.ts a1]
//   - 【解決編】 => {kind:'caseStatus', status:'解決編'} [VERBATIM B09095.ts a1 / D08019.ts]
//   - 【自分ターン中】 => {kind:'turn', player:'self'} [VERBATIM B09095.ts a1]
//   - 手札にあるこのキャラは…1枚につきレベル-1 => scope:'on-hand' continuous +
//     continuousModifier{lvlDeltaInHandPer:{delta:-1, filterAny:[...]}} [engine M2後半 primitive
//     (card-def.ts:213 / hand-use-card.ts:120-129)。filterAny = per-char OR (カード名 阿笠博士 OR 特徴 少年探偵団)、
//     両該当でも1枚は1 (matchOneFilter 静的評価)。下限なし rules/19]
//   - 「〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラ」=> filterAny:[{cardName:'阿笠博士', kind:'character'},
//     {trait:'少年探偵団', kind:'character'}] (自分の現場 = effectiveHandLevel が state.players[p].scene を走査)
//   - 【FILE5】 => {kind:'fileAtLeast', n:5} [cond/eval.ts:109-113]
//   - 【登場時】 => trigger:{hook:'enter', selfOnly:true} [VERBATIM B09095.ts a2]
//   - このキャラをスリープさせてもよい。そうした場合、〜 => optional{sequence[sceneSetState $self sleep, sceneToHand]}
//     [optional 形 = B01047.ts a1。decline で両方不発 (rules/15 「してもよい」)]
//   - 相手の現場にいるレベル8以下のキャラを1枚まで選び、手札に移す => sceneToHand 短縮形
//     {player:'self', side:'opp', max:1, filter:{levelMax:8, kind:'character'}} [VERBATIM B01067.ts a1 (levelMax 5→8 差のみ、
//     同一文型「相手の現場のレベルN以下を1枚まで選び、手札に移す」)。player = chooser (atomSceneToHand は
//     paShortFormAwait(chooser=resolvePlayer(a.player), side=a.player既定→a.side 上書き) — 選ぶのは能力所有者)。
//     「1枚まで」= 0枚可 (rules/15) → max:1。移動先は所有者 (相手) の手札 (mutate.scene.toHand)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-hand',
  // 【パートナー青】【解決編】【自分ターン中】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '青' },
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'turn', player: 'self' },
    ],
  },
  // 自分の現場の [阿笠博士] か [少年探偵団] 1枚につきレベル-1 (hand gate 専用 — 現場ではレベル8、公式QA)
  continuousModifier: {
    lvlDeltaInHandPer: {
      delta: -1,
      filterAny: [
        { cardName: '阿笠博士', kind: 'character' },
        { trait: '少年探偵団', kind: 'character' },
      ],
    },
  },
  description:
    '【パートナー青】【解決編】【自分ターン中】手札にあるこのキャラは、自分の現場にいる〚カード名［阿笠博士］〛か〚特徴［少年探偵団］〛のキャラ1枚につき、レベル－1される。',
  ruleRefs: ['rules/12-next-hint.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // 【FILE5】 (解決時参照 — ネクストヒント使用で FILE4 なら不成立、公式QA)
  condition: { kind: 'fileAtLeast', n: 5 },
  // このキャラをスリープさせてもよい。そうした場合、相手の現場のレベル8以下を1枚まで手札に移す
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
        {
          kind: 'atom',
          verb: 'sceneToHand',
          args: { player: 'self', side: 'opp', max: 1, filter: { levelMax: 8, kind: 'character' } },
        },
      ],
    },
  },
  description:
    '【FILE5】【登場時】このキャラをスリープさせてもよい。そうした場合、相手の現場にいるレベル8以下のキャラを1枚まで選び、手札に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/03-field-areas.md'],
};

export const B07008: CardDef = {
  id: 'B07008',
  no: '0740/B07008',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 8,
  ap: 6000,
  lp: 0,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413976084538.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
