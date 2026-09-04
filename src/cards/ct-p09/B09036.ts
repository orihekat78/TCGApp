// cards/ct-p09/B09036 怪盗キッド
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// a1: enter optional hand reveal (level <=8 character), then replace this
// character's name for the turn.  nameOverride is a complete replacement.
// a2: FILE5 declared; threshold is evaluated from the source-inclusive,
// effective-name count.  The 5+ outer branch snapshots that threshold before
// its optional scene target can leave, so both printed clauses use one count.
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional', effect: {
      kind: 'chain', steps: [
        { kind: 'atom', verb: 'handReveal', args: { player: 'self', audience: 'all', lifetime: 'presentation', max: 1, filter: { kind: 'character', levelMax: 8 }, bind: 'revealed' } },
        { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'nameOverride', val: '$revealed.cardName' } },
      ],
    },
  },
  description: '【登場時】手札からレベル8以下のキャラを1枚公開してもよい。そうした場合、ターン終了時までこのキャラのカード名を公開したキャラのカード名に書き換える。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const removeLowAp: AbilityDef['effect'] = {
  kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 }, pos: 'bottom' },
};

const a2: AbilityDef = {
  id: 'a2', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'fileAtLeast', n: 5 },
  effect: {
    kind: 'conditional', if: { kind: 'sameNameCountAtLeast', n: 5 },
    then: {
      kind: 'sequence', steps: [
        { kind: 'conditional', if: { kind: 'sameNameCountAtLeast', n: 2 }, then: removeLowAp },
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
      ],
    },
    else: { kind: 'conditional', if: { kind: 'sameNameCountAtLeast', n: 2 }, then: removeLowAp },
  },
  description: '【FILE5】【宣言】【ターン1】自分の現場にいるこのキャラと同じカード名のキャラの数につき、以下を行う。（上から順に行う）【2枚以上】AP8000以下のキャラを1枚まで選び、デッキの下に移す。【5枚以上】ターン終了時までこのキャラは〚突撃［事件］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const B09036: CardDef = {
  id: 'B09036', no: '0979/B09036', kind: 'character', names: ['怪盗キッド'], colors: ['白'], level: 8, ap: 7000, lp: 2,
  traits: ['怪盗'], keywords: [], rarity: 'SR', imageUrl: '1775608835900482.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};
