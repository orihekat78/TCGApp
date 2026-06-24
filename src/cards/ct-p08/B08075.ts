// cards/ct-p08/B08075 ブライダルは女が主役 (event) — Task A green候補 (engine変更0, 手書き)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md,
//        rules/20-color-and-switch.md, rules/14-refresh.md, rules/26-qa-deck-refresh.md, rules/03-field-areas.md
// 公式テキスト:
//   以下から3つまで選んで行う。（上から順に行う）
//   ・自分の現場にいる〚カード名［佐藤美和子］〛を1枚まで選び、アクティブにする。
//   ・自分の現場にいる〚カード名［高木渉］〛を1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。
//   ・自分のデッキのカードを上から4枚見る。その中から〚カード名［佐藤美和子］〛か〚［高木渉］〛を1枚まで公開して手札に加え、
//     残りを好きな順番でデッキの下に移す。
// 句マッピング:
//   - イベント使用 = type:'triggered' scope:'on-hand' trigger{hook:'effect:declared', selfOnly:true,
//     matcher:(p)=>p.kind==='event-use'} [exemplar B08029/B02053: イベント自己使用 trigger の標準形]
//   - 「以下から3つまで選んで行う（上から順に）」= sequence の各 option を {kind:'optional'} で包む。
//     '上から順' = sequence 順序保持 / '3つまで選んで' = 各 option を engage するか選べる (optional) /
//     '1つの選択肢は1回まで' = sequence は各 step 1 回 [optional exemplar B09065 a1]。
//     ※ 3つ目 (deck reveal→bottom) は take-0 でも deck 並び替えの副作用があるため、選択肢ごと skip 可能にする
//        optional 包装が必須 (declined 時 deck 不変を担保)。
//   - opt1「[佐藤美和子]1枚まで選びアクティブに」= sceneSetState {uid:'$pick', state:'active',
//     target pick scene/self cardName 佐藤美和子 n:{0,1}} ['1枚まで'=0可 rules/15。exemplar B06060/D04010 sceneSetState+$pick]
//   - opt2「[高木渉]1枚まで選びターン終了まで突撃[キャラ]付与」= charGrantKeyword {uid:'$pick', kw:'突撃[キャラ]',
//     scope:'turn', target pick scene/self cardName 高木渉 n:{0,1}} [exemplar D02013 charGrantKeyword+$pick / 突撃[キャラ] D09027/D11015]
//   - opt3「デッキ上4枚見て[佐藤美和子]か[高木渉]を1枚まで公開手札, 残りデッキ下」=
//     deckRevealUntil {chooseMatch:'upTo'(=1枚まで, 0可), filterAny:[佐藤美和子, 高木渉]各 kind:'character', maxN:4,
//       bind:'$revealed', bindMatch:'$matched'} → conditional(bound $matched matched → handAddFromDeck $matched.cardId)
//       → deckToBottomBound $revealed [exemplar B08020 a1 (deckRevealUntil upTo + handAddFromDeck + deckToBottomBound) /
//       filterAny cross-name B03016/B07020]。reveal 中は deck 扱い, handAdd 時点で deck0 ならリフレッシュ (rules/26)。

import type { AbilityDef, CardDef, Effect } from '@/engine/types';

// option 毎に新規 object を生成 (effect tree 内の共有参照を避ける — walk/Immer 安全)
const opt1 = (): Effect => ({
  kind: 'optional',
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'active',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '佐藤美和子' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
});

const opt2 = (): Effect => ({
  kind: 'optional',
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$pick',
      kw: '突撃[キャラ]',
      scope: 'turn',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '高木渉' } }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
});

const opt3 = (): Effect => ({
  kind: 'optional',
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filterAny: [
            { cardName: '佐藤美和子', kind: 'character' },
            { cardName: '高木渉', kind: 'character' },
          ],
          maxN: 4,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
});

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'sequence', steps: [opt1(), opt2(), opt3()] },
  description:
    '以下から3つまで選んで行う。（上から順に行う）・〚カード名［佐藤美和子］〛を1枚まで選びアクティブに。・〚カード名［高木渉］〛を1枚まで選びターン終了まで〚突撃［キャラ］〛付与。・デッキ上4枚を見て〚佐藤美和子］か〚高木渉］を1枚まで手札に加え、残りをデッキの下に移す。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B08075: CardDef = {
  id: 'B08075',
  no: '0912/B08075',
  kind: 'event',
  names: ['ブライダルは女が主役'],
  colors: ['黄'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1770731255782822.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
