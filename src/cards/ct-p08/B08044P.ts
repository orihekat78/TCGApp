// cards/ct-p08/B08044P 江戸川コナン誘拐事件 (case) — Task A green候補 (engine変更0)
// rules: rules/01-victory-conditions.md, rules/16-card-set.md, rules/21-declared-ability-cost.md, rules/17-icons.md
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。\n【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
// 句マッピング:
//   - この事件が解決編になったとき、自分は手札を1枚リムーブする。 => __shared caseResolvedHandRemove({n:1}) — type:'triggered', scope:'always', trigger hook 'case:to-resolved' (matcher player==='self') → effect choice→atom discard pick n{min:1,max:1} from hand [src/cards/_shared/caseResolvedHandRemove.ts (exact match: 'この事件が解決編になったとき、自分は手札を${n}枚リムーブする'). case:to-resolved is a card-triggerable hook (brief). caseStatus/discard verified: capability-map.txt L548 (discard) + cond/eval.ts:74 caseStatus. caseToResolved atom emits hook (capability-map L474).]
//   - 【解決編】 (条件) => condition:{kind:'caseStatus',status:'解決編'} [src/engine/cond/eval.ts:74-76 returns state.players[owner].case.status === cond.status. Used by shared caseDeclaredEvidenceFlip.ts (baseCond). capability-map.txt L110 lists caseStatus in declared Condition union.]
//   - 【宣言】【ターン1】 (宣言能力, 1ターン1回) => type:'declared', scope:'always', limit:{kind:'turn',n:1} [src/cards/ct-p02/B02030.ts a2 (declared + limit turn1 + charSetCard short-form). case-card declared must use scope:'always' per src/cards/_shared/caseDeclaredEvidenceFlip.ts comment (case area; on-scene弾かれる).]
//   - 〚裏向きの証拠を1つ表向きにする〛 (コスト) => cost:{kind:'flipFaceUpEvidence', n:{min:1,max:1}} [src/engine/cost/evaluate.ts:63-66 payable if facedown>=n.min; src/engine/cost/pay.ts:119-135 flips picked indices, validates count∈[min,max], records costPaid. types/effect.ts:142 type {kind:'flipFaceUpEvidence';n:{min,max}}. Text says '1つ' → max:1 (vs shared min1/maxInf for '1つ以上').]
//   - 自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。 => effect atom charSetCard short-form {player:'self', max:1, side:'self', fromDeckTop:true, faceUp:false} → scene-char PA pick (n max1 = 1枚まで/0OK), then shift self deck top, setCard faceUp:false [EXACT exemplar src/cards/ct-p02/B02030.ts a2 args {player:'self',max:1,side:'self',fromDeckTop:true,faceUp:false} (official text '自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする'). Engine src/engine/effect/atom-handlers.ts:864-913: uid absent + fromDeckTop + player + n/max → buildShortFormPick('scene',...) chooser=controller; deck.shift from a.player('self'); mutate.char.setCard faceUp:false. Also B02023.ts, B08054.ts.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '@/cards/_shared';

const a1 = caseResolvedHandRemove({
  n: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
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
    verb: 'charSetCard',
    args: {
      player: 'self',
      max: 1,
      side: 'self',
      fromDeckTop: true,
      faceUp: false
    }
  },
  description: '【解決編】【宣言】【ターン1】〚裏向きの証拠を1つ表向きにする〛：自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: [
    'rules/16-card-set.md',
    'rules/21-declared-ability-cost.md',
    'rules/01-victory-conditions.md'
  ]
};

export const B08044P: CardDef = {
  id: 'B08044P',
  no: '0883/B08044P',
  kind: 'case',
  names: [
    '江戸川コナン誘拐事件'
  ],
  colors: [
    '白'
  ],
  caseTraits: [],
  traits: [],
  rarity: 'CP',
  imageUrl: '1770878966488277.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/16-card-set.md',
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md'
  ],
};
