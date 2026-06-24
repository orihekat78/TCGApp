// cards/pr-01/PR094 赤井秀一 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md
// 公式テキスト:
//   【登場時】手札からレベル4以下の【赤】のキャラを1枚スリープ状態で登場させてもよい。登場させなかった場合、相手に証拠を1つ与え、カードを1枚引く。
// 句マッピング:
//   - 【登場時】 => a1: type 'triggered', scope 'on-scene', trigger {hook 'enter', selfOnly:true} [VERBATIM in src/cards/ct-d05/D05006.ts a1 / ct-p02/B02038.ts a2 / ct-d09/D09020.ts a1 (all 【登場時】 self-enter). BUG-146: enter emit source=登場キャラ なので selfOnly が自カード登場に一致 (scene.ts:208 emit; listeners/triggered.ts selfOnlyMatches).]
//   - 手札からレベル4以下の【赤】のキャラを1枚スリープ状態で登場させてもよい => a1.steps[0]: atom sceneEnter {player:'self', cardId:'$pick.cardId', from:'hand', viaEffect:true, enterSleep:true, bind:'$matched', target:{pick, area:'hand', side:'self', filter:{color:'赤', levelMax:4, kind 'character'}, n:{min:0,max:1}, chooser:'self'}} [hand-enter+bind form VERBATIM in src/cards/ct-d09/D09020.ts a1 hand-option (cardId:'$pick.cardId', from:'hand', viaEffect:true, bind:'$matched', target area:'hand' side:'self' filter+kind 'character', n{0..1}) と src/cards/ct-d07/D07008.ts a1. enterSleep:true=スリープ状態で登場 (scene.ts:177 active=false→state 'sleep'). filter color/levelMax/kind honored by matchOneFilter (printed-static, candidates.ts). kind 'character' per BUG-123 (テキスト「キャラ」, イベント除外). 「してもよい」=n.min:0 (0-pick=辞退, rules/15) — pick が optional 性を担う (B02083 note の選択モデルと整合). hand-source splice scene.ts:159-163. 現場5枚はswitchEnter自動 (scene.ts:181, q&A 整合).]
//   - 登場させなかった場合 => a1.steps[1]: conditional if:not(bound{key:'$matched', presence:'matched'}) [src/cards/ct-d05/D05007.ts a1 が同型「1枚まで登場 → conditional if:bound{key:'$matched',presence:'matched'} then:登場処理」で『登場した場合』を判定。本カードは負側なので not() で包む (cond/eval.ts:184-191 bound presence:'matched'→bound array length>0). bind 書戻しは実際の enter 時のみ (scene.ts:198-203, cardId 解決ブロック内; 0-pick decline では cardId 空→未書込, D09020 note『0枚 enter 時は $matched 未書込』で実証) → not(bound)=登場しなかった と厳密一致. not combinator + conditional then-only は resolver.ts:134-141 (else 省略可).]
//   - 相手に証拠を1つ与え => a1.steps[1].then.steps[0]: atom evidenceGain {player:'opp', n:1} [atom-handlers/core.ts:175-198 atomEvidenceGain は resolvePlayer(a.player) で scope 決定 (hardcode なし) → 'opp' で相手が証拠獲得. 『〜与え』=する=必須 → bare atom (optional なし, q&A『省略不可』). evidenceGain{player,n} 形 VERBATIM in src/cards/ct-d04/D04007.ts a2 / ct-d09/D09010.ts (player:'self' 版だが arg 形同一). deck0→refresh→remove0 敗北 loop は core.ts:181-196 で自動.]
//   - カードを1枚引く => a1.steps[1].then.steps[1]: atom draw {player:'self', n:1} [draw{player:'self', n:1} VERBATIM in src/cards/ct-p02/B02038.ts a1 / ct-p03/B03026.ts a1 / dozens. 『引く』=する=必須 bare atom. q&A『ドロー1 省略不可』→ then branch mandatory (optional 包まない).]

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'hand',
          viaEffect: true,
          enterSleep: true,
          bind: '$matched',
          target: {
            kind: 'pick',
            query: {
              area: 'hand',
              side: 'self',
              filter: {
                color: '赤',
                levelMax: 4,
                kind: 'character'
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
        kind: 'conditional',
        if: {
          kind: 'not',
          c: {
            kind: 'bound',
            key: '$matched',
            presence: 'matched'
          }
        },
        then: {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'evidenceGain',
              args: {
                player: 'opp',
                n: 1
              }
            },
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            }
          ]
        }
      }
    ]
  },
  description: '【登場時】手札からレベル4以下の【赤】のキャラを1枚スリープ状態で登場させてもよい。登場させなかった場合、相手に証拠を1つ与え、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

export const PR094: CardDef = {
  id: 'PR094',
  no: '0322/PR094',
  kind: 'character',
  names: [
    '赤井秀一'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    'FBI',
    '赤井家'
  ],
  rarity: 'PR',
  imageUrl: '1954247ced83d5.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ],
};
