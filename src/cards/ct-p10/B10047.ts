// CT-P10 B10047 ラディッシュ・レッドウッド — rules: 03-field-areas, 09-cutin-disguise, 12-next-hint, 15-abilities-effects, 17-icons, 20-color-and-switch
import type { AbilityDef, CardDef } from '@/engine/types';

const a0: AbilityDef = {
  id: 'a0', type: 'continuous', scope: 'on-hand',
  condition: { kind: 'caseName', name: '工藤新一NYの事件' },
  continuousModifier: { colorIgnoreOnHandUse: true },
  description: '自分の事件が〚カード名［工藤新一NYの事件］〛で、手札から使用する場合、このキャラは事件カードの色を無視できる。（ネクストヒントでの使用も「手札から使用」に含まれる）',
  ruleRefs: ['rules/12-next-hint.md', 'rules/15-abilities-effects.md', 'rules/20-color-and-switch.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  ] },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', levelMax: 6, keyword: '変装' } } },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある【変装】を持つレベル6以下のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10047: CardDef = {
  id: 'B10047', no: '1107/B10047', kind: 'character', names: ['ラディッシュ・レッドウッド'], colors: ['白'], level: 5, ap: 5000, lp: 1,
  traits: ['警察', 'NY市警'], rarity: 'C', imageUrl: '1783904138051265.jpg', abilities: [a0, a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/09-cutin-disguise.md', 'rules/12-next-hint.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
