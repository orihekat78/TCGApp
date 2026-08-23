// cards/ct-p07/B07066 赤井秀一 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md, rules/03-field-areas.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にレベル7以下の〚特徴［赤井家］〛のキャラが登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】〚このキャラか、特徴［赤井家］のキャラを1枚スリープさせる〛：自分のデッキのカードを上から3枚見る。その中から〚特徴［赤井家］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - 本体: 赤井秀一 / character / 赤 / Lv8 / AP7000 / LP2 / 特徴[FBI|赤井家] / 印字キーワードなし => CardDef kind 'character', colors:['赤'], level:8, ap:7000, lp:2, traits:['FBI','赤井家'], keywords:[] [.tmp/taskA/recs/B07066.json record (features 'FBI|赤井家' → traits split on '|'; no 迅速/突撃/疾風/ブレット printed → keywords:[]). Stat/feature shape matches sibling character cards (src/cards/ct-p07/B07067.ts 沖矢昴, 赤). NOTE 赤井秀一 自身が trait 赤井家 を持つ点が a2 cost の self-or-trait 等価化の根拠。]
//   - a1 【自分ターン中】 => ability.condition {kind 'turn', player:'self'} [src/engine/cond/eval.ts turn case = state.turn.player === resolvePlayer(player). Exact icon exemplar src/cards/ct-p04/B04017.ts a1 second conjunct {kind 'turn',player:'self'} for identical 【自分ターン中】. B07066 has only this icon (no 【パートナー(色)】) → single condition, no 'and' wrapper.]
//   - a1 【ターン1】 => ability.limit {kind 'turn', n:1} [src/engine/listeners/triggered.ts handleHook enforces limit.kind==='turn' via declaredUseCount(uid,abilityId) per turn. Exemplar src/cards/ct-p04/B04017.ts a1 limit {kind 'turn',n:1} on a triggered enter-reaction ability.]
//   - a1 自分の現場にレベル7以下の〚特徴［赤井家］〛のキャラが登場したとき (bearer reacts to ANOTHER self-side char entering, filtered by trait+level) => trigger {hook 'enter', matcherCondition:{kind 'triggerCharMatches', side:'self', payloadKey:'uid', filter:{trait:'赤井家', levelMax:7}}} (NOT selfOnly) [EXACT structural exemplar src/cards/ct-p04/B04017.ts a1: 「〚カード名［遠山和葉］〛が自分の現場に登場したとき」 = trigger{hook 'enter', matcherCondition:{triggerCharMatches, side:'self', payloadKey:'uid', filter:{cardName:'遠山和葉'}}}; B07066 only swaps the filter to {trait:'赤井家', levelMax:7}. enter is a registered card-triggerable hook (capability-map §Hooks; generic handleHook scans in-play cards for non-self reactions). enter payload lacks 'player' so payloadKey:'uid' is required — confirmed in src/engine/cond/eval.ts:303-311 (payloadKey present → tcmUid=pl[payloadKey], side derived by scene-scan). side:'self' gates tcmPlayer===ctx.source.player (eval.ts:320-321). filter run via matchOneFilter(state, ch.cardId, cond.filter, ch, cand) on the ACTUAL entering scene char (eval.ts:324-327), so dynamic trait+level honored. matchOneFilter ANDs trait (candidates.ts:276) and levelMax (candidates.ts:329) → requires BOTH trait 赤井家 AND level≤7. Entering char is on scene before emit. No 'このキャラ以外' qualifier → excludeSource omitted.]
//   - a1 AP8000以下のキャラを1枚まで選び、リムーブする => effect atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{apMax:8000}} [BYTE-IDENTICAL to src/cards/ct-p04/B04017.ts a1 effect (AP8000以下を1枚までリムーブ). sceneRemove short-form PA pick (capability-map §Scene); apMax honored by matchOneFilter (candidates.ts:325). 'キャラ' unqualified → side:'either' (both scenes, rules/15). '1枚まで' → max:1 with implicit nMin:0 (0-pick legal, rules/15). 'リムーブする' (not してもよい) → plain mandatory atom, no optional wrapper. cause:'effect' = 能力リムーブ.]
//   - a2 【宣言】 => ability.type 'declared', scope 'on-scene' [capability-map §3/§declared: player-declared, cost paid via §1, runs effect, usable from scene chars. Exemplar src/cards/ct-p07/B07067.ts a2 / src/cards/ct-p09/B09082.ts a1 (type 'declared', scope 'on-scene').]
//   - a2 【ターン1】 => ability.limit {kind 'turn', n:1} [src/engine/listeners/triggered.ts declaredUseCount gating for declared abilities (per source uid+abilityId). Exemplar src/cards/ct-p07/B07067.ts a2 limit {kind 'turn',n:1} on declared ability.]
//   - a2 cost 〚このキャラか、特徴［赤井家］のキャラを1枚スリープさせる〛 => cost {kind 'sleepChar', target:{kind 'pick', query:{area:'scene', side:'self', filter:{trait:'赤井家'}}, n:{min:1,max:1}, chooser:'self'}} [EXACT cost shape exemplar src/cards/ct-p09/B09082.ts a1 (〚現場にいるカード名［知苑大哉］を1枚スリープさせる〛 = sleepChar pick {area:'scene', side:'self', filter:{cardName}, n:{1,1}, chooser:'self'}) and src/cards/ct-p07/B07067.ts a2 (sleepChar filter {levelMin,color}). src/engine/cost/evaluate.ts:37 sleepChar canPay enumerates candidates(target) and requires ≥1 active; src/engine/cost/pay.ts:43-53 sleeps the picked char. KEY EQUIVALENCE: 赤井秀一 itself has trait 赤井家 (record features 'FBI|赤井家'), so 「このキャラ」 ⊆ 「特徴［赤井家］のキャラ on self scene」 → 'このキャラか、特徴［赤井家］のキャラ' is exactly the set {self-side scene chars with trait 赤井家}, which includes self. Hence filter:{trait:'赤井家'} on side:'self' is the complete, non-lossy mapping (no excludeSource, self is intentionally included). side:'self' = コストは自分のカードのみ (rules/21, B07067 qAndA).]
//   - a2 自分のデッキのカードを上から3枚見る => atom deckRevealUntil {player:'self', maxN:3, bind:'$revealed', bindMatch:'$matched'} [src/engine/effect/atom-handlers.ts:1342 deckRevealUntil: maxN set → reveals min(deck,maxN)=min(deck,3) then first filter match; binds remainder→$revealed, match→$matched (atom-handlers.ts:1413-1512). Exemplar src/cards/ct-d05/D05007.ts a1 (上から3枚見る = maxN:3, same bind/bindMatch). deckRevealUntil in ATOM_VERBS (validate.ts:36).]
//   - a2 その中から〚特徴［赤井家］〛のキャラを1枚まで公開して手札に加え => deckRevealUntil filter:{kind 'character', trait:'赤井家'} + chooseMatch:'upTo' → conditional if bound $matched matched then handAddFromDeck {cardId:'$matched.cardId'} [Single-field-within-AND (kind 'character' AND trait '赤井家'), no cross-field OR → plain filter, NO filterAny needed (brief §cluster16 G2: filterAny only for cross-field OR). targetFilterToPredicate (atom-handlers.ts) honors trait+kind on deck cards (BUG-117/118; capability-map deckRevealUntil note). '〚特徴［赤井家］〛のキャラ' → kind 'character' + trait:'赤井家'. '1枚まで...手札に加え' (0枚可 decline) = chooseMatch:'upTo' with maxN!==undefined — atom-handlers.ts:1442 surfaces a decline-able pick (nMin:0,nMax:1) for human owner; on decline ctx.bindings[bindMatch]=[] (atom-handlers.ts:1375-1378), on accept = chosen card; AI falls through to forced first-match (atom-handlers.ts:1502-1509). rules/15「〜枚まで」=0枚可 + rules/26 B08020 Q&A「条件を満たすカードがあっても加えないことは可能」. EXACT triple (deckRevealUntil chooseMatch:'upTo' + conditional bound $matched + handAddFromDeck $matched.cardId) copied from src/cards/ct-p04/B04012.ts a1 and src/cards/ct-p05/B05020.ts a1.]
//   - a2 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self', bindKey:'$revealed'} [src/cards/ct-p04/B04012.ts a1 / src/cards/ct-p05/B05020.ts a1 final step. atom-handlers.ts deckToBottomBound moves bound cardIds deck→bottom (mutate.deck.toBottom). On decline, $revealed=all 3 window ids (atom-handlers.ts:1382-1391) so all move to deck bottom (公式: 加えなければ全部デッキ下, B08020 Q&A). '好きな順番' player-reorder is the accepted non-surfaced limitation uniform across ALL deck-look cards (preserves peek order; no engine change, no green impact).]
//   - a2 カードを手札に加えた場合、手札を1枚リムーブする => conditional {if: bound $matched presence:'matched', then: atom discard {player:'self', n:1}} [$matched is matched IFF a card was actually added to hand: human-decline clears it to [] (atom-handlers.ts:1375-1378), accept binds the chosen card, AI auto-takes first match (atom-handlers.ts:1502-1509) — so 'bound $matched matched' exactly tracks 「カードを手札に加えた場合」. '手札を1枚リムーブする' (mandatory, not してもよい) = discard {player:'self', n:1} (BYTE-IDENTICAL to src/cards/ct-d08/D08026.ts a1 「自分は手札を1枚リムーブする」). discard atom (atom-handlers.ts:327) with no target + n:1 builds a hand short-form pick (defaultArea=hand); hand is non-empty here because a card was just added so the mandatory discard is always satisfiable. bind $matched survives the chooseMatch pick-await via continuation on the same ctx (BUG-107).]
//   - tier classification => tier 2 [Resolution surfaces player selections: a1 sceneRemove '1枚まで選び' pick; a2 sleepChar cost pick + deckRevealUntil chooseMatch decline/identity pick + discard hand pick. Multiple pick/optional surfaces → tier 2.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'self'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      filter: {
        trait: '赤井家',
        levelMax: 7
      }
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        apMax: 8000
      }
    }
  },
  description: '【自分ターン中】【ターン1】自分の現場にレベル7以下の〚特徴［赤井家］〛のキャラが登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'sleepChar',
    target: {
      kind: 'pick',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          trait: '赤井家'
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    }
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
          filter: {
            kind: 'character',
            trait: '赤井家'
          },
          maxN: 3,
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
            cardId: '$matched.cardId',
            presentation: 'public-selected-card'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
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
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      }
    ]
  },
  description: '【宣言】【ターン1】〚このキャラか、特徴［赤井家］のキャラを1枚スリープさせる〛：自分のデッキのカードを上から3枚見る。その中から〚特徴［赤井家］〛のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
    'rules/03-field-areas.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B07066: CardDef = {
  id: 'B07066',
  no: '0795/B07066',
  kind: 'character',
  names: [
    '赤井秀一'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    'FBI',
    '赤井家'
  ],
  rarity: 'SR',
  imageUrl: '1759154512417494.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md',
    'rules/03-field-areas.md',
    'rules/24-qa-naming-stun.md'
  ],
};
