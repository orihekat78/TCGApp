// cards/ct-p09/B09048 中森銀三 (character) — engine mega-wave W4 r6 exemplar (sceneStackUnderSelf cost, 2026-07-03)
// rules: 15-abilities-effects.md (してもよい/まで), 16-card-set.md (重ねる), 17-icons.md (【事件色&色】),
//        20-color-and-switch.md (効果登場は色制限 exempt / スイッチ), 21-declared-ability-cost.md
//
// 公式テキスト:
//   【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の
//   【黄】の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。
//   【事件白＆黄】【宣言】〚現場にいるレベル6以上の【黄】の特徴［警察］のキャラを1枚このキャラの下に
//   重ねる〛：レベル6以下のキャラを1枚まで選び、リムーブする。
//
// a1: 「してもよい。そうした場合」= chain (rules/25)。discard max:1 → sceneEnter from:'remove'
//     (B04090 同型、viaEffect=色制限 exempt +【登場時】発火 + スイッチは engine が処理 — 公式Q&A:
//     リムーブした手札カード自身も (解決時 remove に在るので) 選べる / 現場5枚でもスイッチ登場可)。
//     enterSleep:true =「スリープ状態で登場」。
// a2: 【事件白＆黄】= caseColor and (rules/17「&」= 両色必須)。cost = sceneStackUnderSelf (W4 r6、
//     levelMin:6 —「レベル6以上」。mutate.scene.toStack 非リムーブ離場 + MR 非redirect 公式Q&A)。
//     effect「レベル6以下のキャラを1枚まで選び、リムーブする」= sceneRemove side:'either' (rules/15
//     無修飾「キャラ」= どちらの現場でも)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'chain',
    steps: [
      // 手札を1枚リムーブしてもよい
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      // そうした場合、リムーブエリアのレベル6以下【黄】[警察] を1枚まで選び、スリープ状態で登場
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'remove',
          viaEffect: true,
          enterSleep: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', levelMax: 6, color: '黄', trait: '警察' } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【登場時】手札を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下の【黄】の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/25-qa-effects-resolution.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  // 【事件白＆黄】= 自分の事件が白と黄を両方持つ (rules/17)
  condition: { kind: 'caseColor', color: ['白', '黄'], combine: 'and' },
  // 〚現場にいるレベル6以上の【黄】の特徴［警察］のキャラを1枚このキャラの下に重ねる〛
  cost: {
    kind: 'sceneStackUnderSelf',
    n: 1,
    target: {
      kind: 'pick',
      query: { area: 'scene', side: 'self', filter: { kind: 'character', levelMin: 6, color: '黄', trait: '警察' } },
      n: { min: 1, max: 1 },
      chooser: 'self',
    },
  },
  // レベル6以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', levelMax: 6 }, cause: 'effect' } },
  description: '【事件白＆黄】【宣言】〚現場にいるレベル6以上の【黄】の特徴［警察］のキャラを1枚このキャラの下に重ねる〛：レベル6以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/16-card-set.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09048: CardDef = {
  id: 'B09048',
  no: '0991/B09048',
  kind: 'character',
  names: ['中森銀三'],
  colors: ['白'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608856188046.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
