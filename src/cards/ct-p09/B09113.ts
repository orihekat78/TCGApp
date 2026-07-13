// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 21-declared-ability-cost.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'always',
  trigger: { hook: 'case:to-resolved', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分の手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'choice', chooser: 'self', options: [
      {
        kind: 'conditional', if: { kind: 'scratchTrace', player: 'self', v: '未発見' }, then: {
          kind: 'sequence', steps: [
            { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', cardIds: '$pick.cardIds', max: 1, faceDown: true, bind: '$flipped' } },
            { kind: 'conditional', if: { kind: 'boundCountCompare', bindKey: '$flipped', cmp: 'ge', n: 1 }, then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } } },
          ],
        },
      },
      {
        kind: 'conditional', if: { kind: 'and', cs: [{ kind: 'scratchTrace', player: 'self', v: '発見済' }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '赤', kind: 'character' } }, nMin: 1 }, { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { color: '黒', kind: 'character' } }, nMin: 1 }] }, then: {
          kind: 'sequence', steps: [
            { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', cardIds: '$pick.cardIds', max: 3, faceDown: true, bind: '$flipped' } },
            { kind: 'conditional', if: { kind: 'boundCountCompare', bindKey: '$flipped', cmp: 'ge', n: 1 }, then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', state: ['sleep'], filter: { levelMax: 7 } } } },
          ],
        },
      },
    ],
  },
  description: '【解決編】【宣言】【ターン1】次から1つ選んでよい。〚痕跡［未発見］〛の場合、自分の裏向きの証拠を1つまで選び、表向きにしてもよい。そうした場合、相手のデッキのカードを上から2枚リムーブする。〚痕跡［発見済み］〛で、自分の現場に【赤】と【黒】のキャラがいる場合、自分の裏向きの証拠を3つまで選び、表向きにしてもよい。そうした場合、レベル7以下のスリープ状態のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B09113: CardDef = { id: 'B09113', no: '1052/B09113', kind: 'case', names: ['「愛しい愛しい…宿敵さん？」'], colors: ['赤', '黒'], level: 7, caseTraits: [], traits: [], rarity: 'C', imageUrl: '1775608962395563.jpg', abilities: [a1, a2], ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'] };
