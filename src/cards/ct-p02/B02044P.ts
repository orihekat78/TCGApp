// cards/ct-p02/B02044P 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【登場時】【変装時】自分のデッキのカードを上から2枚見る。その中から【変装】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【変装】【事件白】【FILE4】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
// 句マッピング:
//   - 【登場時】… (登場トリガー) => a1: triggered scope 'on-scene' trigger {hook 'enter', selfOnly:true} [Exemplar src/cards/ct-p01/B01013.ts a1 と B01050.ts a2: 【登場時】= triggered enter+selfOnly。triggered.ts TRIGGERED_HOOKS に 'enter' 登録 (lines 57-58)。cap-map hooks: enter selfOnly ✅ (source.uid)。enter は handUseCard/next-hint/sceneEnter 全登場経路で発火。]
//   - 【変装時】… (変装トリガー、登場時と同一効果) => a2: triggered scope 'on-scene' trigger {hook 'disguise:into', selfOnly:true} — a1 と同一の deck-look 効果 [Exemplar src/cards/ct-p02/B02045.ts a2 / ct-p03/B03129.ts a2: 【変装時】= triggered disguise:into+selfOnly。flow/contact.ts disguise() が disguise:into emit (payload {uid,fromCardId,newCardId}, uid 維持; line 178)。cap-map: 変装は enter を発火させない → 登場時/変装時 は別 hook で重複発火しない。同一効果のため 2 つの ability に複製 (engine に enter+disguise:into の単一 multi-hook 前例は無く、各 selfOnly 単 hook が確実に grounding 可能なため分割)。]
//   - 自分のデッキのカードを上から2枚見る => deckRevealUntil {player:'self', maxN:2, bind:'$revealed', bindMatch:'$matched'} [atom-handlers.ts:1391-1407: maxN 指定時 lookN=min(deck,maxN) を全件 reveal し最初の match を採用。$revealed=match を除く残り全 reveal、$matched=最初の match (or [])。Exemplar B01013.ts a1 が maxN:2 で同型 (certified)。deckRevealUntil は ATOM_VERB_MAP 登録済 (brief verb list)。]
//   - その中から【変装】を持つキャラを1枚まで公開して手札に加え => filter:{keyword:'変装', kind 'character'} + chooseMatch:'upTo' + conditional(bound $matched)→handAddFromDeck {cardId:'$matched.cardId'} [★重要: cap-map line 67 は『deckRevealUntil predicate path で keyword NOT honored』と記載するが STALE。live atom-handlers.ts targetFilterToPredicate (lines 97-100, wave#2 cluster2 2026-06-12) は filter.keyword を defHasKeyword に委譲して honor する。src/engine/read/keyword.ts defHasKeyword: ICON_KEYWORD_PREDICATES['変装'] = (ab)=>ab.type==='icon-disguise' → 変装持ちキャラ (icon-disguise ability 保有 def) を正しく判定。kind 'character' も line 92 で honor。chooseMatch:'upTo'+maxN (lines 1424-1465): owner=human のとき pick surface (0枚 decline 可=「1枚まで」rules/15); AI は先頭 match 自動取得。handAddFromDeck は B01013/B01050 同型 ($matched.cardId を deck→hand)。]
//   - 残りを好きな順番でデッキの下に移す => deckToBottomBound {player:'self', bindKey:'$revealed'} [atom-handlers.ts deckToBottomBound: $revealed の cardIds を deck から bottom へ。Exemplar B01013.ts a1 step3 同型。『好きな順番で』= 並べ替えだが maxN:2 かつ最大1枚取得のため残りは最大1枚 → 並び順は vacuous (1枚に順序無し)。よって deckToBottomBound の固定順 (player-chosen reorder 不可, cap-map line 68 / memory 13947) gate には触れない。B01013 (maxN:2) が同条件で certified 済。]
//   - 【変装】（変装能力本体） => a3: type 'icon-disguise' [flow/contact.ts disguiseAbility() / canDisguise() (lines 43-46, 147-170): type 'icon-disguise' ability を探し、その condition を変装可否ゲートとして評価。Exemplar B02045.ts a1 (同名 怪盗キッド・同 henso テキスト) が直接の型。]
//   - 【事件白】【FILE4】（変装ゲート条件） => a3.condition: and[caseColor 白, fileAtLeast 4] [B02045.ts a1 の condition と完全一致 (同 henso テキスト【変装】【事件白】【FILE4】)。cond/eval.ts: caseColor (owner 事件色 membership) / fileAtLeast (file.length>=n)。canDisguise が ability.condition を評価し未達なら変装不可 (rules/17 §条件アイコン)。]

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
          filter: {
            keyword: '変装',
            kind: 'character'
          },
          maxN: 2,
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
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【登場時】自分のデッキのカードを上から2枚見る。その中から【変装】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
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
          filter: {
            keyword: '変装',
            kind: 'character'
          },
          maxN: 2,
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
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【変装時】自分のデッキのカードを上から2枚見る。その中から【変装】を持つキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-disguise',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: '白'
      },
      {
        kind: 'fileAtLeast',
        n: 4
      }
    ]
  },
  description: '【変装】【事件白】【FILE4】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md'
  ]
};

export const B02044P: CardDef = {
  id: 'B02044P',
  no: '0210/B02044P',
  kind: 'character',
  names: [
    '怪盗キッド'
  ],
  colors: [
    '白'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '怪盗'
  ],
  rarity: 'CP',
  imageUrl: '1721357230982574.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
