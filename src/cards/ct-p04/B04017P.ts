// cards/ct-p04/B04017P 服部平次 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【パートナー緑】【自分ターン中】【ターン1】〚カード名［遠山和葉］〛が自分の現場に登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 本体ステータス: 服部平次 / character / 緑 / Lv8 / AP8000 / LP2 / 特徴[探偵|高校生] / 印字キーワードなし => CardDef kind 'character', colors:['緑'], level:8, ap:8000, lp:2, traits:['探偵','高校生'], keywords:[] [.tmp/taskA/recs/B04017.json record (no 迅速/突撃/疾風/ブレット printed icon → keywords:[]). Same-character variant src/cards/ct-d02/D02002.ts (服部平次, 緑, traits ['探偵','高校生']) confirms stat/feature shape.]
//   - 【パートナー緑】 (condition icon) => ability.condition first conjunct {kind 'partnerColor', color:'緑'} [src/engine/cond/eval.ts:37-43 partnerColor case = owner's partner CardDef.colors includes color. Exact arg shape exemplar src/cards/ct-d02/D02002.ts a1 condition {kind 'partnerColor',color:'緑'} (same character). rules/17 §【パートナー(色)】.]
//   - 【自分ターン中】 (condition icon) => ability.condition second conjunct {kind 'turn', player:'self'} [src/engine/cond/eval.ts:34-35 turn case = state.turn.player === resolvePlayer(player). Exemplar src/cards/ct-p01/B01028.ts a3 uses {kind 'turn',player:'self'} as 【自分ターン中】.]
//   - 【パートナー緑】+【自分ターン中】 combined gate => ability.condition {kind 'and', cs:[partnerColor, turn]} [src/engine/cond/eval.ts:31-32 and case = cs.every(evalCond). EXACT 1:1 exemplar src/cards/ct-p01/B01028.ts a3: condition {kind 'and', cs:[{kind 'partnerColor',color:'緑'},{kind 'turn',player:'self'}]} — identical 【パートナー緑】【自分ターン中】 combination.]
//   - 【ターン1】 (per-turn use cap) => ability.limit {kind 'turn', n:1} [src/engine/listeners/triggered.ts handleHook: limit.kind==='turn' enforced via readChar.declaredUseCount(uid,abilityId) >= n then incrDeclaredUseCount (per uid+abilityId, reset at turn boundary). Exemplar src/cards/ct-p01/B01028.ts a3 limit {kind 'turn',n:1} on a triggered ability + src/cards/pr-01/PR117.ts a2.]
//   - 〚カード名［遠山和葉］〛が自分の現場に登場したとき (another self-side named char enters) => trigger {hook 'enter', matcherCondition:{kind 'triggerCharMatches', side:'self', payloadKey:'uid', filter:{cardName:'遠山和葉'}}} (NOT selfOnly — bearer reacts to ANOTHER char's enter) [enter hook is card-triggerable for non-self reactions via generic handleHook (src/engine/listeners/triggered.ts: collectCardsInPlay scan → matcherCondition evalCond with triggerPayload). enter emit payload lacks 'player' (src/engine/effect/atom-handlers.ts:703,841 + flow/main/hand-use-card.ts:167 + next-hint.ts:120 all emit {uid,viaEffect,enterOrder,enterOrderThisTurn,[sourceCardId]} only) → MUST use payloadKey:'uid' so triggerCharMatches derives side by scene-scan (src/engine/cond/eval.ts:298-303). side:'self' gates own-side via tcmPlayer===ctx.source.player (eval.ts:312-314). filter:{cardName:'遠山和葉'} run through matchOneFilter on the entering scene char (eval.ts:317-320). cardName split-name matching honored at src/engine/target/candidates.ts:260-265 (rules/19). The entering char is in scene before emit (mutate.scene.enter precedes event.emit), so the scene lookup succeeds. EXACT enter+triggerCharMatches+payloadKey:'uid' exemplar: src/cards/pr-01/PR117.ts a2 / PR118.ts a2 ('このキャラ以外の〚特徴[探偵]〛が自分の現場に登場したとき'). payloadKey arg shape also grounded by src/cards/ct-p09/B09041.ts a1 (payloadKey:'guardUid') and src/cards/ct-d04/D04007.ts a1 (payloadKey:'byUid'). NO 'このキャラ以外' qualifier in B04017 text → excludeSource omitted (服部平次 never matches cardName 遠山和葉 anyway).]
//   - AP8000以下のキャラを1枚まで選び、リムーブする (mandatory; up to 1; either scene) => effect atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{apMax:8000}} [capability-map sceneRemove short-form PA pick; apMax honored by matchOneFilter (src/engine/target/candidates.ts ap filter). EXACT same-character exemplar src/cards/ct-d02/D02002.ts a1 sceneRemove {player:'self', max:1, side:'either', filter:{apMax:8000}} (AP8000以下を1枚までリムーブ). cause:'effect' added per src/cards/ct-p09/B09041.ts a3 / ct-p08/B08034.ts a1. 'キャラ' unqualified = both scenes → side:'either' (rules/15). '1枚まで' = max:1 with nMin:0 (0-pick legal, rules/15 §〜枚まで). 'リムーブする' (not してもよい) = plain mandatory atom (NOT wrapped in optional).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '緑'
      },
      {
        kind: 'turn',
        player: 'self'
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
        cardName: '遠山和葉'
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
  description: '【パートナー緑】【自分ターン中】【ターン1】〚カード名［遠山和葉］〛が自分の現場に登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const B04017P: CardDef = {
  id: 'B04017P',
  no: '0418/B04017P',
  kind: 'character',
  names: [
    '服部平次'
  ],
  colors: [
    '緑'
  ],
  level: 8,
  ap: 8000,
  lp: 2,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'SRP',
  imageUrl: '1735287737372614.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
