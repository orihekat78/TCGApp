// CT-P10 B10098 服部平次＆怪盗キッド
// rules: 08-contact.md, 09-cutin-disguise.md, 15-abilities-effects.md, 18-mr.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const grantedActiveAction: AbilityDef = {
  id: 'b10098-granted-active-action', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'action:pre-target', selfOnly: true },
  effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'] } },
  description: 'このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-partner-area',
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'selfToPartnerArea' }] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneEnter', args: {
      player: 'self', from: 'remove', max: 1, viaEffect: true, bind: '$entered',
      filter: { kind: 'character', levelMax: 8, cardName: ['服部平次', '怪盗キッド'], keywordFromPrintOrConditionIcon: '突撃' },
    } },
    { kind: 'atom', verb: 'charGrantAbility', args: { uid: '$entered.uid', scope: 'turn', ability: grantedActiveAction } },
  ] },
  description: '【宣言】【スリープ】〚パートナーエリアに移す〛：自分のリムーブエリアにある、〚突撃〛を持つレベル8以下の〚カード名［服部平次］〛か〚［怪盗キッド］〛を1枚まで選び、登場させる。ターン終了時までそのキャラに「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-partner-area', trigger: { hook: 'contact:start', matcherCondition: { kind: 'or', cs: [
    { kind: 'triggerCharMatches', payloadKey: 'aUid', side: 'self', filter: { kind: 'character', levelMin: 8 } },
    { kind: 'triggerCharMatches', payloadKey: 'bUid', side: 'self', filter: { kind: 'character', levelMin: 8 } },
  ] } },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, n: 1, side: 'self', inContact: true, scope: 'contact', filter: { kind: 'character', levelMin: 8 } } },
  description: '自分の現場にいるレベル8以上のキャラがコンタクトしたとき、そのコンタクト中、そのキャラをAP＋2000する。この能力はパートナーエリアでも発動する。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B10098: CardDef = {
  id: 'B10098', no: '1153/B10098', kind: 'character', names: ['服部平次＆怪盗キッド', '服部平次', '怪盗キッド'],
  colors: ['緑', '白'], level: 9, ap: 8000, lp: 2, traits: ['探偵', '高校生', '怪盗'], keywords: ['突撃'], rarity: 'MR', imageUrl: '1783904232417640.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};
