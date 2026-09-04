// cards/ct-p07/B07058 「私があなたの心を…盗んであげる…」 (イベント) — 赤魔術 trait family (engine変更0)
// rules: 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【事件赤魔術】自分のリムーブエリアにあるレベル3以下の【白】のキャラを1枚まで選び、登場させる。
//   ターン終了時までそのキャラをAP＋3000し、〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定して
//   アクションできる）を与え、自分のデッキのカードを上から1枚裏向きでそのキャラにセットする。
// 公式Q&A: 【事件赤魔術】= 自分の事件が特徴［赤魔術］を持つ場合に有効。効果で登場したキャラの【登場時】も
//   発動する (このイベント効果を解決してから解決)。
//
// 句マッピング (B05090.ts a1 完全同型の sceneEnter bind:$entered → boundMatchesFilter gate → $entered.uid 適用):
//   - 【事件赤魔術】 = condition caseTrait{赤魔術} (B07062 が caseTraits:[赤魔術] を持つ — 本 family で投入)。
//   - リムーブのレベル3以下【白】キャラを1枚まで登場 = sceneEnter {from:'remove', cardId:'$pick.cardId',
//     viaEffect, bind:'$entered', target:pick(remove,self,filter{color:白,levelMax:3,kind:character},n:0-1)}
//     (B05090 a1 = from:hand 版 / D10011 a1 = from:remove filter色levelMax の混成)。「1枚まで」=0OK。
//   - 登場した「そのキャラ」へ適用 (entered 不在なら skip) = conditional boundMatchesFilter{$entered,kind:character}:
//     · ターン終了時までAP＋3000 = charModifyAP{$entered.uid, +3000, turn} (B05090 同型)
//     · 〚突撃［キャラ］〛を与える = charGrantKeyword{$entered.uid, '突撃[キャラ]', turn}
//       (action.ts:55 が突撃[キャラ]を名乗り例外 + アクション[キャラ]許可で認識)
//     · デッキ上から1枚裏向きでそのキャラにセット = charSetCard{$entered.uid, fromDeckTop, faceUp:false}
//       (B02020/B08054 同型 fromDeckTop。bound uid path は scUid 解決後に deck.shift → setCard)

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // 【事件赤魔術】(自分の事件が特徴[赤魔術]を持つ場合に有効)
  condition: { kind: 'caseTrait', trait: '赤魔術' },
  effect: {
    kind: 'sequence',
    steps: [
      // リムーブのレベル3以下[白]キャラを1枚まで選び、登場させる
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'remove',
          cardId: '$pick.cardId',
          viaEffect: true,
          bind: '$entered',
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { color: '白', levelMax: 3, kind: 'character' } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
      // 登場した「そのキャラ」が居る場合のみ、AP+3000(turn) / 突撃[キャラ](turn) / デッキ上端を裏向きセット
      {
        kind: 'conditional',
        if: { kind: 'boundMatchesFilter', bindKey: '$entered', filter: { kind: 'character' } },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'charModifyAP', args: { uid: '$entered.uid', delta: 3000, scope: 'turn' } },
            { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$entered.uid', kw: '突撃[キャラ]', scope: 'turn' } },
            { kind: 'atom', verb: 'charSetCard', args: { uid: '$entered.uid', fromDeckTop: true, faceUp: false } },
          ],
        },
      },
    ],
  },
  description:
    '【事件赤魔術】リムーブのレベル3以下[白]キャラを1枚まで登場させ、ターン終了時までAP＋3000・突撃[キャラ]付与・デッキ上端を裏向きでセット。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B07058: CardDef = {
  id: 'B07058',
  no: '0787/B07058',
  kind: 'event',
  names: ['「私があなたの心を…盗んであげる…」'],
  colors: ['白'],
  level: 6,
  // 特徴 (公式 category1 由来): 赤魔術。TSV 抽出が event の category(特徴) を全件 drop していたため要明示。
  traits: ['赤魔術'],
  rarity: 'C',
  imageUrl: '1762414010611491.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
