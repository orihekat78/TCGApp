// cards/ct-p02/B02023 遠山和葉 (キャラ) — engine-extension #5b 残課題: PA短縮形 (uid pick + fromDeckTop)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
//   【宣言】【ターン1】〚現場にいるキャラに裏向きでセットされているカードを1枚リムーブする〛：
//     キャラを1枚まで選び、スリープさせる。
//
// a1: enter selfOnly + PA短縮形 (uid pick from self.scene, fromDeckTop) で自陣に裏向きセット
// a2: DEFERRED (cost が「セットされているカードを1枚リムーブ」= set-card source の pick が
//     既存 cost system 未対応 — replace/cost 系で別途検討)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 自分の現場のキャラを 1 枚まで選び、自分のデッキ上端を裏向きでセット
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', max: 1, side: 'self', fromDeckTop: true, faceUp: false },
  },
  description: '【登場時】自分の現場のキャラを1枚まで選び、デッキ上端を裏向きでセット。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】キャラを1枚まで選びスリープ (BUG-140 補修 2026-06-13) — D05007 a2 同型
// (明示 $pick+target: hirameki fire は hiramekiResolve が chooseAtomTarget で auto-resolve するため短縮形不可)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B02023: CardDef = {
  id: 'B02023',
  no: '0193/B02023',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1721357188642110.jpg',
  // a2 (cost=set-card 1リム + キャラ1枚スリープ) は cost system 拡張要のため DEFER
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
