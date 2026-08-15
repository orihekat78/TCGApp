// cards/ct-d05/D05007 松田陣平 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/11-reasoning.md, rules/14-refresh.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。その中からレベル4以下の【黄】のキャラを1枚までスリープ状態で登場させ、残りを好きな順番でデッキの下に移す。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【相手ターン中】 => ability.condition {kind:'turn',player:'opp'} [Condition 'turn' fully evaluated in cond/eval.ts (capability-map §E); exemplar src/cards/ct-d01/D01012.ts a1 uses identical condition for word-for-word same text.]
//   - 【現場リムーブ時】(このキャラ自身) => trigger {hook:'leave:to-remove',selfOnly:true}, scope:'on-scene' [leave:to-remove is a registered card-triggerable hook with selfOnly support (capability-map §B / hooks section, emitted by mutate/scene.ts); exemplar D01012.ts a1.]
//   - 自分のデッキのカードを上から3枚見る => atom deckRevealUntil {player:'self',maxN:3,bind:'$revealed',bindMatch:'$matched'} [deckRevealUntil verb (capability-map §D / Deck ops); maxN=3 reveals min(deck,3); exemplar D01012.ts a1 + B01013.ts a1.]
//   - その中からレベル4以下の【黄】のキャラを1枚まで… => deckRevealUntil chooseMatch:'upTo', filter {color:'黄',levelMax:4,kind:'character'} → conditional bound$matched [deckRevealUntil predicate path honors cardId/color/trait/ap/lp/level/kind (capability-map §deckRevealUntil note, BUG-117/118 fixed). chooseMatch:'upTo' surfaces every match with nMin:0/nMax:1, so 1枚まで permits zero. Exemplar D01012.ts a1 (青 twin, levelMax:4,kind:'character').]
//   - …スリープ状態で登場させ => atom sceneEnter {cardId:'$matched.cardId',enterSleep:true,viaEffect:true,target:{query:{area:'deck',side:'self'}}} [src/engine/effect/atom-handlers.ts sceneEnter (lines 526-660): resolveBindRef resolves $matched.cardId (line 559), sourceArea==='deck' splices card out of self deck (lines 612-616, prevents dup), enterSleep:true→active:false (lines 645-650) → mutate/scene.ts enter sets state:'sleep' when active===false (scene.ts:54). emits 'enter' hook. Exemplar D01012.ts a1 uses identical args.]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound {player:'self',bindKey:'$revealed'} [deckToBottomBound moves the residual bound occurrences; a human owner receives pendingDeckReorder when at least two remain, and the accepted permutation becomes the bottom block.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => type:'triggered', scope:'on-evidence', trigger {hook:'evidence:remove-by-action',optional:true} [evidence:remove-by-action is the ヒラメキ hook (capability-map §B / hooks); optional:true routes to pendingHirameki fire/skip side-channel. Exemplar D01012.ts a2.]
//   - キャラを1枚まで選び、スリープさせる => atom sceneSetState {uid:'$pick',state:'sleep',target:{kind:'pick',query:{area:'scene',side:'either'},n:{min:0,max:1},chooser:'self'}} [sceneSetState Pattern A pick (capability-map §Scene + §Pick mechanisms); n.min:0 ⇒ 1枚まで (0-pick legal); side:'either' = どちらの現場も対象 (rules/15). Exemplar D01012.ts a2 (identical).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
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
            color: '黄',
            levelMax: 4,
            kind: 'character'
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
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$matched.cardId',
            viaEffect: true,
            enterSleep: true,
            target: {
              query: {
                area: 'deck',
                side: 'self'
              }
            }
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
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。その中からレベル4以下の【黄】のキャラを1枚までスリープ状態で登場させ、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
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
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ]
};

export const D05007: CardDef = {
  id: 'D05007',
  no: '0152/D05007',
  kind: 'character',
  names: [
    '松田陣平'
  ],
  colors: [
    '黄'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'D',
  imageUrl: '1714013167791370.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
