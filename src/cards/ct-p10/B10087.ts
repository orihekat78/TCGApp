// CT-P10 B10087 ジン
// rules: 08-contact.md, 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'cutin:used', matcherCondition: { kind: 'and', cs: [
    { kind: 'triggerPlayerIs', side: 'self' },
    { kind: 'contactCharMatches', who: 'byUid', requireSource: true, filter: { kind: 'character' } },
  ] } },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'このキャラのコンタクト中に自分が【カットイン】を使用したとき、カードを1枚引く。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黒' }, trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true, bind: '$removed' } },
    { kind: 'conditional', if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', max: 1, bind: 'target' } },
      { kind: 'atom', verb: 'startContact', args: { targetUid: '$target.uid' } },
    ] } },
  ] } },
  description: '【パートナー黒】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって【カットイン】を持つ【黒】のカードが3枚以上リムーブされた場合、相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-hand', condition: { kind: 'turn', player: 'self' },
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md'],
};

export const B10087: CardDef = {
  id: 'B10087', no: '1142/B10087', kind: 'character', names: ['ジン'], colors: ['黒'], level: 8, ap: 8000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: [], rarity: 'R', imageUrl: '1783904232315186.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
