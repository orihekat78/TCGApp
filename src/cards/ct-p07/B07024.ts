// cards/ct-p07/B07024 ハチ (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】相手の現場にレベル8のキャラが登場したとき、自分はカードを1枚引いてもよい。そうした場合、手札を1枚リムーブする。
//   【ヒラメキ】自分のリムーブエリアにある〚特徴［高校生］〛のキャラを1枚まで選び、手札に加える。
// 句マッピング:
//   - 本体ステータス: ハチ / character / 緑 / Lv4 / AP4000 / LP0 / 特徴[犬] / 印字キーワードなし => CardDef kind 'character', colors:['緑'], level:4, ap:4000, lp:0, traits:['犬'], keywords:[] [.tmp/taskA/recs/B07024.json record (color 緑, level 4, ap 4000, lp 0, features 犬; no 迅速/突撃/疾風/ブレット printed icon -> keywords:[]). LP0 is legal (rules/19 §AP/LP/level lower bound none). CardDef static-field shape modeled on src/cards/ct-p06/B06009.ts (青 Lv2 LP0 char) + src/cards/ct-p09/B09063.ts.]
//   - 【相手ターン中】 (condition icon) => a1 ability.condition {kind 'turn', player:'opp'} [src/engine/cond/eval.ts case 'turn' = state.turn.player === resolvePlayer(cond.player) (【自分/相手ターン中】). EXACT exemplar src/cards/ct-p06/B06009.ts a1 condition {kind 'turn', player:'opp'} as 【相手ターン中】 gating a draw+discard sequence. 'turn' in scripts/taskA-validate-specs.cjs CONDS:46.]
//   - 相手の現場にレベル8のキャラが登場したとき (opp-side level-8 char enters) => a1 trigger {hook 'enter', matcherCondition:{kind 'triggerCharMatches', side:'opp', payloadKey:'uid', filter:{kind 'character', levelMin:8, levelMax:8}}} (NOT selfOnly — bearer reacts to ANOTHER char's enter) [enter hook is card-triggerable for non-self reactions via generic handleHook (src/engine/listeners/triggered.ts in-play scan -> matcherCondition evalCond with triggerPayload). ALL enter emit sites (src/engine/effect/atom-handlers/scene.ts:72,210,239 + flow/main/next-hint.ts:120 + hand-use-card) emit payload {uid,viaEffect,enterOrder,enterOrderThisTurn,[sourceCardId]} WITHOUT 'player' -> MUST use payloadKey:'uid' so triggerCharMatches derives side by scene-scan (src/engine/cond/eval.ts:325-333 reads pl[payloadKey] then scans state.players.self/opp.scene for uid to set tcmPlayer). side:'opp' gates opp-side via tcmPlayer!==ctx.source.player (eval.ts:343-344 `if cond.side==='opp' && sameSide return false`). filter run through matchOneFilter on the entering scene char (eval.ts:346-348); entering char is in scene before emit (mutate.scene.enter precedes event.emit). levelMin:8/levelMax:8 + kind 'character' honored by matchOneFilter (src/engine/target/candidates.ts effective-level formula + kind BUG-118). EXACT enter+triggerCharMatches+payloadKey:'uid'+levelMin:8/levelMax:8 exemplar: src/cards/ct-p09/B09063.ts a2 (same clause structure '現場にレベル8のキャラが登場したとき' with side:'self'; mine flips to side:'opp' for '相手の現場'). payloadKey on TriggerDef/condition per B09063 + pr-01/PR117.]
//   - 自分はカードを1枚引いてもよい (optional draw 1) => a1 effect optional wrapper containing chain step1 {kind 'atom', verb 'draw', args:{player:'self', n:1}} [「してもよい」 = optional wrapper (brief DSL §). optional{effect: chain[...]} runtime runs inner only if optionalRun===true (cap-map WRAPPERS §optional). EXACT optional-wrapping-chain exemplar src/cards/ct-p06/B06016.ts a1 (「…してもよい。そうした場合、…」 => optional{chain[step1, step2]}). draw verb args {player,n:number} = mutate.deck.draw (cap-map Atom verbs §draw); exemplar src/cards/ct-p06/B06009.ts a1 draw {player:'self', n:1}. 'draw' in validate-specs ATOM_VERBS:13.]
//   - そうした場合、手札を1枚リムーブする (then mandatory discard 1 from hand) => a1 chain step2 {kind 'atom', verb 'discard', args:{player:'self', n:1}} [「そうした場合」 = chain (前段成功時のみ後段, cap-map WRAPPERS §chain; brief DSL §). Inside the opted-in optional branch: if player draws (step1 always applies), step2 discard runs; if player declines optional, neither runs — faithful to '引いてもよい。そうした場合リムーブ'. discard {player:'self', n:1} = Pattern-B short-form pick from hand (player picks which hand card; cap-map §discard). After draw, hand>=1 so always has a target. EXACT discard {player:'self', n:1} in a draw+discard pair exemplar src/cards/ct-p06/B06009.ts a1 ('カードを1枚引き、手札を1枚リムーブする' = sequence[draw n:1, discard n:1]); chain-step structure from src/cards/ct-p08/B08039.ts / ct-p04/B04056.ts. 'discard' in validate-specs ATOM_VERBS:13.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） icon ability gate => a2 type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true} [Hirameki encoding (cap-map §ICON ABILITIES Hirameki) = type 'triggered' + trigger {hook 'evidence:remove-by-action', optional:true}, typically scope 'on-evidence'. handleEvidenceRemovedHook (src/engine/listeners/triggered.ts) routes optional:true match to pendingHirameki side-channel (UI/AI fire-or-skip; rules/10). EXACT structural twin src/cards/ct-p03/B03059.ts a2 (type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}) + src/cards/ct-p08/B08039.ts a2.]
//   - 自分のリムーブエリアにある〚特徴［高校生］〛のキャラを1枚まで選び、手札に加える => a2 effect {kind 'atom', verb 'handAddFromRemove', args:{player:'self', max:1, filter:{trait:'高校生', kind 'character'}}} [handAddFromRemove handler (cap-map §handAddFromRemove): target undefined + max present => buildShortFormPick(defaultArea='remove'); max:1 (no n) => nMin:0,nMax:1 = '1枚まで' (0-pick legal, rules/15); side defaults to self ('自分の' rules/21); uses canonical candidates/matchOneFilter path so filter honored. trait + kind 'character' honored on area:'remove' card candidates (CardDef-static; src/engine/target/candidates.ts trait/kind on card candidates per B07017 a2 comment). EXACT handAddFromRemove{player:'self', max:1, filter:{...}} exemplars: src/cards/ct-p03/B03059.ts a2 (hirameki, filter cardName), src/cards/ct-p04/B04034.ts (filter:{cardName:'鈴木園子', kind 'character'}), src/cards/ct-p07/B07062.ts (filter:{kind 'event', trait:'赤魔術'} — trait+kind on remove area). 「特徴[高校生]のキャラ」 => trait:'高校生' + kind 'character' (キャラ限定). 'handAddFromRemove' in validate-specs ATOM_VERBS:15.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'opp',
      payloadKey: 'uid',
      filter: {
        kind: 'character',
        levelMin: 8,
        levelMax: 8
      }
    }
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'draw',
          args: {
            player: 'self',
            n: 1
          }
        },
        {
          kind: 'atom',
          verb: 'discard',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '【相手ターン中】相手の現場にレベル8のキャラが登場したとき、自分はカードを1枚引いてもよい。そうした場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
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
        trait: '高校生',
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】自分のリムーブエリアにある〚特徴［高校生］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md'
  ]
};

export const B07024: CardDef = {
  id: 'B07024',
  no: '0756/B07024',
  kind: 'character',
  names: [
    'ハチ'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: [
    '犬'
  ],
  rarity: 'C',
  imageUrl: '1762413994189163.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
