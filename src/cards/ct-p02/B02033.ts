// cards/ct-p02/B02033 死力を尽くして (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   自分の現場にいるキャラにセットされているカードを合わせて2枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - (イベント自己使用トリガ) このイベントを手札の使用/ネクストヒントで使用したとき効果本文が発動する => trigger {hook 'effect:declared', selfOnly:true, __eventUse:true}, scope 'on-hand' [src/cards/ct-p02/B02053.ts a1 / ct-p01/B01076.ts a1 / ct-p03/B03025.ts a1 が同型 event-use trigger。__eventUse:true は scripts/taskA-codegen.cjs が matcher:(p)=>p?.kind==='event-use' に変換し純JSON維持。emit: src/engine/flow/main/hand-use-card.ts (event→'event-use') + next-hint.ts。gate: src/engine/listeners/triggered.ts selfOnlyMatches(on-hand=payload.cardId 一致)+matcher。]
//   - 〜してもよい (clause 全体を辞退可) => optional ラッパ (top-level ability effect) [resolver.ts:126 case 'optional' (ctx.dyn.optionalRun のときのみ実行)。top-level optional ability の前例 = src/cards/ct-p09/B09013.ts a2 (effect:{kind 'optional',effect:{kind 'chain',...}})。brief DSL規約「〜してもよい=optional」。]
//   - 自分の現場にいるキャラにセットされているカードを合わせて2枚リムーブ => charRemoveSetCard n:2 + minimumPolicy:'exact'。物理set-card occurrenceを2件選ぶため、同一ホストから2枚でも複数ホストから1枚ずつでもよい。B02033は表裏を問わない。
//   - そうした場合 (前段の set-card 除去が起きたときのみ後段へ) => chain (step1 が effect を生まなければ step2 skip) [resolver.ts chain (前段成功時のみ後段)。no-candidate/skip 時 resolve-picks.ts が __chainStepNoApply を立て chain break。前例: B07055.ts a1 / B07031.ts a2 / B08034.ts a2 (chain[charRemoveSetCard, …])。brief「そうした場合=chain」。]
//   - キャラを1枚まで選び、リムーブする (filter無=任意キャラ、両現場、1枚まで=0OK) => atom sceneRemove {player:'self', max:1, side:'either'} [src/cards/ct-p07/B07031.ts a2 clause1 が完全同一 (sceneRemove{player:'self',max:1,side:'either'} filter無)。engine: scene.ts atomSceneRemove → PA短縮形、cause 既定 'effect'。max:1/min:0='1枚まで'(0枚skip=silent no-op)。side:'either'= エリア指定無の「キャラ」=両現場(rules/15)。filter 省略=候補は両現場全キャラ。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'charRemoveSetCard',
          args: {
            player: 'self',
            side: 'self',
            n: 2,
            minimumPolicy: 'exact',
            filter: {
              hasSetCards: true
            }
          }
        },
        {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either'
          }
        }
      ]
    }
  },
  description: '自分の現場にいるキャラにセットされているカードを合わせて2枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B02033: CardDef = {
  id: 'B02033',
  no: '0203/B02033',
  kind: 'event',
  names: [
    '死力を尽くして'
  ],
  colors: [
    '緑'
  ],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357211037265.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
