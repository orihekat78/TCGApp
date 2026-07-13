// B08008 吉田歩美 — rules/07, 10, 15, 16
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: '$host', filter: { color: '青' } } },
    { kind: 'atom', verb: 'charStackCard', args: { uid: '$host.uid', cardIds: '$pick.cardIds', gateOnEmpty: true, target: { kind: 'pick', chooser: 'self', query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 0, max: 1 } } } },
    { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$host.uid', key: 'actionTargetsActive', val: true } },
  ] },
  description: '【登場時】自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、自分の現場にいる【青】のキャラ1枚の下に重ねる。重ねた場合、ターン終了時までそのキャラに「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md'],
};

export const B08008: CardDef = {
  id: 'B08008', no: '0849/B08008', kind: 'character', names: ['吉田歩美'], colors: ['青'], level: 6, ap: 5000, lp: 1,
  traits: ['少年探偵団'], keywords: [], rarity: 'R', imageUrl: '1770731204342298.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};
