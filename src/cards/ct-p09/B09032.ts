// cards/ct-p09/B09032 溝端理子 (キャラ) — Task D batch (2026-06-12)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【宣言】【スリープ】〚デッキの下に移す〛：自分の現場にいるこのキャラ以外のレベル6以下のキャラを
//   1枚まで選び、ターン終了時まで〚突撃〛（名乗り状態でもアクションできる）と
//   「ターン終了時、このキャラをリムーブする。」を与える。
//
// 句マッピング:
//   【宣言】= declared / 【スリープ】〚デッキの下に移す〛= cost pay[sleepSelf, selfToDeckBottom]
//     (rules/21: コスト全部実行。selfToDeckBottom は B03011 同型)
//   「自分の現場にいるこのキャラ以外のレベル6以下のキャラを1枚まで選び」+「〚突撃〛…を与え」=
//     charGrantKeyword **短縮形 carrier** (Task D E0 addendum) + bind:'$picked'。
//     ⚠ 明示 uid:'$pick'+target carrier は human 経路で後続 step の bind 喪失 (敵対レビュー vitest 実証)
//     → 短縮形 (runtime push → continuation ctx 共有) が必須。
//     「このキャラ以外」(excludeSelf) は cost selfToDeckBottom で自身が場を離れた後に候補列挙する
//     ため vacuous (短縮形が excludeSelf を運べない制約とも整合)。
//   「『ターン終了時、このキャラをリムーブする。』を与える」= charSetTurnEffect
//     {uid:'$picked.uid', key:'removeOnTurnEnd'} — endTurn consume (Task D E4) が
//     removeToRemove (=【現場リムーブ時】発動 rules/17)。
//   公式Q&A: 変装で引継ぎ (turnEffects 自動 rules/23) / 現場を離れたら失効 (char object ごと消滅) — 両方 engine 挙動と一致

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【スリープ】〚デッキの下に移す〛(コスト: 自身をスリープ + 自身をデッキの下へ)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'selfToDeckBottom' }] },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいるレベル6以下のキャラを1枚まで選び、ターン終了時まで〚突撃〛を与え
      // (短縮形 carrier + bind:'$picked'。自身はコストで場外のため「このキャラ以外」は自動成立)
      { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', max: 1, side: 'self', filter: { levelMax: 6 }, kw: '突撃', scope: 'turn', bind: '$picked' } },
      // 「ターン終了時、このキャラをリムーブする。」を与える (endTurn consume → removeToRemove)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'removeOnTurnEnd', val: true } },
    ],
  },
  description:
    '【宣言】【スリープ】〚デッキの下に移す〛：自分の現場にいるこのキャラ以外のレベル6以下のキャラを1枚まで選び、ターン終了時まで〚突撃〛と「ターン終了時、このキャラをリムーブする。」を与える。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md', 'rules/23-qa-disguise-cutin.md'],
};

export const B09032: CardDef = {
  id: 'B09032',
  no: '0976/B09032',
  kind: 'character',
  names: ['溝端理子'],
  colors: ['緑'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608835839091.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
