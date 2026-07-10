// cards/ct-p02/B02084 安室の愛車 (event) — engine additive A2 exemplar (on-set-self setcard:leave observer, 2026-07-11)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   このイベントを自分の現場にいるレベル6以上のキャラ1枚にセットする。セットした場合、レベル6以下のキャラを
//     1枚まで選び、リムーブする。
//   【相手ターン中】キャラにセットされていたこのイベントがリムーブエリアに置かれたとき、自分のリムーブエリアにある
//     レベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、手札に加える。
// 公式Q&A:
//   - 現場にキャラ0枚でも使用可 (セット不能なら解決後リムーブエリアへ、「レベル6以下リムーブ」は解決できない)。
//   - a2 発動 = セットされていたこのイベントが効果でリムーブ / セット先が現場を離れて、このイベントがリムーブ
//     エリアに置かれたとき。
//   - 裏向きでセットされていたカードをリムーブしても (情報を持たないので)【相手ターン中】能力は発動しない。
//
// 句マッピング:
//   a1 = effect:declared (event-use) → chain[charSetCard{fromSelf, n:1, filter:{levelMin:6, kind:'character'}}
//        (「レベル6以上のキャラ1枚にセット」B01057 fromSelf 同型), sceneRemove{max:1, side:'either', filter:{levelMax:6}}
//        (「セットした場合、レベル6以下を1枚まで選びリムーブ」= chain gate=charSetCard の chainStepNoApply)]。
//   a2 = on-set-self triggered setcard:leave (本 wave: セットカード自身が remove 到達したときの自己反応 =
//        handleSetcardLeaveSelf。faceUp のみ発火 = 裏向き不発 Q&A 成立) + condition turn:opp (【相手ターン中】)
//        → handAddFromRemove{max:1, filter:{levelMax:5, trait:'警察', kind:'character'}} (「自分のリムーブエリアの
//        レベル5以下[警察]を1枚まで手札に」D06003 handAddFromRemove 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'chain',
    steps: [
      // このイベントを自分の現場にいるレベル6以上のキャラ1枚にセットする (fromSelf = 使用イベント自身を faceUp セット)
      { kind: 'atom', verb: 'charSetCard', args: { player: 'self', fromSelf: true, n: 1, filter: { levelMin: 6, kind: 'character' } } },
      // セットした場合、レベル6以下のキャラを1枚まで選び、リムーブする (chain gate = 上の charSetCard 成立時のみ)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 6, kind: 'character' } } },
    ],
  },
  description:
    'このイベントを自分の現場にいるレベル6以上のキャラ1枚にセットする。セットした場合、レベル6以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

// a2 (on-set-self): 「キャラにセットされていたこのイベントがリムーブエリアに置かれたとき」自身の反応。
const a2: AbilityDef = {
  id: 'b02084_set_self_leave',
  type: 'triggered',
  scope: 'on-set-self',
  trigger: { hook: 'setcard:leave' }, // handleSetcardLeaveSelf が faceUp のみ発火 (裏向き不発 Q&A)
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    // 自分のリムーブエリアにあるレベル5以下の〚特徴[警察]〛のキャラを1枚まで選び、手札に加える (max:1=0可)
    args: { player: 'self', max: 1, filter: { levelMax: 5, trait: '警察', kind: 'character' } },
  },
  description:
    '【相手ターン中】キャラにセットされていたこのイベントがリムーブエリアに置かれたとき、自分のリムーブエリアにあるレベル5以下の〚特徴［警察］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/16-card-set.md', 'rules/17-icons.md'],
};

export const B02084: CardDef = {
  id: 'B02084',
  no: '0245/B02084',
  kind: 'event',
  names: ['安室の愛車'],
  colors: ['黄'],
  level: 5,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357284553314.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
