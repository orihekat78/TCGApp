// CT-P10 B10009 工藤新一
// rules: 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({ color: '青', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'optional', effect: { kind: 'chain', steps: [
    { kind: 'atom', verb: 'handReveal', args: { player: 'self', max: 1, bind: '$revealed', filter: { kind: 'character', cardName: '毛利蘭' } } },
    { kind: 'conditional', if: { kind: 'boundAnyMatchesFilter', bindKey: '$revealed', filter: { kind: 'character', cardName: '毛利蘭' } }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } },
  ] } },
  description: '【パートナー青】【登場時】手札から〚カード名［毛利蘭］〛を1枚公開してもよい。そうした場合、ターン終了時までこのキャラは〚突撃〛（名乗り状態でもアクションできる）を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'enterSource', viaEffect: true, side: 'self', sourceFilter: { kind: 'character' } },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
  description: '【登場時】自分のキャラの能力によって登場した場合、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10009: CardDef = {
  id: 'B10009', no: '1071/B10009', kind: 'character', names: ['工藤新一'], colors: ['青'], level: 5, ap: 5000, lp: 1,
  traits: ['探偵', '高校生'], rarity: 'C', imageUrl: '1783904055325025.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
