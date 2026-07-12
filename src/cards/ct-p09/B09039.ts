// cards/ct-p09/B09039 中森青子 (character) — S1 defer-unlock (gateOnZero, 2026-07-11)
// rules: 03-field-areas.md (§パートナーエリア/リムーブ), 15-abilities-effects.md (§「まで」=0可),
//        17-icons.md (【登場時】【宣言】【ターン1】), 21-declared-ability-cost.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   【登場時】自分のパートナーエリアかリムーブエリアにある〚特徴［ビッグジュエル］〛のイベントを
//     1枚まで選び、手札に加える。
//   【宣言】【ターン1】手札からレベル5の〚特徴［ビッグジュエル］〛のイベントを1枚まで使用する。
//     使用した場合、自分のリムーブエリアにあるレベル3以下の【白】のキャラを1枚まで選び、手札に加える。
//     カードを手札に加えた場合、手札を1枚リムーブする。
//     （この効果を解決してからイベントの効果を解決する）
//
// 公式 qAndA (dossier .tmp/_ground/B09039.md):
//   Q:【宣言】能力でイベントを使用すると？ A:「手札の使用/ネクストヒント」同様に効果解決→リムーブ。
//   Q:アイコン条件を満たさないイベントを使用できる？ A:はい。レベル5の特徴[ビッグジュエル]なら使用可。
//     (アイコン条件未達の効果は何も起こらない = engine の condition gate に委譲)。
//
// 句マッピング:
//   a1【登場時】=> triggered on-scene hook:'enter' selfOnly。handAddFromRemove の area union
//     (remove ∪ partner-area、B07049 exemplar 同型) + filter{trait:'ビッグジュエル', kind:'event'}
//     (「イベント」限定) + n{min:0,max:1}=「1枚まで」(rules/15 0可)。cardIds:'$pick.cardIds' 契約。
//   a2【宣言】【ターン1】=> declared on-scene limit{turn,1}、cost なし (テキストに「:」無し)。
//     chain[
//       useEventFromHand{max:1, filter:{event, trait ビッグジュエル, levelIn:[5]}} — 「レベル5の」= EXACT 5。
//         0 使用 (候補0/辞退) → handler が chainStepNoApply → 後続 skip (「使用した場合」gate)。
//       handAddFromRemove{cardIds 契約, gateOnZero:true, filter:{character, 白, levelMax:3}, n 0-1} —
//         「レベル3以下の【白】のキャラを1枚まで」。0 加え (候補0/辞退) → gateOnZero が chainStepNoApply →
//         discard skip (「カードを手札に加えた場合」gate、S1 wave core.ts atomHandAddFromRemove Array path)。
//       discard{n:1} — 「手札を1枚リムーブ」。
//     ]
//     括弧書き「この効果を解決してからイベントの効果を解決する」= useEventFromHand は event-use を emit
//     (効果は queue) し chain は同期継続 = ability 効果 (handAdd/discard) が先に解決 → 使用イベント効果は後 =
//     rules/25 B08020 裁定 (engine 既定順序) と一致。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      cardIds: '$pick.cardIds',
      target: {
        kind: 'pick',
        query: { area: ['remove', 'partner-area'], side: 'self', filter: { trait: 'ビッグジュエル', kind: 'event' } },
        n: { min: 0, max: 1 }, // 「1枚まで」= 0可 (rules/15)
        chooser: 'self',
      },
    },
  },
  description:
    '【登場時】自分のパートナーエリアかリムーブエリアにある〚特徴[ビッグジュエル]〛のイベントを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'chain',
    steps: [
      // 手札からレベル5の[ビッグジュエル]イベントを1枚まで使用 (0使用 → chain break)
      {
        kind: 'atom',
        verb: 'useEventFromHand',
        args: { player: 'self', max: 1, filter: { kind: 'event', trait: 'ビッグジュエル', levelIn: [5] } },
      },
      // 使用した場合: リムーブのレベル3以下の【白】キャラを1枚まで選び手札に加える
      // (gateOnZero: 0加えなら discard skip — 「カードを手札に加えた場合」gate)
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          cardIds: '$pick.cardIds',
          gateOnZero: true,
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'character', color: '白', levelMax: 3 } },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
      // カードを手札に加えた場合: 手札を1枚リムーブ
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '【宣言】【ターン1】手札からレベル5の〚特徴[ビッグジュエル]〛のイベントを1枚まで使用する。使用した場合、自分のリムーブエリアにあるレベル3以下の【白】のキャラを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。（この効果を解決してからイベントの効果を解決する）',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B09039: CardDef = {
  id: 'B09039',
  no: '0982/B09039',
  kind: 'character',
  names: ['中森青子'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608856067925.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
