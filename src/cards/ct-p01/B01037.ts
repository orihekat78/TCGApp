// cards/ct-p01/B01037 服部静華 (キャラ) — engine-extension wave#2 cluster3 (action-lifecycle trigger)
// rules: 07-action-flow.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md, 10-action-event.md, 14-refresh.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいる【緑】のキャラがアクション［キャラ］したとき、カードを1枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング (a1):
//   「自分の現場にいる【緑】のキャラが」      → matcherCondition triggerCharMatches{side:'self', filter:{color:'緑'}}
//                                              (filter で色 + 現場在場を gate。partner は scene 外 + 緑色不一致で自然除外)
//   「アクション［キャラ］したとき」          → trigger hook 'action:declare' + triggerActionKind{v:'char'}
//                                              (qAndA: アクション宣言+対象指定+スリープ時点で発動 = ガード判定前。
//                                               action:declare は宣言時 emit で本裁定と一致)
//   「【ターン1】」                            → limit { kind:'turn', n:1 }
//   「カードを1枚引き、」                      → draw { player:'self', n:1 } (必須 n)
//   「手札を1枚リムーブする。」                → discard { player:'self', n:1 } (必須 n。「してもよい」無し)
//   sequence で「引く」→「リムーブ」の記述順に解決 (rules/15)。
//
// 句マッピング (a2 = ヒラメキ、a2 規約・B01008/D08013 a2 同型):
//   「【ヒラメキ】カードを1枚引く。」          → evidence:remove-by-action (任意発動) → draw { player:'self', n:1 }

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【ターン1】自分側の【緑】キャラのアクション［キャラ］宣言時 (ガード判定前) に 1ドロー+手札1リムーブ
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'action:declare',
    // 自分の現場にいる【緑】のキャラがアクション［キャラ］したとき
    // (triggerActionKind char で action[キャラ] に限定 / triggerCharMatches で actor を self 側 + 緑色に gate)
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerActionKind', v: 'char' },
        { kind: 'triggerCharMatches', side: 'self', filter: { color: '緑' } },
      ],
    },
  },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引き、
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // 手札を1枚リムーブする。
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【ターン1】自分の現場にいる【緑】のキャラがアクション［キャラ］したとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】証拠が action[事件] でリムーブされるときに 1ドロー (任意発動、B01008/D08013 a2 同型)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01037: CardDef = {
  id: 'B01037',
  no: '0031/B01037',
  kind: 'character',
  names: ['服部静華'],
  colors: ['緑'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013001022129.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/22-qa-action-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
  ],
};
