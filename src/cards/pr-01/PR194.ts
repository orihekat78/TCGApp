// cards/pr-01/PR194 灰原哀 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/14-refresh.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【宣言】〚リムーブエリアに移す〛：自分のデッキのカードを上から2枚見る。その中からカードを1枚手札に加え、残りを好きな順番でデッキの下に移す。
// 句マッピング:
//   - 【宣言】 => ability.type='declared', scope='on-scene' [B01048.ts a1 / B07051.ts a1 / B04009.ts a1 全て type 'declared' scope 'on-scene'。canDeclaredAbility が cost.canPay でゲート (cost/evaluate.ts)。]
//   - 〚リムーブエリアに移す〛 (cost、対象省略=このキャラ自身, rules/21) => cost:{ kind 'removeFromScene', target:{kind 'self'}, n:1 } [B04009.ts a1 と B05018.ts a1 が exactly この cost を実出荷 (『〚リムーブエリアに移す〛(対象省略 → このキャラ自身 / rules/21)』)。pay.ts:66-73 removeFromScene が pickCandidates(self,n=1) → mutate.scene.removeToRemove(uid,'cost') で自身をリムーブエリアへ。candidates.ts:351 self ref は {min:1,max:1} 決定論。evaluate.ts canPay は candidates>=n で payable (active 不要なので char 状態問わず宣言可)。]
//   - 自分のデッキのカードを上から2枚見る => atom deckRevealUntil { player:'self', maxN:2, filter:()=>true, bind:'$revealed', bindMatch:'$matched' } [B01048.ts a1 step1 と同形 (maxN 3→2 のみ差替)。atom-handlers.ts:1410-1424 maxN 分岐: lookN=min(deck,maxN) を全件 reveal → filter で最初の match を matched に採用。filter なし(全カード)は filter:()=>true (B01048) または filter 省略 (targetFilterToPredicate(undefined)===()=>true, atom-handlers.ts:66)。]
//   - その中からカードを1枚手札に加え (filter 無=任意の1枚、強制取得) => conditional{ if bound $matched matched, then handAddFromDeck{$matched.cardId} } [B01048.ts a1 step2 と完全同型 (filter なし=全カード一致 → matched=先頭カード)。handAddFromDeck (atom-handlers.ts:29 / capability-map L29 'B01048' 引用) が deck→hand。『1枚加え』(まで無し)=強制型: chooseMatch 非指定で先頭 match を自動取得 (B01048 と同じ shipped 近似、modal 非表示)。]
//   - 残りを好きな順番でデッキの下に移す => atom deckToBottomBound { player:'self', bindKey:'$revealed' } [B01048.ts a1 step3 と同型。atom-handlers.ts:1488-1503 が matched を $revealed から除外 (1枚取得後の残り = 2-1 = 1枚) → deckToBottomBound (atom-handlers.ts:68) が deck 下へ。残り1枚のため『好きな順番で』の player-chosen reorder gate (STILL-OPEN, memory 13947) は非該当 (1枚は順序一意で固定順=任意順と等価)。]
//   - バニラ stats / cutIn・hirameki・henso 空 / 印字キーワード無し => keywords:[], abilities:[a1] [.tmp/taskA/recs/PR194.json で cutIn/hirameki/henso 全て空。effect に 迅速/突撃/疾風/ブレット の印字アイコン無し → keywords:[] (B01048 と同じ)。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'removeFromScene',
    target: {
      kind: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          player: 'self',
          maxN: 2,
          bind: '$revealed',
          bindMatch: '$matched'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'bound',
          key: '$matched',
          presence: 'matched'
        },
        then: {
          kind: 'atom',
          verb: 'handAddFromDeck',
          args: {
            player: 'self',
            cardId: '$matched.cardId'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'deckToBottomBound',
        args: {
          player: 'self',
          bindKey: '$revealed'
        }
      }
    ]
  },
  description: '【宣言】〚リムーブエリアに移す〛：自分のデッキのカードを上から2枚見る。その中からカードを1枚手札に加え、残りを好きな順番でデッキの下に移す。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const PR194: CardDef = {
  id: 'PR194',
  no: '0728/PR194',
  kind: 'character',
  names: [
    '灰原哀'
  ],
  colors: [
    '青'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    '少年探偵団',
    '科学者'
  ],
  rarity: 'PR',
  imageUrl: '1764290716014172.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/14-refresh.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
