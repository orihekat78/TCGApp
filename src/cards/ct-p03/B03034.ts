// cards/ct-p03/B03034 稲尾一久 (キャラ) — カットイン実装 (BUG-114, 2026-06-07)
// rules: 09-cutin-disguise.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト(カットイン): 【カットイン】AP＋1000、相手の現場にいるコンタクト中のキャラを1枚まで選び、
//   相手のデッキのカードを上から1枚裏向きでセットする（コンタクト中に手札からリムーブして使う）
//
// engine変更0 で実装可能 (BUG-114 の「verb 不在」は stale):
//   - $contact.targetUid (BUG-104) = コンタクト中の相手キャラ (ガード時はガードキャラ)。
//   - charSetCard{player:'opp', fromDeckTop:true, faceUp:false} = 相手デッキ上端を相手キャラに裏向きセット
//     (atom-handlers:880-900、deck-source/対象 side とも 'opp')。
// sequence: AP+1000 (常時) → 相手キャラへセット (targetUid 不在 = 相手キャラ無 → silent no-op = 「1枚まで」の 0 枚)。
// ※「1枚まで選び」の任意 skip (相手キャラが居るのに敢えてセットしない) は engine 表現外のため常時セット
//   (相手キャラ不在時は no-op)。微小な近似 (mild disruption ゆえ実プレイ影響は無視可能)。
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
      { kind: 'atom', verb: 'charSetCard', args: { player: 'opp', uid: '$contact.targetUid', fromDeckTop: true, faceUp: false } },
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
