// cards/ct-p07/B07077 揺れる心 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。この能力は自分の現場に〚特徴［FBI］〛のキャラがいる場合に宣言できる。
// 句マッピング:
//   - この事件が解決編になったとき、自分は手札を1枚リムーブする。 => type:'triggered' scope:'always' trigger:{hook:'case:to-resolved',selfOnly:true} effect: atom discard {player:'self',n:1} [EXACT match to D08026.ts a1 and D11021.ts a1 (both case cards, identical official text, inline form). case:to-resolved is a registered TRIGGERED_HOOK (capability-map hooks section; payload {player}; emitted by mutate/case.ts). selfOnly gates source.uid===case:self uid (declared-ability/triggered listener). discard short-form (Pattern B, defaultArea=hand) builds a hand pick — atom-handlers.ts discard case (line ~270). Also = _shared caseResolvedHandRemove(n:1) which B07062.ts a1 uses; inline selfOnly form is pure JSON (no matcher closure).]
//   - 【宣言】 + 【ターン1】 => type:'declared' limit:{kind:'turn',n:1} [declared-ability.ts canDeclaredAbility enforces ability.limit.kind==='turn' via readChar.declaredUseCount (BUG-067). Same as D08026/D11021/B05083/B07062 a2 (all limit turn n:1). Case cards declare-enumerable because scope:'always' (findCardOnBoard handles uid 'case:self').]
//   - 【解決編】 + この能力は自分の現場に〚特徴［FBI］〛のキャラがいる場合に宣言できる => condition: and[ caseStatus '解決編', sceneHas{query:{area:'scene',side:'self',filter:{trait:'FBI'}},nMin:1} ] [EXACT structural match to D11021.ts a2 condition (and[caseStatus 解決編, sceneHas side:self trait '神奈川県警' nMin:1]). declared condition IS enforced: declared-ability.ts canDeclaredAbility evaluates ability.condition via evalCond (BUG-099 fix — the old 'never evaluates condition' state is now wired). caseStatus + sceneHas are real Condition kinds (cond/eval.ts; capability-map conditions section). FBI trait string verified as ASCII 'FBI' in data (B08053/D04xx traits:['FBI']; B05069.ts a2 uses sceneHas side:self trait 'FBI').]
//   - 〚裏向きの証拠を1つ表向きにする〛 (cost) => cost:{kind:'flipFaceUpEvidence', n:{min:1, max:1}} [flipFaceUpEvidence is a real Cost kind (capability-map cost section: payable if facedown>=min; pay throws if picked count not in [min,max]). FIXED-count variant grounded in B05083.ts a2 (min:3,max:3) and B07062.ts a2 (min:2,max:2); '1つ' (singular) => min:1,max:1. Cost paid by UI/AI dispatch (engine.cost.pay) before useDeclaredAbility runs effect. No dyn dependency here (delta is fixed -1), so no cost-dyn human-pick-boundary risk (unlike D08026/D11021 which need {dyn} scaling and a choice wrapper).]
//   - 相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する => effect: atom charModifyLevel {player:'self', max:1, side:'opp', delta:-1, scope:'turn'} (short-form pick) [EXACT match to B07103.ts/B07103P.ts/B05066.ts/B05066P.ts/B07093.ts/B07093P.ts a2 ('相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する' → charModifyLevel {player:'self',max:1,side:'opp',delta:-1,scope:'turn'}). charModifyLevel short-form confirmed in atom-handlers.ts case 'charModifyLevel' (line ~775): uid undefined + isShortFormDelta(delta) + hasNorMax => buildShortFormPick('scene',a,...) which reads a.side (atom-pick-spec.ts buildShortFormPick: side = a.side ?? sideDefault), a.max => n:{min:0,max:1} (0-pick legal = '1枚まで'). ATOM_PICK_SPEC.charModifyLevel = {defaultArea:'scene',mode:'PA',needs:'delta'}. B07103 is registered in _reuse/index.ts engine-extension #2 batch. Bare short-form atom (no choice wrapper) works with a cost — proven by B05083/B07062 a2 (cost flipFaceUpEvidence + bare short-form handAddFromRemove).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'always',
  trigger: {
    hook: 'case:to-resolved',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'discard',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: 'この事件が解決編になったとき、自分は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseStatus',
        status: '解決編'
      },
      {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self',
          filter: {
            trait: 'FBI'
          }
        },
        nMin: 1
      }
    ]
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'flipFaceUpEvidence',
    n: {
      min: 1,
      max: 1
    }
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: {
      player: 'self',
      max: 1,
      side: 'opp',
      delta: -1,
      scope: 'turn'
    }
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。この能力は自分の現場に〚特徴［FBI］〛のキャラがいる場合に宣言できる。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B07077: CardDef = {
  id: 'B07077',
  no: '0806/B07077',
  kind: 'case',
  names: [
    '揺れる心'
  ],
  colors: [
    '赤'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1762414027329888.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
