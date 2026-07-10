// cards/ct-p06/B06037 服部平次＆沖田総司 (character/MR) — M3 PA batch (2026-07-10)
// rules: rules/03-field-areas.md, rules/07-action-flow.md, rules/13-keywords.md,
//        rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md,
//        rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［高校生］〛のキャラが登場したとき、
//     AP8000以下のキャラを1枚まで選び、リムーブする。
//   【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいるキャラを1枚まで選び、ターン終了時まで
//     AP＋1000し、「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - MR => rarity:'MR' (read/def.ts isMr = rarity.startsWith('MR')。MR core 出荷済 rules/18)。
//   - 複数名カード (rules/19「＆」) => names 分割 ['服部平次＆沖田総司','服部平次','沖田総司']。
//   - a1「【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［高校生］〛のキャラが登場したとき」=>
//     trigger{hook:'enter', matcherCondition:{triggerCharMatches, side:'self', payloadKey:'uid',
//     excludeSource:true, filter:{trait:'高校生', kind:'character'}}} (B08062/B07066 a1 同型 —
//     このキャラ以外 = excludeSource:true / enter payload に player 無 → payloadKey:'uid')。
//     【自分ターン中】= condition{turn:self} (B08062 は partnerColor と and だが本カードは単独) /
//     【ターン1】= limit turn1。
//   - a1「AP8000以下のキャラを1枚まで選び、リムーブする」=> sceneRemove{side:'either', max:1,
//     cause:'effect', filter:{apMax:8000}} (B08062 a1 同型。「キャラ」= 両現場 rules/15、「まで」= 0枚可)。
//   - a2「【宣言】【ターン1】〚手札を1枚リムーブする〛」=> declared + limit turn1 +
//     cost removeFromHand{target pick hand/self, n{1,1}} (D02013 a1 同型。フィルタ無 = 任意の手札1枚)。
//   - a2「自分の現場にいるキャラを1枚まで選び、ターン終了時までAP＋1000し」=> charModifyAP 短縮形
//     {side:'self', max:1, delta:1000, scope:'turn', bind:'$picked'} (B07090 a1 step2 同型。
//     「自分の現場にいるキャラ」= side:'self'。明示 uid:'$pick'+target 形は禁止 BUG-130)。
//   - a2「『このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。』を与える」=>
//     charSetTurnEffect{uid:'$picked.uid', key:'actionTargetsActive', val:true} (B07090 a1 step3 /
//     B08037 a1 同型。clearTurnEffects('turn') で ターン終了時に失効 = 公式Q&A。名乗り制限は engine
//     独立 = 登場ターンにアクションするには突撃/迅速が別途必要 — 公式Q&A)。
//   - a2「この能力はパートナーエリアでも宣言できる」=> scope:'on-partner-area' (B06003 a2 同型)。
//     a1 は PA 句なし → scope:'on-scene'。
//   - 【カットイン】AP＋2000 => a3 (D01011/B06003 a3 同型。on-hand + effect:declared + $contact.byUid + scope:'contact')。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分の現場にこのキャラ以外の〚特徴［高校生］〛のキャラが登場したとき
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      excludeSource: true,
      filter: { trait: '高校生', kind: 'character' },
    },
  },
  // 【自分ターン中】
  condition: { kind: 'turn', player: 'self' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // AP8000以下のキャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } },
  },
  description:
    '【自分ターン中】【ターン1】自分の現場にこのキャラ以外の〚特徴［高校生］〛のキャラが登場したとき、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚手札を1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいるキャラを1枚まで選び、ターン終了時までAP＋1000し (短縮形 carrier + bind:'$picked')
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'self', delta: 1000, scope: 'turn', bind: '$picked' } },
      // 「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える (ターン終了時まで)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'actionTargetsActive', val: true } },
    ],
  },
  description:
    '【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいるキャラを1枚まで選び、ターン終了時までAP＋1000し、「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B06037: CardDef = {
  id: 'B06037',
  no: '0660/B06037',
  kind: 'character',
  names: ['服部平次＆沖田総司', '服部平次', '沖田総司'],
  colors: ['緑'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1751538660405743.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
