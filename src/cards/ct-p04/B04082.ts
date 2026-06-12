// cards/ct-p04/B04082 米原桜子 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【ターン1】自分の現場にいる〚カード名［千葉和伸］〛がアクションしたとき、自分のリムーブエリアにある〚カード名［三池苗子］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【ターン1】 => AbilityDef.limit:{kind:'turn',n:1} [limit:{kind:'turn',n:1} on triggered ability; enforced per uid+abilityId via declaredUseCount (capability-map hooks §How a triggered ability fires; §B). Exemplar: src/cards/ct-p04/B04039.ts a1 uses same limit on action:declare trigger.]
//   - 自分の現場にいる〚カード名［千葉和伸］〛がアクションしたとき => trigger:{hook:'action:declare', matcherCondition:{kind:'triggerCharMatches',side:'self',filter:{cardName:'千葉和伸'}}} (NOT selfOnly; bearer reacts to another self-side char's action) [action:declare emits payload {byUid,target,uid:byUid,player:byPlayer} (src/engine/flow/action/state-machine.ts:194). triggerCharMatches (src/engine/cond/eval.ts:230-244) reads payload.uid+payload.player, gates side:'self' => payload.player===ctx.source.player (attacker on owner side), then runs full matchOneFilter against the scene char honoring cardName. Exact exemplar: src/cards/ct-p04/B04039.ts a1 (matcherCondition triggerCharMatches side:'self' filter:{cardName:'白馬探'} on action:declare; ワトソン reacts to 白馬探's action). I drop B04039's multi-hook hooks:['reasoning:end'] since this card triggers on アクション only.]
//   - 自分のリムーブエリアにある〚カード名［三池苗子］〛を1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{cardName:'三池苗子', kind:'character'}} [handAddFromRemove handler (src/engine/effect/atom-handlers.ts:425-450): target undefined + n|max present => buildShortFormPick(defaultArea='remove', a, p, p). buildShortFormPick (src/engine/effect/atom-pick-spec.ts) with max:1 (no n) => nMin:0,nMax:1 = '1枚まで' (0-pick legal), propagates filter into pick query; side defaults to self; uses canonical candidates/matchOneFilter path so cardName is honored. Exact exemplar: src/cards/ct-p02/B02004.ts a2 (handAddFromRemove {player:'self',max:1,filter:{cardName:'工藤新一',kind:'character'}}).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      filter: {
        cardName: '千葉和伸'
      }
    }
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        cardName: '三池苗子',
        kind: 'character'
      }
    }
  },
  description: '【ターン1】自分の現場にいる〚カード名［千葉和伸］〛がアクションしたとき、自分のリムーブエリアにある〚カード名［三池苗子］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B04082: CardDef = {
  id: 'B04082',
  no: '0467/B04082',
  kind: 'character',
  names: [
    '米原桜子'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '家政婦'
  ],
  rarity: 'C',
  imageUrl: '1735287841251576.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ],
};
