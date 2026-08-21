// CT-P10 B10060 「あ…赤井が!?」
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  condition: { kind: 'caseColor', color: ['赤', '黄'], combine: 'and' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'sceneEnter', args: {
      player: 'self', cardId: '$pick.cardId', from: 'remove', viaEffect: true, bind: '$entered',
      target: {
        kind: 'pick', chooser: 'self',
        query: { area: 'remove', side: 'self', filter: { kind: 'character', color: ['赤', '黄'], hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] } },
        n: { min: 0, max: 1 },
      },
    } },
    { kind: 'conditional', if: { kind: 'bound', key: '$entered', presence: 'exists' }, then: {
      kind: 'choice', chooser: 'self', options: [
        { kind: 'optional', effect: { kind: 'chain', steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$entered.uid', state: 'sleep' } },
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMaxBound: { bindKey: '$entered' } } } },
        ] } },
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$entered.uid', kw: '突撃[事件]', scope: 'turn' } },
      ],
    } },
  ] },
  description: '【事件赤＆黄】自分のリムーブエリアにある【カットイン】と【ヒラメキ】以外の元の能力を持たない【赤】か【黄】のキャラを1枚まで選び、登場させる。以下から1つ選んで行う。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
const a2: AbilityDef = { id: 'a2', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '【ヒラメキ】カードを1枚引く。', ruleRefs: ['rules/15-abilities-effects.md'] };
export const B10060: CardDef = { id: 'B10060', no: '1119/B10060', kind: 'event', names: ['「あ…赤井が!?」'], colors: ['赤'], level: 7, traits: [], rarity: 'C', imageUrl: '1783904159471739.jpg', abilities: [a1, a2], ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'] };
export const B10060P: CardDef = { ...B10060, id: 'B10060P', no: '1119/B10060P', rarity: 'CP', imageUrl: '1783904159478311.jpg' };
