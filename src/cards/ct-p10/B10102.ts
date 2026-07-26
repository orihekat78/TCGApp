// CT-P10 B10102 緋色の真相
// rules: 01-victory-conditions.md, 03-field-areas.md, 14-refresh.md,
//        15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
// Official Q&A: 1枚ごとの閲覧・任意手札化を対象キャラ数だけ順に解決する。
import type { AbilityDef, CardDef, Effect } from '@/engine/types';

const legalSceneCharacter = { kind: 'character' as const, hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] };
const lookOneAndResolve: Effect = {
  kind: 'sequence',
  steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', maxN: 1, bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
    { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
  ],
};
const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'always', trigger: { hook: 'case:to-resolved', selfOnly: true },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'always', condition: { kind: 'caseStatus', status: '解決編' }, limit: { kind: 'turn', n: 1 },
  cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
  effect: { kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'self', filter: legalSceneCharacter } }, do: lookOneAndResolve },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を2つ表向きにする〛：自分の現場にいる【カットイン】と【ヒラメキ】以外の元の能力を持たないキャラ1枚につき、自分のデッキのカードを上から1枚見る。その中からカードを1枚まで手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};
export const B10102: CardDef = {
  id: 'B10102', no: '1157/B10102', kind: 'case', names: ['緋色の真相'], colors: ['赤', '黄'], caseTraits: [], traits: [], rarity: 'C', imageUrl: '1783904247245007.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};
