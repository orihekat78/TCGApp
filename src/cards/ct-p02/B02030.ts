// cards/ct-p02/B02030 服部平蔵 (キャラ)
// rules: 08-contact.md, 09-cutin-disguise.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   相手が【カットイン】を使用したとき、自分の現場にいるキャラにセットされているカードを
//     合わせて2枚リムーブしてもよい。そうした場合、その【カットイン】の効果を無効にする。
//   【宣言】【ターン1】自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを
//     上から1枚裏向きでセットする。
//
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'cutin:used',
    matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' },
  },
  effect: {
    kind: 'optional',
    aiRun: 'always',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'charRemoveSetCard',
          args: {
            player: 'self', side: 'self', n: 2, minimumPolicy: 'exact',
            filter: { hasSetCards: true },
          },
        },
        {
          kind: 'negate',
          trigger: {
            on: 'effect-resolution',
            matcher: { resolutionKind: 'cutin', declaredBatch: '$trigger.declaredBatch' },
          },
        },
      ],
    },
  },
  description: '相手が【カットイン】を使用したとき、自分の現場のセットカードを合わせて2枚リムーブしてもよい。そうした場合、その【カットイン】の効果を無効にする。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', max: 1, side: 'self', fromDeckTop: true, faceUp: false },
  },
  description: '【宣言】【ターン1】自陣キャラ1枚に 自デッキ上端を裏向きセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B02030: CardDef = {
  id: 'B02030',
  no: '0200/B02030',
  kind: 'character',
  names: ['服部平蔵'],
  colors: ['緑'],
  level: 6, ap: 6000, lp: 1,
  traits: ['警察', '大阪府警'], keywords: [],
  rarity: 'C',
  imageUrl: '1721357211024602.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
