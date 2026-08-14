// cards/ct-p03/B03034 稲尾一久 (キャラ) — カットイン実装 (BUG-114, 2026-06-07)
// rules: 09-cutin-disguise.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト(カットイン): 【カットイン】AP＋1000、相手の現場にいるコンタクト中のキャラを1枚まで選び、
//   相手のデッキのカードを上から1枚裏向きでセットする（コンタクト中に手札からリムーブして使う）
//
// sequence: AP+1000 (必須) → コンタクト相手を0〜1枚選び、相手デッキ上端を裏向きセット。
import type { CardDef, AbilityDef } from '@/engine/types';

const cutin: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  description:
    '【カットイン】AP＋1000、相手の現場にいるコンタクト中のキャラを1枚まで選び、相手のデッキのカードを上から1枚裏向きでセットする',
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: { player: 'opp', fromDeckTop: true, faceUp: false, max: 1, inContact: true },
      },
    ],
  },
};

export const B03034: CardDef = {
  id: 'B03034',
  no: '0291/B03034',
  kind: 'character',
  names: ['稲尾一久'],
  colors: ['緑'],
  level: 3,
  ap: 3000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249309915.jpg',
  abilities: [cutin],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
