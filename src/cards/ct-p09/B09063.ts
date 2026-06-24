// cards/ct-p09/B09063 谷森棋士 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【自分ターン中】【ターン1】自分の現場にレベル8のキャラが登場したとき、相手の現場にレベル7のキャラがいない場合、カードを1枚引く。
// 句マッピング:
//   - 本体ステータス: 谷森棋士 / character / 赤 / Lv4 / AP3000 / LP1 / 特徴[棋士] / 印字キーワードなし => CardDef kind 'character', colors:['赤'], level:4, ap:3000, lp:1, traits:['棋士'], keywords:[] [.tmp/taskA/recs/B09063.json record (color 赤, level 4, ap 3000, lp 1, features 棋士; no 迅速/突撃/疾風/ブレット printed icon -> keywords:[]). CardDef shape modeled on src/cards/ct-p05/B05073.ts (赤 Lv4 LP1 char with ミスリード).]
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP−1する） => abilities[0] __shared misreadX({x:1, abilityId:'a1'}) -> type 'icon-misread' [src/cards/_shared/misreadX.ts (exports misreadX(opts{x,abilityId?}) returning AbilityDef type 'icon-misread', effect noop misread-marker; engine src/engine/listeners/misread.ts consumes args.x on reasoning:before-add = sleeps misread char + applies LP-X to reasoning char). EXACT call-shape exemplar src/cards/ct-p05/B05073.ts a1 = misreadX({x:1, abilityId:'a1'}). misreadX in scripts/taskA-codegen.cjs SHARED_FNS:107 + scripts/taskA-validate-specs.cjs SHARED_FNS:73. NOT a top-level CardDef keyword (rules/13 §ミスリードX is an icon ability) -> keywords:[].]
//   - 【自分ターン中】 (condition icon) => ability a2 condition conjunct {kind 'turn', player:'self'} [src/engine/cond/eval.ts turn case = state.turn.player === resolvePlayer(player) (cap-map Conditions §turn). EXACT exemplar src/cards/ct-p04/B04017.ts a1 condition uses {kind 'turn',player:'self'} as 【自分ターン中】. 'turn' in scripts/taskA-validate-specs.cjs CONDS:46 + eval.ts whitelist.]
//   - 【ターン1】 (per-turn use cap) => ability a2 limit {kind 'turn', n:1} [src/engine/listeners/triggered.ts handleHook: limit.kind==='turn' enforced via readChar.declaredUseCount(uid,abilityId) >= n then flag.incrDeclaredUseCount (per uid+abilityId, reset at turn boundary, BUG-096). EXACT exemplar src/cards/ct-p04/B04017.ts a1 limit {kind 'turn',n:1} on a triggered enter ability; also src/cards/pr-01/PR117.ts a2. rules/17 §【ターン①】.]
//   - 自分の現場にレベル8のキャラが登場したとき (another self-side level-8 char enters) => trigger {hook 'enter', matcherCondition:{kind 'triggerCharMatches', side:'self', payloadKey:'uid', filter:{kind 'character', levelMin:8, levelMax:8}}} (NOT selfOnly — bearer reacts to ANOTHER char's enter) [enter hook is card-triggerable for non-self reactions via generic handleHook (src/engine/listeners/triggered.ts collectCardsInPlay scan -> matcherCondition evalCond with triggerPayload). ALL enter emit sites (src/engine/effect/atom-handlers/scene.ts:72,210,239 + flow/main/hand-use-card.ts:167 + next-hint.ts:120) emit payload {uid,viaEffect,enterOrder,enterOrderThisTurn,[sourceCardId]} WITHOUT 'player' -> MUST use payloadKey:'uid' so triggerCharMatches derives side by scene-scan (src/engine/cond/eval.ts:318-326 reads pl[payloadKey] then scans state.players.self/opp.scene for uid to set tcmPlayer). side:'self' gates own-side via tcmPlayer===ctx.source.player (eval.ts:336-337). filter run through matchOneFilter on the entering scene char (eval.ts:342-344); entering char is in scene before emit (mutate.scene.enter precedes event.emit). levelMin:8/levelMax:8 honored by matchOneFilter effective-level formula (src/engine/target/candidates.ts:330,336-337). kind 'character' honored (candidates.ts BUG-118; scene chars all match, faithful to 'キャラ', aligns BUG-155 sweep). EXACT enter+triggerCharMatches+payloadKey:'uid' exemplar: src/cards/ct-p04/B04017.ts a1 (filter:{cardName}) and src/cards/pr-01/PR117.ts a2 / PR118.ts a2. payloadKey arg on TriggerDef type src/engine/types/effect.ts:90. NO 'このキャラ以外' qualifier in text + B09063 is Lv4 (never matches levelMin:8) -> excludeSource omitted.]
//   - 相手の現場にレベル7のキャラがいない場合 (no level-7 char in opp scene) => ability a2 condition conjunct {kind 'not', c:{kind 'sceneHas', query:{area:'scene', side:'opp', filter:{kind 'character', levelMin:7, levelMax:7}}, nMin:1}} [sceneHas{query,nMin} = candidates(query) count >= nMin (cap-map Conditions §sceneHas; src/engine/cond/eval.ts). nMin:1 + 'not' wrapper = '0 level-7 opp chars' = 'いない'. EXACT sceneHas-with-levelMin/levelMax exemplar src/cards/ct-p08/B08058.ts:42 (sceneHas{query:{area:'scene',side:'self',filter:{levelMin:7,levelMax:7}},nMin:3}); side:'opp' is a valid TargetQuery side (cap-map TargetQuery §side). 'not' combinator exemplar src/cards/ct-p08/B08058.ts:68 ({kind 'not', c:{...}}). 'not'+'sceneHas' both in scripts/taskA-validate-specs.cjs CONDS:46-48. levelMin/levelMax honored on scene candidates (candidates.ts:336-337). Evaluated at trigger time in handleHook ability.condition gate (rules/15 §条件は解決/トリガ時参照) = 登場したとき盤面参照.]
//   - カードを1枚引く (mandatory draw 1) => ability a2 effect {kind 'atom', verb 'draw', args:{player:'self', n:1}} [draw verb args {player,n:number} = mutate.deck.draw (cap-map Atom verbs §draw; 'draw' in scripts/taskA-validate-specs.cjs ATOM_VERBS:13). EXACT exemplar src/cards/ct-p08/B08039.ts a1 {kind 'atom', verb 'draw', args:{player:'self', n:2}}. 'カードを1枚引く' (not してもよい) = plain mandatory atom (no optional wrapper). player:'self' = card owner (rules/21 §自分の省略).]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'not',
        c: {
          kind: 'sceneHas',
          query: {
            area: 'scene',
            side: 'opp',
            filter: {
              kind: 'character',
              levelMin: 7,
              levelMax: 7
            }
          },
          nMin: 1
        }
      }
    ]
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
        kind: 'character',
        levelMin: 8,
        levelMax: 8
      }
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
  description: '【自分ターン中】【ターン1】自分の現場にレベル8のキャラが登場したとき、相手の現場にレベル7のキャラがいない場合、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const B09063: CardDef = {
  id: 'B09063',
  no: '1005/B09063',
  kind: 'character',
  names: [
    '谷森棋士'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '棋士'
  ],
  rarity: 'C',
  imageUrl: '1775608872850170.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
