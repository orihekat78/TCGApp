// cards/ct-p02/B02073 上原由衣 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【スリープ】〚リムーブエリアに移す〛：〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚迅速〛（登場したターンからすぐに推理かアクションできる）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【宣言】 => ability.type 'declared' [src/cards/ct-p06/B06060.ts a1 type 'declared' scope 'on-scene'; src/cards/ct-p03/B03055.ts identical declared shape. 宣言能力 = declared per brief DSL conventions.]
//   - 【スリープ】〚リムーブエリアに移す〛 (cost) => cost: pay[ {kind 'sleepSelf'}, {kind 'removeFromScene', target:{kind 'self'}, n:1} ] [src/cards/ct-p03/B03055.ts a1 cost VERBATIM: pay[sleepSelf, removeFromScene{target:{kind 'self'},n:1}] for the same '【スリープ】〚リムーブエリアに移す〛' text. removeFromScene with target self = move-self-to-remove-area (rules/21 対象省略=自身). Cost honored: evaluate.ts:63 canPay removeFromScene, pay.ts:87 mutate.scene.removeToRemove(cand.uid,'cost'). sleepSelf canPay requires active (evaluate.ts:28).]
//   - 〚特徴［長野県警］〛のキャラを1枚まで選び => target pick query area:'scene' side:'either' filter:{trait:'長野県警'} n:{min:0,max:1} [src/cards/ct-p06/B06060.ts a1 effect option target = {kind 'pick', query:{area:'scene', side:'either', filter:{trait:'YAIBA'}}, n:{min:0,max:1}, chooser:'self'} for the same unqualified 'のキャラ' phrasing. Unqualified 'キャラ' (no 自分の/相手の) => both scenes selectable (rules/15) => side:'either'. trait filter honored via TargetFilter.trait (effect.ts). '1枚まで' => n.min:0 (0-pick OK, rules/15).]
//   - ターン終了時まで〚迅速〛（…）を与える => atom charGrantKeyword {uid:'$pick', kw:'迅速', scope 'turn', target:<pick>} [src/cards/ct-p06/B06060.ts a1 charGrantKeyword {uid:'$pick', kw:'突撃', scope 'turn', target:<pick>} — same terminal single-atom grant (迅速 swapped for 突撃). Handler src/engine/effect/atom-handlers/char.ts:99 atomCharGrantKeyword honors scope 'turn' -> mutate.char.grantKeyword(grantUid,kw,'turn') -> turnEffects['grantedKeywords'] (mutate/char.ts:86-97). read/char.ts:192-195 merges turnGranted so 迅速 effective. Turn-end cleanup wired: flow/turn.ts:90-97 clearTurnEffects(uid,'turn') for both players' scene chars (BUG-092 fixed) -> 迅速 removed at end of turn. parenthetical reminder text = no extra mechanics.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => ability a2 type 'triggered' scope 'on-evidence' trigger {hook 'evidence:remove-by-action', optional:true} effect: atom draw {player:'self', n:1} [src/cards/ct-d01/D01003.ts a2 VERBATIM same ヒラメキ draw-1 shape. Hook evidence:remove-by-action emitted at flow/action-case.ts:44 (アクション[事件] リムーブ窓); listener src/engine/listeners/hirameki.ts + triggered.ts:393/444 dispatch; optional:true => 任意発動 (rules/10). draw atom honored (ATOM_VERB_MAP).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'removeFromScene',
        target: {
          kind: 'self'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$pick',
      kw: '迅速',
      scope: 'turn',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either',
          filter: {
            trait: '長野県警'
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
  description: '【宣言】【スリープ】〚リムーブエリアに移す〛：〚特徴［長野県警］〛のキャラを1枚まで選び、ターン終了時まで〚迅速〛（登場したターンからすぐに推理かアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
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

export const B02073: CardDef = {
  id: 'B02073',
  no: '0234/B02073',
  kind: 'character',
  names: [
    '上原由衣'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'R',
  imageUrl: '1721357267374310.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
