// cards/ct-p06/B06047 鉄刃
// rules: 12-next-hint.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md,
//        19-special-rules.md
import type { AbilityDef, CardDef } from '@/engine/types';

const abilities: AbilityDef[] = [
  {
    id: 'a1', type: 'continuous', scope: 'on-scene',
    continuousModifier: {
      handLevelAura: {
        filter: { kind: 'event', color: '白', trait: 'YAIBA' },
        delta: -1,
      },
    },
    description: '自分の手札にある【白】の〚特徴［YAIBA］〛のイベントをレベル－1する。',
    ruleRefs: ['rules/12-next-hint.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
  },
  {
    id: 'a2', type: 'triggered', scope: 'on-scene',
    condition: { kind: 'turn', player: 'self' }, limit: { kind: 'turn', n: 1 },
    trigger: {
      hook: 'setcard:enter', selfOnly: true,
      matcherCondition: { kind: 'setCardMatches', filter: { trait: 'YAIBA' } },
    },
    effect: {
      kind: 'atom', verb: 'sceneEnter',
      args: {
        player: 'self', from: 'remove', max: 1, enterSleep: true, viaEffect: true,
        filter: { kind: 'character', trait: 'YAIBA', levelMax: 5 },
      },
    },
    description: '【自分ターン中】【ターン1】このキャラに〚特徴［YAIBA］〛のカードがセットされたとき、自分のリムーブエリアにあるレベル5以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
  },
];

export const B06047: CardDef = { id: 'B06047', no: '0668/B06047', kind: 'character', names: ['鉄刃'], colors: ['白'], level: 8, ap: 7000, lp: 0, traits: ['YAIBA'], keywords: ['迅速'], rarity: 'R', imageUrl: '1754285220451879.jpg', abilities, ruleRefs: ['rules/12-next-hint.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/19-special-rules.md'] };
