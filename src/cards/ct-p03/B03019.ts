// cards/ct-p03/B03019 フサエ・キャンベル (character) — wave leave-reveal-until (engine変更0)
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 17-icons.md, 26-qa-deck-refresh.md
// 公式テキスト:
//   a1 【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［阿笠博士］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
//   a2 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - a1 = B05021 a1 と同型 (leave:to-remove selfOnly + turn:opp + deckRevealUntil{cardName:'阿笠博士'} → handAddFromDeck → deckToBottomBound → deckShuffle)。exemplar B06053 a1 / D05007 a1。
//   - a2 【ヒラメキ】カードを1枚引く => triggered, scope:'on-evidence', trigger{hook:'evidence:remove-by-action', optional:true}, atom draw{player:'self', n:1}
//       [ヒラメキ = evidence:remove-by-action hook、optional:true で fire/skip side-channel。exemplar D01013 a (同句 verbatim)]
//   - 阿笠博士 は登録済 CardDef 名 → match live。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { player: 'self', filter: { cardName: '阿笠博士' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から〚カード名［阿笠博士］〛が出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03019: CardDef = {
  id: 'B03019',
  no: '0277/B03019',
  kind: 'character',
  names: ['フサエ・キャンベル'],
  colors: ['青'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['デザイナー'],
  rarity: 'C',
  imageUrl: '1729133201237315.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
