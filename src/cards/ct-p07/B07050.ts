// cards/ct-p07/B07050 藤江 (character) — Task A certify-harvest needsManual (engine変更0, 手書き closure)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   【ターン1】自分の現場に〚カード名［小泉紅子］〛が登場したとき、カードを1枚引く。
//   【カットイン】AP＋1000、〚カード名［小泉紅子］〛のキャラに【カットイン】する場合、代わりにAP＋3000（コンタクト中に手札からリムーブして使う）
//
// 句マッピング:
//   - a1 【ターン1】 => limit {kind:'turn', n:1}。【自分ターン中】なし → condition なし
//   - a1 自分の現場に〚カード名［小泉紅子］〛が登場したとき => trigger {hook:'enter',
//     matcherCondition: triggerCharMatches{side:'self', payloadKey:'uid', filter:{cardName:'小泉紅子'}}}
//     (NOT selfOnly — bearer が他キャラの登場を観測。handleHook が in-play 全カード走査、
//      非 selfOnly の enter ability は任意の enter で評価され matcherCondition で entering char を絞る。
//      triggered.ts:223-225 selfOnly skip + 227-242 matcherCondition gate。enter payload {uid,player}。)
//   - a1 カードを1枚引く => atom draw {player:'self', n:1}
//   - a2 【カットイン】（コンタクト中に手札からリムーブして使う） => triggered, scope:'on-hand',
//     trigger {hook:'effect:declared', optional:true, selfOnly:true} (D10011 a2 / D11013 a1 同型)
//   - a2 AP＋1000、〚小泉紅子〛に【カットイン】する場合 代わりに AP＋3000 => conditional(
//     if contactTargetMatches({names:['小泉紅子']}), then charModifyAP $contact.byUid +3000,
//     else +1000)。「代わりに」= 排他 (3000 or 1000)。contactTargetMatches は custom closure ゆえ手書き。

import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 自分の現場に[小泉紅子]が登場したとき (bearer が他キャラ登場を観測 — NOT selfOnly)
  trigger: {
    hook: 'enter',
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { cardName: '小泉紅子' } },
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ターン1】自分の現場に〚カード名［小泉紅子］〛が登場したとき、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // [小泉紅子]に【カットイン】する場合のみ AP＋3000、それ以外は AP＋1000 (代わりに=排他)
  effect: {
    kind: 'conditional',
    if: contactTargetMatches({ names: ['小泉紅子'] }),
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } },
    else: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  },
  description: '【カットイン】AP＋1000、〚カード名［小泉紅子］〛のキャラに【カットイン】する場合、代わりにAP＋3000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/22-qa-action-contact.md'],
};

export const B07050: CardDef = {
  id: 'B07050',
  no: '0779/B07050',
  kind: 'character',
  names: ['藤江'],
  colors: ['白'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414010576370.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md'],
};
