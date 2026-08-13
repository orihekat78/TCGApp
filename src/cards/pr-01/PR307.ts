// rules: 03-field-areas.md, 08-contact.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' }, continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】AP＋1000', ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'and', cs: [
    { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
    { kind: 'partnerColor', color: '青' },
    { kind: 'turn', player: 'self' },
  ] },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    {
      kind: 'atom',
      verb: 'sceneSetState',
      args: {
        uid: '$pick',
        state: 'sleep',
        target: {
          kind: 'pick',
          query: { area: 'scene', side: 'self', state: ['active'], filter: { levelMin: 7 } },
          n: { min: 1, max: 1 },
          chooser: 'self',
        },
      },
    },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: 'target' } },
    { kind: 'atom', verb: 'startContact', args: { targetUid: '$target.uid' } },
  ] } },
  description: '【事件青＆黒】【パートナー青】【自分ターン中】【登場時】手札を1枚リムーブし、自分の現場にいるレベル7以上のキャラを1枚スリープさせてもよい。そうした場合、カードを1枚引き、相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/08-contact.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' }, effect: { kind: 'optional', effect: { kind: 'atom', verb: 'mill', args: { player: 'self', n: 1 } } },
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から1枚リムーブしてもよい。', ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};
export const PR307: CardDef = {
  id: 'PR307', no: '1160/PR307', kind: 'character', names: ['灰原哀'], colors: ['青'], level: 7, ap: 5000, lp: 1,
  traits: ['少年探偵団', '科学者'], keywords: [], rarity: 'PR', imageUrl: '1785395500813858.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/08-contact.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
