// cards/pr-01/PR049 黒羽盗一 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md
// 公式テキスト:
//   【登場時】自分の現場にいる⁅白⁆のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットし、ターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【登場時】 => type:'triggered', scope:'on-scene', trigger:{hook:'enter', selfOnly:true} [enter hook (capability-map: enter = 登場時, selfOnly via source.uid); exemplar src/cards/ct-p02/B02046.ts a1 (identical card text)]
//   - 自分の現場にいる⁅白⁆のキャラを1枚まで選び => charSetCard pick target {area:'scene', side:'self', filter:{color:'白'}, n:{min:0,max:1}, chooser:'self'} [TargetFilter.color membership-OR (capability-map F); n.min:0 = 0-pick legal '〜まで'; exemplar B02046.ts a1 query]
//   - 自分のデッキのカードを上から1枚裏向きでセットし => atom charSetCard {uid:'$pick', fromDeckTop:true, faceUp:false, player:'self', bind:'$picked'} [charSetCard fromDeckTop shifts deck top, faceUp:false = 裏向きセット (capability-map: charSetCard, src/engine/effect/atom-handlers.ts case 'charSetCard'); bind writeback at atom-handlers.ts:238-247 (BUG-130 Task D E0); exemplar B02046.ts a1]
//   - ターン終了時までAP＋1000する => atom charModifyAP {uid:'$picked.uid', delta:1000, scope:'turn'} [charModifyAP scope:'turn' = ターン終了まで (capability-map: charModifyAP, turnEffects apMod_turn); uid:'$picked.uid' resolves SAME picked char via resolveBindRef (atom-handlers.ts:135-173); exemplar B02046.ts a1 step2 (BUG-130 fixed '$pick'→'$picked.uid')]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action', optional:true}, effect:atom draw {player:'self', n:1} [evidence:remove-by-action hook = ヒラメキ (capability-map hooks; handleEvidenceRemovedHook); optional:true = fire/skip side-channel; exemplar src/cards/ct-d08/D08013.ts a2 (identical hirameki text)]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'charSetCard',
            args: {
              uid: '$pick',
              fromDeckTop: true,
              faceUp: false,
              player: 'self',
              bind: '$picked',
              target: {
                kind: 'pick',
                query: {
                  area: 'scene',
                  side: 'self',
                  filter: {
                    color: '白'
                  }
                },
                n: {
                  min: 0,
                  max: 1
                },
                chooser: 'self'
              }
            }
          },
          {
            kind: 'atom',
            verb: 'charModifyAP',
            args: {
              uid: '$picked.uid',
              delta: 1000,
              scope: 'turn'
            }
          }
        ]
      }
    ]
  },
  description: '【登場時】自分の現場にいる⁅白⁆のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットし、ターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const PR049: CardDef = {
  id: 'PR049',
  no: '0212/PR049',
  kind: 'character',
  names: [
    '黒羽盗一'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    'マジシャン'
  ],
  rarity: 'PR',
  imageUrl: '19304c0ead48f.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ],
};
