// cards/ct-p09/B09084 羽鳥警部 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/01-victory-conditions.md
// 公式テキスト:
//   【事件編】【疾風】ターン終了時までこのキャラは〚突撃［事件］〛を持つ。（自分の現場にこのターンで1番に登場したときに発動する）\n【解決編】【登場時】このキャラをリムーブしてもよい。そうした場合、カードを2枚引き、手札を1枚リムーブする。
// 句マッピング:
//   - 【事件編】 => condition {kind:'caseStatus',status:'事件編'} [caseStatus condition honored in cond/eval.ts (capability-map §Case/partner); exemplar src/cards/ct-p05/B05089.ts a2 uses {kind:'caseStatus',status:'解決編'} as 6-stage condition gate on an enter-triggered ability; D08019.ts a1 same]
//   - 【疾風】/（自分の現場にこのターンで1番に登場したときに発動する） => trigger {hook:'enter',selfOnly:true,matcherCondition:{kind:'enterOrderEquals',n:1}} [enter hook is card-triggerable (TRIGGERED_HOOKS, hooks ref); enterOrderEquals reads payload.enterOrderThisTurn (capability-map §Trigger-payload). Exemplars src/cards/ct-d11/D11003.ts a1 and D11014.ts a1 use exactly {hook:'enter',selfOnly:true,matcherCondition:{kind:'enterOrderEquals',n:1}} for 疾風]
//   - ターン終了時までこのキャラは〚突撃［事件］〛を持つ => atom charGrantKeyword {uid:'$self',kw:'突撃[事件]',scope:'turn'} [charGrantKeyword wired in src/engine/mutate/char.ts grantKeyword (scope:'turn' → turnEffects['grantedKeywords']) and read back in src/engine/read/char.ts keywords() (BUG-092). Exemplars: src/cards/ct-p09/B09037.ts a3, ct-p05/B05089.ts a2, ct-d11/D11015.ts a2, ct-p07/B07016.ts all use {uid:'$self',kw:'突撃[事件]',scope:'turn'}. kw string '突撃[事件]' (ASCII brackets) is the canonical code form]
//   - 【解決編】 => condition {kind:'caseStatus',status:'解決編'} [caseStatus condition (cond/eval.ts); exemplar src/cards/ct-d08/D08019.ts a1 and ct-p05/B05089.ts a2 gate enter-trigger with {kind:'caseStatus',status:'解決編'}]
//   - 【登場時】 => trigger {hook:'enter',selfOnly:true} [enter hook (hooks ref). Exemplar src/cards/ct-p07/B07021.ts a2 / ct-p05/B05089.ts a2 use {hook:'enter',selfOnly:true} for 【登場時】]
//   - このキャラをリムーブしてもよい。そうした場合、… => effect {kind:'optional',effect:{kind:'sequence',steps:[sceneRemove($self), …]}} [optional wrapper honored (resolver.run; resolve-picks human surface pendingEffectOptional). sceneRemove {uid:'$self',cause:'effect'} self-remove confirmed in src/cards/ct-p05/B05019.ts a1 (optional → sequence whose first step is sceneRemove uid:'$self'), ct-p07/B07021.ts a1, ct-p03/B03114.ts. rules/15: 発動キャラが現場を離れても後続効果は継続 (sequence steps independent)]
//   - カードを2枚引き => atom draw {player:'self',n:2} [draw verb args {player,n:number} (capability-map §Draw); exemplars use draw {player:'self',n:1} (B07021 a2, D11014 a2); n:2 is the same shape with n=2]
//   - 手札を1枚リムーブする => atom discard {player:'self',n:1} [discard verb args {player,target?,n?/max?,filter?} (capability-map §Draw); exemplar src/cards/ct-d11/D11014.ts a2 uses {kind:'atom',verb:'discard',args:{player:'self',n:1}} for 「手札を1枚リムーブする」. Player picks which hand card → tier-2 pick surface]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '事件編'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcherCondition: {
      kind: 'enterOrderEquals',
      n: 1
    }
  },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: {
      uid: '$self',
      kw: '突撃[事件]',
      scope: 'turn'
    }
  },
  description: '【事件編】【疾風】ターン終了時までこのキャラは〚突撃［事件］〛を持つ。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'caseStatus',
    status: '解決編'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            uid: '$self',
            cause: 'effect'
          }
        },
        {
          kind: 'atom',
          verb: 'draw',
          args: {
            player: 'self',
            n: 2
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
  description: '【解決編】【登場時】このキャラをリムーブしてもよい。そうした場合、カードを2枚引き、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B09084: CardDef = {
  id: 'B09084',
  no: '1024/B09084',
  kind: 'character',
  names: [
    '羽鳥警部'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: [
    '警察',
    '警視庁'
  ],
  rarity: 'C',
  imageUrl: '1775608910366490.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/01-victory-conditions.md'
  ],
};
