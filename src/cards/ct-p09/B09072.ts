// cards/ct-p09/B09072 横溝重悟 (キャラ) — engine変更0 (wave-8 shippuFiredThisTurn flag 初 consumer + carrier-reuse)
// rules: 10-action-event.md(ヒラメキ), 11-reasoning.md(推理不可), 13-keywords.md(疾風), 14-refresh.md,
//        15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【登場時】このターン中、自分のキャラの【疾風】が発動していた場合、自分のデッキのカードを上から2枚
//     リムーブし、カードを1枚引く。
//   【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：〚特徴［神奈川県警］〛のキャラを1枚まで選び、
//     アクティブにし、ターン終了時まで「このキャラは推理できない。」を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//   公式Q&A: デッキ残り1枚で「上から2枚リムーブ→1枚引く」→ 可能な限り(全部)リムーブ→リフレッシュ→
//            残り枚数はリムーブせず「1枚引く」を解決 (mill の refresh-then-remainder 挙動と一致)。
//
// 句マッピング:
//   [effect col a1] 「【登場時】…【疾風】が発動していた場合、デッキ上から2枚リムーブし、1枚引く」
//     => a1 triggered enter(selfOnly)。effect = conditional{ if:{kind:'flag',player:'self',
//        key:'shippuFiredThisTurn',v:true}, then: sequence[ mill{player:self,n:2}, draw{player:self,n:1} ] }。
//        - flag Condition = wave-8 (2026-07-02) 出荷の汎用 flag (listeners/triggered.ts が実 疾風発動時に
//          owner 側 turnState.shippuFiredThisTurn=true)。本カードが**初の consumer** (wave-8 primitive の生きた E2E)。
//        - 横溝自身は非疾風(【登場時】)ゆえ自 enter は flag を立てない → 「他キャラの疾風が先に発動していたか」を読む。
//        - mill{n:2} = 「デッキ上から2枚リムーブ」= mutate.deck.removeFromTop + deck0 で refresh (rules/14/26)。
//          gate 無し (無条件「リムーブし」= not「そうした場合」chain)。deck<2 は QA 通り (可能な限り→refresh→draw)。
//   [effect col a2] 「【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：神奈川県警を1枚まで選び、
//        アクティブにし、ターン終了時まで推理不可を与える」
//     => a2 declared/turn1。cost pay[sleepSelf(=【スリープ】), removeFromHand n:1(=〚手札を1枚リムーブ〛)]。
//        effect = carrier-reuse sequence (B02005/B03088 と同型、短縮形必須):
//          step1 sceneSetState carrier {player:'self', max:1, side:'either', filter:{trait:'神奈川県警'},
//                 state:'active', bind:'$picked'} = 「神奈川県警を1枚まで選び、アクティブにし」(max:1=0枚可 rules/15)。
//                 ★side:'either' = 印字に「自分の」修飾が無い unscoped「〚特徴［神奈川県警］〛のキャラを選び」
//                 → rules/15「area/side 無指定はどちらの現場でも選択可・自身も可」(B05096/B03017 は side 省略=default
//                 either、B06067 a2 は明示 either)。実プレイでは相手キャラ選択は strictly self-harmful (相手 active化は
//                 相手ガード枠を増やし、cannotReason は自 endTurn で失効し相手推理に届かない) だが text fidelity で either。
//                 PA 短縮形 carrier は runtime paShortFormAwait で pick surface → runAtom preamble が
//                 ctx.bindings['$picked'] に書込 (verb 非依存、charModifyAP carrier と同機序)。
//          step2 charSetTurnEffect rider {uid:'$picked.uid', key:'cannotReason', val:true} = 「推理不可を与える」。
//                 resolveBindRef が $picked.uid を解決 → cannotReason(素キー)=turn-scope (clearTurnEffects('turn')
//                 が endTurn で delete、rules/11 canReason gate は wave-8 出荷)。0枚 decline → $picked 未束縛 → no-op。
//        ※ wave-8 DEFER「sceneSetState/charSetTurnEffect は bind 非対応」は誤診断だった (実機 AI/human/decline
//          3 経路 probe で carrier+rider の成立を確認、DEFERRED-INDEX 該当節を訂正)。
//   [hira col a3] 「【ヒラメキ】カードを1枚引く」 => a3 triggered on-evidence + trigger evidence:remove-by-action
//        optional + draw{player:self,n:1} (D01003/D01006 hirameki-draw と VERBATIM。optional=発動/不発 選択 rules/10)。
//   [cutIn col] 空 / [henso col] 空 → 未カバー句なし。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'flag', player: 'self', key: 'shippuFiredThisTurn', v: true },
    then: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 2 } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description: '【登場時】このターン中、自分のキャラの【疾風】が発動していた場合、自分のデッキのカードを上から2枚リムーブし、カードを1枚引く。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', filter: { trait: '神奈川県警' }, state: 'active', bind: '$picked' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'cannotReason', val: true } },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】〚手札を1枚リムーブする〛：〚特徴［神奈川県警］〛のキャラを1枚まで選び、アクティブにし、ターン終了時まで「このキャラは推理できない。」を与える。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B09072: CardDef = {
  id: 'B09072',
  no: '1012/B09072',
  kind: 'character',
  names: ['横溝重悟'],
  colors: ['黄'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1775608890179374.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/10-action-event.md', 'rules/11-reasoning.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
