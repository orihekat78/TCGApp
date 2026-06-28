// cards/ct-p06/B06058 庄之介 (character) — engine変更0 (DEFERRED-INDEX 誤分類訂正、session65 解禁)
//   旧 DEFER 理由「sceneSetState 短縮形 side:'self' が hardcoded 'either' で無視」は STALE/誤り:
//   atom-pick-spec.ts:88 が `side ?? sideDefault` で authored side を尊重 (出荷実証 PR199/B03004/B07056/PR101)。
//   旧 DEFER 理由「optional gate 喪失 (discard0 でも activate)」も authoring 不備で engine gap ではない:
//   正しい形 optional{chain[discard, sceneSetState]} が PR199 option1 で出荷済 (同一文「そうした場合」、3 decline 経路で gate 尊重)。
// rules: rules/01-victory-conditions.md, rules/03-field-areas.md, rules/10-action-event.md, rules/11-reasoning.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の〚カード名［鉄刃］〛を1枚まで選び、アクティブにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【解決編】 => a1.condition {kind:'caseStatus', status:'解決編'} [exact shape src/cards/ct-p07/B07012.ts a1 / cond/eval.ts:74。条件未達=能力を持たない (rules/17)]
//   - 【登場時】 => a1.trigger {hook:'enter', selfOnly:true}, scope:'on-scene' [exemplar B07012.ts a1 / B08016.ts a1。enter emit source=登場キャラ (BUG-146) で selfOnly が自身の【登場時】に一致]
//   - 手札を1枚リムーブしてもよい。そうした場合、…アクティブにする => a1.effect optional{chain[discard{player:'self',n:1}, sceneSetState{max:1,side:'self',state:'active',filter:{cardName:'鉄刃',lpMin:0,lpMax:0}}]}
//       [byte-identical 文を src/cards/pr-01/PR199.ts option1 が同形で出荷済 (cardName 毛利小五郎→鉄刃 のみ差)。
//        optional=「してもよい」(全体 decline 可)。chain=「そうした場合」gate: discard step が no-apply (手札0 or decline) なら chain 中断→activate 不発
//        (resolve-picks.ts:277 chainStepNoApply→resolver.ts:101-104 break / apply-pick.ts:214-215 chain-origin head は head.remainder skip)。
//        sceneSetState Pattern-A 短縮形: player:'self'(=chooser, 短縮形gate必須 scene.ts:348 `typeof a.player==='string'`) + side:'self'(候補側, buildShortFormPick `side ?? 'either'`)。
//        exemplar PR199.ts:82 option1 (player:'self'+side:'self'+filter cardName/LP0) / D11003 a3 (player:'self'+side+state:'active')。本カードは PR199 option1 と同形 (cardName 毛利小五郎→鉄刃)。
//        state:'active' VERBATIM D11003.ts a3。'LP0'=lpMin:0+lpMax:0 (有効LPちょうど0) VERBATIM D11012.ts a1 / B05019.ts a1。
//        cardName 分割名は matchOneFilter で honored (candidates.ts allCardNameComponentsForDef)。
//        ★B06058 Q&A: 効果解決時点で有効LPが0でないキャラは選べない (元LP0が効果でLP1+/マイナス化) → lpMin:0+lpMax:0 が解決時 effective LP を見るので一致。
//        ★Q&A: スタン状態のキャラを active 化→スリープになる (rules/03、mutate.scene.setState engine-side)。再アクティブ化で同ターン再推理/再action 可。]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => a2 {type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action', optional:true}} [canonical ヒラメキ (rules/10)。exemplar B07012.ts a2 / B04037.ts a2]
//   - 自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える => a2.effect handAddFromRemove{player:'self', max:1, filter:{kind:'event', trait:'YAIBA'}}
//       [filter {kind:'event', trait:X} = リムーブエリアのイベント (kind:'event' でキャラ混入防止 BUG-123)。EXACT shape src/cards/ct-p07/B07062.ts:38 (filter:{kind:'event', trait:'赤魔術'})。
//        max:1 => n:{min:0,max:1}='1枚まで'(0可、rules/15)。trait は matchOneFilter で honored。]
//   - cutIn / henso (印字なし) => (absent)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        {
          kind: 'atom',
          verb: 'sceneSetState',
          // player:'self' 必須: atom-handlers/scene.ts:348 短縮形 gate が `typeof a.player==='string'` を要求
          //   (無いと uid 不在で no-op に落ちる)。player=chooser, side='self'=候補側 (buildShortFormPick: side ?? 'either')。
          //   exemplar = PR199.ts:82 option1 (同形) / D11003 a3 (player:'self'+side)。
          args: { player: 'self', max: 1, side: 'self', state: 'active', filter: { cardName: '鉄刃', lpMin: 0, lpMax: 0 } },
        },
      ],
    },
  },
  description: '【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の[カード名:鉄刃]を1枚まで選び、アクティブにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/11-reasoning.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { kind: 'event', trait: 'YAIBA' } },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある[特徴:YAIBA]のイベントを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md'],
};

export const B06058: CardDef = {
  id: 'B06058',
  no: '0679/B06058',
  kind: 'character',
  names: ['庄之介'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 0,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1754285220513267.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
