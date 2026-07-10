// cards/ct-p07/B07102 犯人 (character) — DEFER 解禁 GREEN batch (engine変更0, 2026-07-11)
// rules: 02-deck-construction.md, 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【登場時】手札から【カットイン】を持つ【黒】のカードを好きな枚数リムーブし、リムーブした枚数と同じ枚数のカードを引く。
//
// 句マッピング:
//   - 【登場時】 => trigger hook:'enter' + selfOnly (「このキャラが登場したとき」rules/17。効果/能力による
//                  登場でも発動)。scope:'on-scene'。
//   - 手札から【カットイン】を持つ【黒】のカードを好きな枚数リムーブし
//       => discard{ player:'self', bind:'$discarded',
//                   target:{ pick, query:{ area:'hand', side:'self',
//                     filter:{ color:'黒', cutinTextIncludes:'' } }, n:{min:0,max:99}, chooser:'self' } }
//          「【黒】のカード」= filter color:'黒'。
//          「【カットイン】を持つ」= filter cutinTextIncludes:'' — defHasCutinTextIncludes(def,'') は
//            cutin ability の description に '' が含まれるか (常に true) で「cutin を印字所持」を判定
//            (read/keyword.ts:34, abilityIsCutin gate)。text 内容を問わない汎 has-cutin フィルタ。
//            ★ Q&A「(【解決編】等の) 条件によって効果が有効ではない【カットイン】を持つ【黒】のカードを
//               リムーブできるか → はい」= 所持判定は印字 (静的) で、条件アイコン充足を問わない
//               (rules/17 Q&A「〜の能力を持つ 参照は印字で判定」と整合)。cutinTextIncludes は
//               def ベース (印字) 判定ゆえ条件成立/不成立に依存しない → Q&A 裁定に一致。
//          「好きな枚数」= n{min:0,max:99} (0 枚も可、rules/15「〜まで」= 0 可。B08068 同型 max:99)。
//          「リムーブ」= discard (手札→リムーブエリア)。multi-pick は resolve-picks 汎用 Pattern B
//            (BUG-165, nMax>1 greedy/human surface) が target 配列を埋める。bind = リムーブ cardId 群。
//   - リムーブした枚数と同じ枚数のカードを引く
//       => draw{ player:'self', n:{ dyn:'$bound.$discarded.count' } }
//          「リムーブした枚数と同じ枚数」= $bound.<key>.count (bind '$discarded' 集合の枚数、dyn/eval.ts:508)。
//          0 枚リムーブ時は bind 未設定 → resolveBound が [] → count 0 → draw 0 (no-op)。
//          ★ Q&A「カードを引く途中でデッキがなくなった場合、手札からリムーブしたカードもリフレッシュに
//             含まれるか → はい」= discard は draw より先に完了しリムーブエリアへ (chain step 順序)。
//             リフレッシュ (rules/14) 時にリムーブ済カードはシャッフル対象に含まれる (mutate.deck.draw 内で担保)。
//   - chain: step1 discard(pick+bind) → step2 draw(dyn count)。B05040 (discard{bind:'$discarded'} → dyn)
//            と同 idiom (pick 停止をまたいで bind を継続 ctx へ運ぶ carrier)。「リムーブした枚数と同じ」の
//            data 依存を step 間 bind で結ぶ。0 枚リムーブでも draw 0 に落ちる (count fallback)。
//   exemplar: discard{bind} + $discarded 参照 = src/cards/ct-p05/B05040.ts / $bound.<key>.count dyn =
//             src/cards/ct-p04/B04048.ts a1 / cutinTextIncludes filter = src/cards/ct-d06/D06003.ts /
//             「好きな枚数」max:99 = src/cards/ct-p08/B08068.ts。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札から【カットイン】を持つ【黒】のカードを好きな枚数リムーブし
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          bind: '$discarded',
          target: {
            kind: 'pick',
            query: { area: 'hand', side: 'self', filter: { color: '黒', cutinTextIncludes: '' } },
            n: { min: 0, max: 99 },
            chooser: 'self',
          },
        },
      },
      // リムーブした枚数と同じ枚数のカードを引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: { dyn: '$bound.$discarded.count' } } },
    ],
  },
  description:
    '【登場時】手札から【カットイン】を持つ【黒】のカードを好きな枚数リムーブし、リムーブした枚数と同じ枚数のカードを引く。',
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};

export const B07102: CardDef = {
  id: 'B07102',
  no: '0829/B07102',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 5,
  ap: 3000,
  lp: 1,
  traits: ['犯人'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762414041042061.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
