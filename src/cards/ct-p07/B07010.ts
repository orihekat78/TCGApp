// cards/ct-p07/B07010 円谷光彦 (character) — wave reveal-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p07/character.tsv col11):
//   【登場時】自分のデッキのカードを上から2枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。
//   【宣言】【スリープ】：〚特徴［少年探偵団］〛のキャラを1枚まで選び、ターン終了時までAP＋3000する。
//
// 句マッピング (exemplar = B05016 a1 (deck-look maxN→hand→boundToRemove) / D11014 a1 (charModifyAP 短縮形)):
//   a1【登場時】:
//   - 上から2枚見る + 〚特徴[少年探偵団]〛キャラ1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:2, filter:{trait:'少年探偵団', kind:'character'}} → cond($matched) handAddFromDeck
//       ※「1枚まで」=chooseMatch:'upTo' (0枚可、加えない選択可、QA確認)。「のキャラ」= kind:'character'。
//   - 残りをリムーブエリアに移す => boundToRemove{$revealed} (移送完了後 deck0 で refresh、rules/26)
//   - カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする
//       => conditional{and:[bound $matched matched, caseStatus:解決編]} → discard{n:1}
//       ※ QA「加えなかった場合は(解決編でも)リムーブしない」→ 両成立 AND を conditional 内側に置き over-fire 防止 (B07086 教訓)。
//   a2【宣言】【スリープ】:
//   - cost【スリープ】= sleepSelf (active 時のみ payable、sleep/stun 不可、rules/21)
//   - 〚特徴[少年探偵団]〛キャラ1枚まで選び、ターン終了時までAP+3000
//       => charModifyAP{delta:3000, max:1, side:'either', filter:{trait:'少年探偵団'}, scope:'turn'}
//       ※「1枚まで」=max:1(min省略=0)、「のキャラ」=side:'either'(どちらの現場も、rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 2,
          filter: { trait: '少年探偵団', kind: 'character' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', deferRefresh: true } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
      {
        kind: 'conditional',
        if: {
          kind: 'and',
          cs: [
            { kind: 'bound', key: '$matched', presence: 'matched' },
            { kind: 'caseStatus', status: '解決編' },
          ],
        },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から2枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 3000, max: 1, side: 'either', filter: { trait: '少年探偵団' }, scope: 'turn' } },
  description: '【宣言】【スリープ】：〚特徴［少年探偵団］〛のキャラを1枚まで選び、ターン終了時までAP＋3000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B07010: CardDef = {
  id: 'B07010',
  no: '0742/B07010',
  kind: 'character',
  names: ['円谷光彦'],
  colors: ['青'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413976095555.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
