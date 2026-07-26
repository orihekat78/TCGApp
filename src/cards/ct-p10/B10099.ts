// CT-P10 B10099 赤井秀一＆安室透
// rules: 15-abilities-effects.md, 17-icons.md, 18-mr.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-partner-area',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { lvlDeltaAuraOpp: -1 },
  description: '【自分ターン中】相手の現場にいるキャラをレベル−1する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/18-mr.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMax: 7 } } },
  description: '【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-partner-area', limit: { kind: 'turn', n: 2 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'self' },
      { kind: 'boundMatchesFilter', bindKey: '$triggerChar', filter: { hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] } },
    ],
  },
  trigger: { hook: 'enter', matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid' } },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'conditional',
      if: { kind: 'boundCharStateIs', bindKey: '$triggerChar', state: 'active' },
      then: {
        kind: 'chain',
        steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$triggerChar.uid', state: 'sleep' } },
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMaxBound: { bindKey: '$triggerChar' } } } },
        ],
      },
    },
  },
  description: '【自分ターン中】【ターン2】自分の現場に【カットイン】と【ヒラメキ】以外の元の能力を持たないキャラが登場したとき、そのキャラをスリープさせてもよい。そうした場合、そのキャラのレベル以下のレベルのキャラを1枚まで選び、リムーブする。この能力はパートナーエリアでも発動する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md'],
};

const a4: AbilityDef = {
  id: 'a4', type: 'triggered', scope: 'on-hand',
  condition: { kind: 'turn', player: 'self' },
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP+2000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md'],
};

export const B10099: CardDef = {
  id: 'B10099', no: '1154/B10099', kind: 'character', names: ['赤井秀一＆安室透', '赤井秀一', '安室透'], colors: ['赤', '黄'], level: 9, ap: 8000, lp: 2,
  traits: ['探偵', 'FBI', '赤井家', '喫茶ポアロ'], keywords: ['カットイン'], rarity: 'MR', imageUrl: '1783904232432220.jpg', abilities: [a1, a2, a3, a4],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md'],
};

export const B10099P: CardDef = { ...B10099, id: 'B10099P', no: '1154/B10099P', rarity: 'MRP', imageUrl: '1783904232439228.jpg' };
