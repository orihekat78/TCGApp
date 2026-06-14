// cards/ct-p01/B01036 遠山銀司郎 (キャラ) — engine拡張 wave#2 cluster3 (action-lifecycle trigger)
// rules: 07-action-flow.md, 22-qa-action-contact.md, 15-abilities-effects.md, 17-icons.md, 03-field-areas.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいる【緑】のキャラがアクション［キャラ］したとき、キャラを1枚まで選び、スリープさせる。
//
// 句マッピング:
//   「【ターン1】」                       → limit: { kind: 'turn', n: 1 } (ability.id 単位 declaredUseCount)
//   「アクション［キャラ］したとき」       → trigger.hook 'action:declare' + matcherCondition triggerActionKind v:'char'
//                                            (qAndA: 宣言し対象を指定しアクションするキャラをスリープさせた時点で発動。
//                                             = ガード判定前。X14/X16 で全経路成立済)
//   「自分の現場にいる【緑】のキャラが」   → matcherCondition triggerCharMatches side:'self' filter:{color:'緑'}
//                                            (selfOnly ではない。自分側の緑キャラ全般 — B01036 自身も該当)
//   「キャラを1枚まで選び、スリープさせる」 → sceneSetState{player:'self', state:'sleep', max:1}
//                                            (短縮形 side 既定='either' = どちらの現場のキャラでも選べる rules/15。
//                                             max:1 ⇒ 0枚可。0枚でも能力発動済で【ターン1】消費 qAndA)
//
// エッジ / 罠:
//   - rules/15: エリア指定なしの「キャラ」= どちらの現場のキャラも選択可 → side:'either' (短縮形既定) で正。
//   - triggerCharMatches は filter 省略でパートナーの行動も通すため filter:{color:'緑'} を明示 (パートナー除外)。
//   - スタン状態のキャラを選んでスリープ効果を受けても、状態はスタンのまま (rules/03。engine 既定挙動)。
//   - 0枚を選んでも【ターン1】は消費され同ターン再発動不可 (qAndA。limit を発火時に消費する engine 既定挙動)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'action:declare',
    // 自分の現場の【緑】キャラがアクション［キャラ］したとき (= ［キャラ］対象 gate × 自分側緑キャラ gate)
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerActionKind', v: 'char' },
        { kind: 'triggerCharMatches', side: 'self', filter: { color: '緑' } },
      ],
    },
  },
  // キャラを1枚まで選び、スリープさせる (max:1 = 0枚可。side 既定 'either' = 両現場対象 rules/15)
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', state: 'sleep', max: 1 } },
  description: '【ターン1】自分の現場の【緑】キャラがアクション［キャラ］したとき、キャラを1枚まで選びスリープさせる。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/03-field-areas.md'],
};

export const B01036: CardDef = {
  id: 'B01036',
  no: '0030/B01036',
  kind: 'character',
  names: ['遠山銀司郎'],
  colors: ['緑'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013001019763.jpg',
  abilities: [a1],
  ruleRefs: ['rules/07-action-flow.md', 'rules/22-qa-action-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/03-field-areas.md'],
};
