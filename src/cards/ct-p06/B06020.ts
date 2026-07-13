// cards/ct-p06/B06020 佐々木小次郎 (character)
// rules: 08-contact.md, 09-cutin-disguise.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-hand',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: {
    handCutinAura: { filter: { color: '緑', trait: 'YAIBA', kind: 'character' }, apDelta: 2000 },
  },
  description: '【自分ターン中】自分の手札にある【緑】の〚特徴［YAIBA］〛のキャラは「【カットイン】AP＋2000」を持つ。（【カットイン】を2つ以上持つ場合、1つ選んで使う）',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'removeDeckTop', player: 'self', n: 3 }] },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', bind: 'target', max: 1 } },
      { kind: 'atom', verb: 'startContact', args: { targetUid: '$target.uid' } },
    ],
  },
  description: '【宣言】【スリープ】〚デッキのカードを上から3枚リムーブする〛：相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。（このキャラがアクションした側のキャラになる）',
  ruleRefs: ['rules/08-contact.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'],
};

export const B06020: CardDef = {
  id: 'B06020', no: '0643/B06020', kind: 'character', names: ['佐々木小次郎'], colors: ['緑'],
  level: 7, ap: 6000, lp: 0, traits: ['YAIBA'], keywords: [], rarity: 'R',
  imageUrl: '1754284680631969.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/22-qa-action-contact.md'],
};
