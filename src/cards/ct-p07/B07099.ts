// cards/ct-p07/B07099 板倉卓 (character) — DEFER解禁 (self-remove observer + evidence-flip-down, engine変更0)
// rules: 03-field-areas.md, 10-action-event.md, 11-reasoning.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、
//     表向きの証拠を1つまで選び、裏向きにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）表向きの証拠を1つまで選び、裏向きにする。
//   Q&A: 「自分の能力や効果によってリムーブされる」= 自分が持ち主であるキャラの能力／イベントの効果による除去。
//        「自分の能力や効果によってリムーブされたとき」はスイッチによるリムーブでは発動しない。
//
// 句マッピング:
//   a1 = 【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、
//        表向きの証拠を1つまで選び、裏向きにする。
//     - 【パートナー黒】【自分ターン中】 => condition and[partnerColor 黒, turn self] (rules/17)。B03116 a1 と完全同型。
//     - 自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき
//         => trigger { hook:'leave:to-remove', selfOnly:true (「このキャラ」= 除去された当人),
//                      matcherCondition removedCharMatches{cause:'effect', byPlayer:'self'} }
//            cause:'effect' =「能力や効果によって」(スイッチ非発火 = cause gate、Q&A / rules/13) /
//            byPlayer:'self' =「自分の」効果 owner 帰属 (attribution mini-wave, cond/eval.ts:731)。
//            exemplar: src/cards/ct-p03/B03116.ts a1 (trigger 句が逐語一致)。
//     - 表向きの証拠を1つまで選び、裏向きにする
//         => atom evidenceFlipDown 短縮形 { player:'self', max:1, faceUp:true }。
//            「〜1つまで」= n.min:0 (0枚可、rules/15) / faceUp:true = 表向き証拠のみ候補 (candidates.ts honor)。
//            印字は「自分の」省略だが、裏向きにする(=再秘匿)操作は corpus 全 evidence-flip-down カードが「自分の」に限り、
//            相手証拠への操作は「相手の証拠を表向きにする」(公開) のみ存在し裏向き化は無い。engine 既定 side/flipP=self とも整合。
//            ゆえに「表向きの証拠」= 自分の表向き証拠 (rules/11 証拠エリアは所有者別、再秘匿は自陣に対する防御的操作)。
//            exemplar: src/cards/ct-p05/B05013.ts a2 (evidenceFlipDown 短縮形 self、逐語同型)。
//   a2 = 【ヒラメキ】（証拠からリムーブされるときに発動する）表向きの証拠を1つまで選び、裏向きにする。
//     => triggered { scope:'on-evidence', trigger:{ hook:'evidence:remove-by-action', optional:true } } +
//        atom evidenceFlipDown 短縮形 { player:'self', max:1, faceUp:true }。B05013 a2 と完全同型。
//        ヒラメキ発動条件 = アクション[事件]による証拠リムーブ時のみ (rules/10)。「1つまで」= optional の重ね無し(pick n.min:0)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー黒】【自分ターン中】(state gate、rules/17)
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'turn', player: 'self' },
    ],
  },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true, // 「自分の現場にいるこのキャラが」= 除去された当人
    // 「自分の能力や効果によって」= cause:'effect' + 効果 owner 'self' 帰属 (スイッチ非発火は cause gate)
    matcherCondition: { kind: 'removedCharMatches', cause: 'effect', byPlayer: 'self' },
  },
  // 表向きの証拠を1つまで選び、裏向きにする (自分の表向き証拠、0〜1「まで」)
  effect: { kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } },
  description:
    '【パートナー黒】【自分ターン中】自分の現場にいるこのキャラが自分の能力や効果によってリムーブされたとき、表向きの証拠を1つまで選び、裏向きにする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】(任意発動、アクション[事件]リムーブ時)
  // 表向きの証拠を1つまで選び、裏向きにする
  effect: { kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）表向きの証拠を1つまで選び、裏向きにする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B07099: CardDef = {
  id: 'B07099',
  no: '0826/B07099',
  kind: 'character',
  names: ['板倉卓'],
  colors: ['黒'],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: ['CGクリエイター', 'システムエンジニア'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414041024843.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
