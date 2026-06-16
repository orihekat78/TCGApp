// cards/ct-p06/B06067P 中森銀三 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）\n【ターン1】相手の現場にいるキャラが自分の現場にいるこのキャラ以外の〚特徴［警察］〛のキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。\n【宣言】【ターン1】〚手札を1枚リムーブする〛：〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
// 句マッピング:
//   - 〚突撃〛（登場したターンからすぐにアクションできる） => keywords:['突撃'] (印字 innate keyword、ability 不要) [src/cards/ct-p03/B03067.ts: 公式テキスト『〚突撃〛（登場したターンからすぐにアクションできる）』を keywords:['突撃'] のみで表現し ability を作らない (line 9,55,58)。parenthetical はリマインダー。]
//   - 【ターン1】相手の現場にいるキャラが自分の現場にいるこのキャラ以外の〚特徴［警察］〛のキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。 => triggered on-scene, trigger{hook 'leave:to-remove'} (NO selfOnly), condition{kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:{filter:{trait:'警察'}, excludeSource:true}}, effect draw{player:'self', n:1}, limit{turn,1} [brief §反撃 variant『このキャラ以外の〚X〛のキャラとの…』= by:{filter,excludeSource:true}。engine: src/engine/cond/eval.ts:329-355 removedCharMatches 実装 — side/cause を owner-relative 評価、by.excludeSource で byUid===source.uid を除外、by.filter を attacker(byUid)に matchOneFilter。src/engine/types/effect.ts:71 型 {kind 'removedCharMatches'; side?; cause?:'contact-ap'|...; by?:'self'|{filter;excludeSource?}}。src/engine/flow/contact.ts:262-264 AP判定除去時 removeToRemove(state, bUid, 'contact-ap', aUid) で byUid=winner=attacker(=自分の警察キャラ)。src/engine/listeners/triggered.ts:381-388 leave:to-remove で handleLeaveToRemoveSelf+在場 in-play scan(handleHook) 両走査=非selfOnly observer も発火、:230-245 ability.condition を ctx.triggerPayload=payload で evalCond。:254 limit{turn,n} 強制。effect は強制 draw のみ=cascade 除去 verb なし → DEFER 対象外。]
//   - 【宣言】【ターン1】〚手札を1枚リムーブする〛：〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。 => declared on-scene, limit{turn,1}, cost{kind 'removeFromHand', target pick hand/self n1, n:1}, effect charSetTurnEffect{uid:'$pick', key:'actionTargetsActive', val:true, target: pick scene/either filter{trait:'警察'} n{min:0,max:1} chooser:'owner'} [近一致 exemplar src/cards/ct-p08/B08037.ts a1: charSetTurnEffect{uid:'$pick', key:'actionTargetsActive', val:true, target:{kind 'pick', query:{area:'scene', side:'self', filter:{cardName:'京極真'}}, n:{min:0,max:1}, chooser:'owner'}} で『…アクティブ状態のキャラを指定してアクションできる。』を別キャラに付与 (top-level pick=BUG-130対象外)。cost 形は src/cards/ct-p08/B08032.ts a1: {kind 'removeFromHand', target:{kind 'pick',query:{area:'hand',side:'self'},n:{min:1,max:1},chooser:'self'}, n:1} と byte一致。token 消費は src/engine/flow/action/target-expander.ts:114 hasTextAbility(state,byUid,'actionTargetsActive') が相手 active を対象拡張、clearTurnEffects('turn') で『ターン終了時まで』清掃。side:'either' は B06067 本文に『自分の現場にいる』修飾が無いため rules/15 (area/side 無指定=どちらの現場も選択可・効果発動キャラ自身も可)。chooser:'owner' は src/engine/types/effect.ts:133 で valid。全 arg は pure JSON (closure なし)。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: {
      filter: {
        trait: '警察'
      },
      excludeSource: true
    }
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ターン1】相手の現場にいるキャラが自分の現場にいるこのキャラ以外の〚特徴［警察］〛のキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self'
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charSetTurnEffect',
    args: {
      uid: '$pick',
      key: 'actionTargetsActive',
      val: true,
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either',
          filter: {
            trait: '警察'
          }
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'owner'
      }
    }
  },
  description: '【宣言】【ターン1】〚手札を1枚リムーブする〛：〚特徴［警察］〛のキャラを1枚まで選び、ターン終了時まで「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B06067P: CardDef = {
  id: 'B06067P',
  no: '0688/B06067P',
  kind: 'character',
  names: [
    '中森銀三'
  ],
  colors: [
    '白'
  ],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'SRP',
  imageUrl: '1755684967049865.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
