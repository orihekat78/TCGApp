// cards/ct-p07/B07035P 古畑恵 (character) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛か〚特徴［ビッグジュエル］〛のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。
// 句マッピング:
//   - 【登場時】 => ability a1: trigger {hook 'enter', selfOnly:true}, type 'triggered', scope 'on-scene' [PR098 a1 (src/cards/pr-01/PR098.ts) maps 【登場時】 to trigger {hook 'enter',selfOnly:true} for a deckReveal-on-enter; B01052 a2 same. enter hook registered, cap-map hooks §enter (【登場時】/【疾風N】). Fires on normal登場.]
//   - 自分のデッキのカードを上から3枚見る + その中から…のカードを1枚まで公開して手札に加え => deckRevealUntil{chooseMatch:'upTo', player:'self', maxN:3, filterAny:[...], bind:'$revealed', bindMatch:'$matched'} -> conditional(bound $matched matched)->handAddFromDeck{cardId:'$matched.cardId'} [B09073 a2 (src/cards/ct-p09/B09073.ts) is the EXACT twin '上から3枚見る…1枚まで公開して手札に加え' = deckRevealUntil{chooseMatch:'upTo', maxN:3, bind/bindMatch} + conditional(bound $matched)->handAddFromDeck($matched.cardId). chooseMatch:'upTo' surfaces a decline-able pick for the human owner (atom-handlers.ts:1441-1488; rules/15 「〜まで」=0枚可); AI auto-takes first match. maxN branch reveals min(deck,3) then first match (atom-handlers.ts:1413-1426). handAddFromDeck proven in B01052/PR098 + cap-map §Evidence/hand movement.]
//   - 〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛か〚特徴［ビッグジュエル］〛のカード (cross-field OR, kind unspecified) => deckRevealUntil filterAny:[{cardName:'黒羽快斗'},{cardName:'怪盗キッド'},{trait:'ビッグジュエル'}] (filter omitted -> base ()=>true) [cluster16 G2: atom-handlers.ts:1349-1360 honors filterAny on the deckReveal predicate path — filter=(id)=>basePred(id)&&anyPreds.some(p=>p(id)); basePred=targetFilterToPredicate(undefined)=()=>true when filter omitted (atom-handlers.ts:66-67). cardName (split-name allCardNameComponentsForDef, atom-handlers.ts:103-107) and trait (atom-handlers.ts:78-81) both evaluated on the deckReveal path. '…のカード' (キャラ unspecified) -> no kind constraint (brief §cluster16 G2 ⚠ '〚特徴[X]〛のカード'=no kind). The two cardName designations are joined by か and inherit the カード名 designation. filterAny on TargetQuery type = effect.ts:129. brief 解消済 gate table lists 'deckReveal cross-field OR' = NOW GREEN. This is the very gate that previously made B07035 yellow (claude-mem 14058) — resolved by cluster16 (engine SHA 1895184f).]
//   - 残りをリムーブエリアに移す => boundToRemove{player:'self', bindKey:'$revealed'} [B09073 a2 (src/cards/ct-p09/B09073.ts) has the EXACT same official phrase '残りをリムーブエリアに移す' = boundToRemove{$revealed}. atom-handlers.ts:1555-1589 splices $revealed cardIds from deck into the remove pile, then refreshes if deck hits 0 (rules/26). validate.ts:36 registered. Correct verb for 'to remove area' (NOT deckToBottomBound).]
//   - カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする => conditional{if:and([bound($matched matched), caseStatus('解決編')]), then:discard{player:'self', n:1}} ['カードを手札に加え（た）' = a $matched card existed and was added = bound{key:'$matched',presence:'matched'} (cond/eval.ts:168-174 true iff non-empty array). '自分の事件が解決編の場合' = caseStatus{status:'解決編'} (cond/eval.ts:75-78 owner case.status==='解決編'; used in B07019 a1 / PR098 a2). and combinator cond/eval.ts:31. '手札を1枚リムーブする' = discard{player:'self', n:1} = EXACT twin of B09073 a2 trailing step (discard short-form builds a hand pick; human chooses which card). Clause order (handAdd->boundToRemove->discard) follows B09073 word-order pin (avoids refresh side-effects).]
//   - vanilla stats / no printed innate keyword => keywords:[] [recs/B07035.json has empty cutIn/hirameki/henso and no printed 迅速/突撃/疾風/ブレット in effect -> keywords:[] (brief: keywords[] = printed innate only).]

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
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 3,
          filterAny: [
            {
              cardName: '黒羽快斗'
            },
            {
              cardName: '怪盗キッド'
            },
            {
              trait: 'ビッグジュエル'
            }
          ],
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'boundToRemove',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'and',
          cs: [
            {
              kind: 'bound',
              key: '$matched',
              presence: 'matched'
            },
            {
              kind: 'caseStatus',
              status: '解決編'
            }
          ]
        },
        then: {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から3枚見る。その中から〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛か〚特徴［ビッグジュエル］〛のカードを1枚まで公開して手札に加え、残りをリムーブエリアに移す。カードを手札に加え、自分の事件が解決編の場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B07035P: CardDef = {
  id: 'B07035P',
  no: '0764/B07035P',
  kind: 'character',
  names: [
    '古畑恵'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '女優'
  ],
  rarity: 'RP',
  imageUrl: '1763546809909284.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
