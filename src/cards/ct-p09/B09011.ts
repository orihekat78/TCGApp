// cards/ct-p09/B09011 灰原哀 (character) — Cluster WB1 exemplar (TargetFilter baseLp 「元のLP」軸)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【ターン1】自分の現場にいる元のLPが0でレベル4の〚特徴［少年探偵団］〛のすべてのキャラを、ターン終了時まで元のLPを1にする。
//   【ヒラメキ】自分のリムーブエリアにあるLP0の〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。
// 句マッピング:
//   - a1「元のLPが0でレベル4の〚少年探偵団〛のすべてのキャラを元のLPを1に」=> forEach over:{kind:'all',
//     query:{area:'scene', side:'self', filter:{baseLpMin:0, baseLpMax:0, levelMin:4, levelMax:4, trait:'少年探偵団'}}}
//     do: charOverrideLP {uid:'$each.uid', val:1, scope:'turn'} (B01054 forEach+charOverrideLP 同型)。
//     ★ baseLpMin/baseLpMax = 「元のLP」= override 単体 (lpOverride ?? printed)、buff/debuff 込みの実効LP
//     (lpMin/lpMax) とは別軸 (Cluster WB1、rules/19 §元のLP、公式Q&A「もともと書かれているLP」)。
//     「すべて」= forEach over-all (0枚も可)。Q&A: 使用時点で現場にいるキャラのみ影響 = 解決時列挙。
//   - a2【ヒラメキ】リムーブの LP0 〚少年探偵団〛キャラ1枚まで手札 => handAddFromRemove 短縮形
//     {max:1, filter:{trait:'少年探偵団', lpMax:0, kind:'character'}} (evidence:remove-by-action optional)。
//     remove カードは修整を持たない = lpMax:0 で「LP0」を表現。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'forEach',
    over: {
      kind: 'all',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          baseLpMin: 0,
          baseLpMax: 0,
          levelMin: 4,
          levelMax: 4,
          trait: '少年探偵団'
        }
      }
    },
    do: {
      kind: 'atom',
      verb: 'charOverrideLP',
      args: {
        uid: '$each.uid',
        val: 1,
        scope: 'turn'
      }
    }
  },
  description: '【宣言】【ターン1】自分の現場にいる元のLPが0でレベル4の〚特徴［少年探偵団］〛のすべてのキャラを、ターン終了時まで元のLPを1にする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
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
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        trait: '少年探偵団',
        lpMax: 0,
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】自分のリムーブエリアにあるLP0の〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/17-icons.md'
  ]
};

export const B09011: CardDef = {
  id: 'B09011',
  no: '0956/B09011',
  kind: 'character',
  names: [
    '灰原哀'
  ],
  colors: [
    '青'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '少年探偵団',
    '科学者'
  ],
  rarity: 'C',
  imageUrl: '1775608802674030.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
