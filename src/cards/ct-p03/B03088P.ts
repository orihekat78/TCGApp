// cards/ct-p03/B03088P 松田陣平 (character・パラレル) — ENGINE0 wave (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/10-action-event.md
//
// 公式テキスト (B03088 と同一効果。P 版は cardNum / rarity / imageUrl のみ異なる):
//   【宣言】【ターン1】レベル7以下のキャラを1枚まで選び、アクティブにし、AP＋1000し、ターン終了時まで〚突撃〛を与える。
//     カードを1枚引く。自分の現場に［降谷零］［諸伏景光］［伊達航］［萩原研二］がいる場合に宣言できる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
// 句マッピングは B03088.ts と同一 (同テキスト別ファイル full def 慣行 — B03066P / B09096P 同様)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'bond', cardName: '降谷零' },
      { kind: 'bond', cardName: '諸伏景光' },
      { kind: 'bond', cardName: '伊達航' },
      { kind: 'bond', cardName: '萩原研二' },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: { max: 1, side: 'either', filter: { levelMax: 7 }, delta: 1000, scope: 'permanent', bind: '$picked' },
      },
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$picked.uid', state: 'active' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '突撃', scope: 'turn' } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '【宣言】【ターン1】レベル7以下のキャラを1枚まで選び、アクティブにし、AP＋1000し、ターン終了時まで〚突撃〛を与える。カードを1枚引く。自分の現場に［降谷零］［諸伏景光］［伊達航］［萩原研二］がいる場合に宣言できる。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03088P: CardDef = {
  id: 'B03088P',
  no: '0341/B03088P',
  kind: 'character',
  names: ['松田陣平'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'RP',
  imageUrl: '1729133443653279.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/10-action-event.md',
  ],
};
