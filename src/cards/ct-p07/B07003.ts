// cards/ct-p07/B07003 工藤新一 (character)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
import type { AbilityDef, CardDef } from '@/engine/types';

export const B07003_ABILITIES: AbilityDef[] = [
  {
    id: 'a1', type: 'continuous', scope: 'on-hand',
    continuousModifier: { handCutinAura: { filter: { color: '青' }, apDelta: 1000 } },
    description: '自分の手札にある【青】のカードは「【カットイン】AP＋1000」を持つ。（【カットイン】を2つ以上持つ場合、1つ選んで使う）',
    ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
  },
  {
    id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
    condition: { kind: 'partnerColor', color: '青' },
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: 'moved', filter: { levelMax: 8, kind: 'character' } } },
        {
          kind: 'conditional', if: { kind: 'bound', key: 'moved', presence: 'exists' },
          then: {
            kind: 'sequence',
            steps: [
              { kind: 'atom', verb: 'sceneToDeck', args: { uid: '$moved.uid', pos: 'bottom' } },
              { kind: 'atom', verb: 'removeAreaToDeckTop', args: { player: 'opp', dest: 'bottom', max: 1, bindKey: 'moved', filter: { kind: 'character', cardName: { dyn: '$bound.moved.cardName' } } } },
              { kind: 'atom', verb: 'deckBottomReorderBound', args: { player: 'opp', bindKey: 'moved' } },
            ],
          },
        },
      ],
    },
    description: '【パートナー青】【登場時】相手の現場にいるレベル8以下のキャラを1枚までと、相手のリムーブエリアにあるそのキャラと同じカード名のキャラを1枚まで選び、相手は好きな順番でデッキの下に移す。',
    ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
  },
];

export const B07003: CardDef = {
  id: 'B07003', no: '0735/B07003', kind: 'character', names: ['工藤新一'], colors: ['青'],
  level: 8, ap: 7000, lp: 2, traits: ['探偵', '高校生'], keywords: [], rarity: 'R',
  imageUrl: '1762413976043061.jpg', abilities: B07003_ABILITIES,
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};
