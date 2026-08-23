// cards/ct-p03/B03025 「え？取材？」 (event) — Task A green候補 (engine変更0)
// rules: rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   自分のデッキのカードを上から5枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［少年探偵団］〛のキャラを1枚まで登場させる。
// 句マッピング:
//   - (イベント使用) このイベントを手札の使用/ネクストヒントで使用したとき => type 'triggered' scope 'on-hand' trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [src/cards/ct-d01/D01014.ts a1 (near-exact structural twin) と src/cards/ct-p02/B02053.ts a1 が同型 trigger を使用。codegen scripts/taskA-codegen.cjs:112-126 が __eventUse:true → matcher closure (p)=>p?.kind==='event-use' に変換 (validate-specs.cjs:136 はインライン matcher closure を禁止し __eventUse 必須)。pure JSON 維持 → needsManual:false。]
//   - 自分のデッキのカードを上から5枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え => deckRevealUntil{chooseMatch:'upTo', player:'self', filter:{trait:'少年探偵団', kind 'character'}, maxN:5, bind:'$revealed', bindMatch:'$matched'} → conditional(bound $matched matched){ handAddFromDeck{player:'self', cardId:'$matched.cardId'} } [src/cards/ct-d01/D01014.ts a1 と src/cards/ct-p09/B09073.ts a2 が同一 shape (color/keyword 違いのみ)。atom-handlers.ts:1336 deckRevealUntil handler: maxN 指定時 min(deck,maxN) を全件 reveal し最初の filter match を $matched、残りを $revealed に bind。capability-map.txt:67 deckRevealUntil predicate path は trait/kind を honor (cardName/keyword は不可だが trait は OK)。'1枚まで'=chooseMatch:'upTo'=0枚可 (官方Q&A 'はい、可能です' decline 可、rules/15)。]
//   - 残りをリムーブエリアに移す => boundToRemove{player:'self', bindKey:'$revealed'} [src/engine/effect/atom-handlers.ts:1536 boundToRemove case — bound window ($revealed 公開分) をデッキから splice して mutate.remove.add、移送後 deck0 なら mutate.deck.refresh。validate.ts:36 / effect.ts:169 に登録済 (live engine、cap-map STALE だが brief inventory に記載)。src/cards/ct-p09/B09073.ts a2 が「残りをリムーブエリアに移す」を同 verb で実装 (handler コメントが本パターンを明記)。官方Q&A『残りをリムーブエリアに移す』まで解決した時点でリフレッシュ = handler の deck0→refresh と一致。]
//   - 手札からレベル6以下の〚特徴［少年探偵団］〛のキャラを1枚まで登場させる => sceneEnter{player:'self', from:'hand', max:1, viaEffect:true, filter:{trait:'少年探偵団', levelMax:6, kind 'character'}} [src/cards/ct-d01/D01014.ts a1 末尾 sceneEnter{from:'hand', max:1, viaEffect:true, filter:{...levelMax...}} と同型 (本カードは levelMax 静的 6 / dyn 不要)。capability-map.txt:33 sceneEnter は from 短縮形で source-area pick を生成。src/engine/target/candidates.ts:142 case 'hand' が hand-area candidate を構築、matchOneFilter が trait(:268-271)/kind(:291)/levelMax(:320-321) を honor。viaEffect:true=効果による登場で事件色制限を受けない (rules/20、官方Q&A『条件を満たしているキャラであれば可能』色指定なし)。max:1='1枚まで'=0枚可 (官方Q&A『登場させないことはできますか→はい』)。加えた以外のキャラも登場可 (官方Q&A) = hand 全体から filter pick で整合。]

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          filter: {
            trait: '少年探偵団',
            kind: 'character'
          },
          maxN: 5,
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
            cardId: '$matched.cardId',
            deferRefresh: true
          }
        }
      },
      {
        kind: 'atom',
        verb: 'boundToRemove',
        args: {
          player: 'self',
          bindKey: '$revealed',
          refreshAfter: true
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'hand',
          max: 1,
          viaEffect: true,
          filter: {
            trait: '少年探偵団',
            levelMax: 6,
            kind: 'character'
          }
        }
      }
    ]
  },
  description: '自分のデッキのカードを上から5枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［少年探偵団］〛のキャラを1枚まで登場させる。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B03025: CardDef = {
  id: 'B03025',
  no: '0283/B03025',
  kind: 'event',
  names: [
    '「え？取材？」'
  ],
  colors: [
    '青'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133201286193.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
