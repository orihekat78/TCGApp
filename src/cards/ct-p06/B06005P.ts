// B06005P 阿笠博士 — rules/15, 16, 21
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'charStackCard', args: { uid: '$self', cardIds: '$pick.cardIds', bind: '$stacked', gateOnEmpty: true, target: { kind: 'pick', chooser: 'self', query: { area: 'remove', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 0, max: 2 } } } },
    { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: { dyn: '$bound.$stacked.levelSum' } } } },
  ] },
  description: '【登場時】自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを2枚まで選び、このキャラの下に重ねる。そうした場合、重ねたキャラのレベルの合計以下のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always', limit: { kind: 'turn', n: 1 }, cost: { kind: 'sleepSelf' },
  effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', max: 1, bind: '$target' } },
    { kind: 'atom', verb: 'stackedCardPick', args: { hostUid: '$self', player: 'self', min: 0, max: 2, bind: '$under', selectedInstanceIds: '$pick.uids' } },
    { kind: 'atom', verb: 'charTransferStackedCards', args: { fromUid: '$self', toUid: '$target.uid', bind: '$under' } },
  ] },
  description: '【宣言】【ターン1】【スリープ】：自分の現場にいるキャラを1枚まで選び、このキャラの下に重なっているカードを2枚までそのキャラの下に重ねる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B06005P: CardDef = {
  id: 'B06005P', no: '0630/B06005P', kind: 'character', names: ['阿笠博士'], colors: ['青'], level: 8, ap: 7000, lp: 2,
  traits: ['発明家'], keywords: [], rarity: 'RP', imageUrl: '1755684931829069.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
