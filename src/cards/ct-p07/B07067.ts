// cards/ct-p07/B07067 沖矢昴 (キャラ) — engine変更0 (handCountAtLeastOther + sleepChar-pick + custom self-state gate)
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   a1:【パートナー赤】【登場時】相手の手札が自分の手札の枚数以上ある場合、レベル8以下のキャラを1枚まで選び、リムーブする。
//   a2:【宣言】【ターン1】〚レベル6以上の【赤】のキャラを1枚スリープさせる〛：レベル7以下のキャラを1枚まで選び、リムーブする。
//       この能力は自分の手札が2枚以下で、このキャラがスリープ状態かスタン状態の場合に宣言できる。
//
// 公式Q&A:
//   a1 Q: 手札から使用して登場させた場合、このカードは「自分の手札」に数える? A: いいえ。
//      → enter は手札除去後に発火 → handCountAtLeastOther 評価時に自カードは手札外。自動成立。
//   a1 Q: 相手と自分の手札が同枚数なら条件を満たす? A: はい。→ handCountAtLeastOther は >= 判定 (等枚数 true)。
//   a2 Q: コストの「スリープさせる」で相手のキャラを使える? A: いいえ。→ cost の pick は query.side:'self' で自陣のみ。
//
// 句マッピング:
//   a1:【パートナー赤】=> condition partnerColor:'赤' (rules/17 条件未充足=能力を持たない扱い、トリガ時 gate)。
//      【登場時】=> trigger{hook:'enter', selfOnly:true}。
//      「相手の手札が自分の手札の枚数以上ある場合」=> conditional if:handCountAtLeastOther{player:'opp'}
//         (handler: players[opp].hand.length >= players[self].hand.length。等枚数 true → qAndA 充足)。
//      「レベル8以下のキャラを1枚まで選び、リムーブする」=> sceneRemove 短縮形
//         {player:'self', max:1, side:'either', filter:{levelMax:8}} (max:1=0枚可 / side:'either'=両者現場 rules/15)。
//   a2:【宣言】=> type:'declared' (rules/21、アクティブ不要・名乗り可)。【ターン1】=> limit:{kind:'turn', n:1}。
//      宣言ゲート「自分の手札が2枚以下で、このキャラがスリープ状態かスタン状態」=>
//         condition and[ handAtMost{player:'self', n:2},
//                        custom( ctx.source.uid のキャラ state ∈ {sleep, stun} ) ]
//         (自己 state の declarative cond が無いため custom{check}。B07071 top-level custom + eval.ts charTurnEffect の
//          scene 走査同型で「このキャラ」を特定、推測補完ではない)。
//      cost〚レベル6以上の【赤】のキャラを1枚スリープさせる〛=> sleepChar pick
//         {area:'scene', side:'self', filter:{levelMin:6, color:'赤'}} n:{1,1} (B03060 a1 同型。side:'self'=自陣のみ qAndA。
//          cost は別キャラをスリープ → 自身が sleep/stun でも支払可 rules/21。「このキャラ以外」記載なし & 自身は
//          gate で sleep/stun=非 active のため sleepChar candidate に元々入らず excludeSelf 不要)。
//      「レベル7以下のキャラを1枚まで選び、リムーブする」=> sceneRemove {player:'self', max:1, side:'either', filter:{levelMax:7}}。

import type { AbilityDef, CardDef, GameState, EffectCtx } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー赤】(未充足なら能力を持たない扱い、rules/17)
  condition: { kind: 'partnerColor', color: '赤' },
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 相手の手札が自分の手札の枚数以上ある場合 (= 相手の手札 >= 自分の手札、等枚数も true)
    if: { kind: 'handCountAtLeastOther', player: 'opp' },
    // レベル8以下のキャラを1枚まで選び、リムーブする
    then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  },
  description: '【パートナー赤】【登場時】相手の手札が自分の手札の枚数以上ある場合、レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 宣言ゲート: 自分の手札が2枚以下 かつ このキャラがスリープ状態かスタン状態
  condition: {
    kind: 'and',
    cs: [
      { kind: 'handAtMost', player: 'self', n: 2 },
      {
        // このキャラ (ctx.source.uid) が sleep か stun の場合のみ宣言可 (rules/03 状態 / rules/24)。
        // 自己 state の declarative condition が無いため custom{check} で厳密判定。
        kind: 'custom',
        check: (s: GameState, ctx: EffectCtx) => {
          const uid = ctx.source?.uid;
          if (!uid) return false;
          for (const p of ['self', 'opp'] as const) {
            const ch = s.players[p].scene.find((c) => c.uid === uid);
            if (ch) return ch.state === 'sleep' || ch.state === 'stun';
          }
          return false;
        },
      },
    ],
  },
  // 〚レベル6以上の【赤】のキャラを1枚スリープさせる〛 (自分の現場のみ、qAndA: コストは自分のカードのみ)
  cost: {
    kind: 'sleepChar',
    target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { levelMin: 6, color: '赤' } }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
  // レベル7以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
  description: '【宣言】【ターン1】〚レベル6以上の【赤】のキャラを1枚スリープさせる〛：レベル7以下のキャラを1枚まで選び、リムーブする。この能力は自分の手札が2枚以下で、このキャラがスリープ状態かスタン状態の場合に宣言できる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/24-qa-naming-stun.md'],
};

export const B07067: CardDef = {
  id: 'B07067',
  no: '0796/B07067',
  kind: 'character',
  names: ['沖矢昴'],
  colors: ['赤'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['大学院生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1762414010647982.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
