// CT-P10 B10057 ジェイムズ・ブラック
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'scratchTrace', player: 'self', v: '発見済' },
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'], printedKeywordWhenIconValid: true },
  description: '〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、このキャラは〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'and', cs: [
    { kind: 'partnerColor', color: '赤' },
    { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { kind: 'character', color: '黒' } }, nMin: 1 },
  ] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 2 } },
    { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character' }, state: 'sleep' } },
  ] },
  description: '【パートナー赤】【登場時】自分の現場に【黒】のキャラがいる場合、相手のデッキのカードを上から2枚リムーブし、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10057: CardDef = {
  id: 'B10057', no: '1116/B10057', kind: 'character', names: ['ジェイムズ・ブラック'], colors: ['赤'], level: 6, ap: 5000, lp: 1,
  traits: ['FBI'], keywords: [], rarity: 'C', imageUrl: '1783904159448344.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
