// cards/ct-d04/D04005 世良真純 (キャラ) — engine拡張 wave#2 cluster3 (action-lifecycle trigger 族)
// rules: 05-turn-phases.md, 07-action-flow.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   自分の現場にいるキャラがアクション［事件］したとき、ターン終了時までこのキャラは〚突撃〛
//     （登場したターンからすぐにアクションできる）を持つ。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   「自分の現場にいるキャラが」     → matcherCondition triggerCharMatches{side:'self', filter:{}}
//                                       (filter:{} は scene 走査でパートナーを除外 = 現場在場キャラのみ。DSL罠順守)
//   「アクション［事件］したとき」    → trigger hook 'action:declare' + triggerActionKind{v:'case'}
//                                       (qAndA: アクション宣言・事件指定・スリープ時点で発動 = ガード判定前 → declare hook が正)
//   「ターン終了時までこのキャラは〚突撃〛を持つ」
//                                       → charGrantKeyword{uid:'$self', kw:'突撃', scope:'turn'}
//                                          (charGrantKeyword は scope:'action' 禁止のため turn を使う。DSL罠順守)
//   限定無し (【ターン1】等なし) = 毎回発動。突撃の重複 grant は無害 (grantKeyword は冪等)。ミスリード無し。
//
// a1: 「自分の現場のキャラがアクション［事件］したとき」自身に〚突撃〛(ターン終了まで) 付与。
//   非 selfOnly (トリガキャラ ≠ このキャラ。同名複数も同様に each で自分自身へ付与)。
//   matcherCondition = and[triggerActionKind case, triggerCharMatches self filter:{}] (D11015 a1 / B04039 a1 合成)。
// a2: 【ヒラメキ】カードを1枚引く (D01003 a2 同型 hirameki draw)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分の現場にいるキャラがアクション［事件］したとき (宣言時点 = ガード判定前。rules/22 + qAndA)
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'and',
      cs: [
        // アクション［事件］ (target.kind === 'case')
        { kind: 'triggerActionKind', v: 'case' },
        // 自分側の「現場にいるキャラ」(filter:{} = scene 走査でパートナー除外)
        { kind: 'triggerCharMatches', side: 'self', filter: {} },
      ],
    },
  },
  // ターン終了時までこのキャラは〚突撃〛を持つ
  effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
  description: '自分の現場のキャラがアクション［事件］したとき、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const D04005: CardDef = {
  id: 'D04005',
  no: '0136/D04005',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['探偵', '高校生', '赤井家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132388746.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};