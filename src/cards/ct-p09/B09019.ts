// cards/ct-p09/B09019 「くさるなよ！」 (イベント) — M2後半 batch (2026-07-10, sceneEnter multi bind first-consumer)
// rules: 12-next-hint.md, 15-abilities-effects.md, 20-color-and-switch.md, 25-qa-effects-resolution.md
// grounding: .claude/specs/grounding/B09019.md
//
// 公式テキスト:
//   自分のFILEエリアにあるカードを上から1枚リムーブし、自分の現場にいる〚カード名［結成 少年探偵団］〛を
//   1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル4以下のそれぞれカード名の異なる
//   〚特徴［少年探偵団］〛のキャラを5枚まで選び、スリープ状態で登場させる。この効果によってキャラが
//   5枚登場した場合、キャラを1枚まで選び、リムーブする。このターン中、自分はネクストヒントできない。
//
// 句マッピング:
//   本体 = triggered on-hand effect:declared matcher kind==='event-use' (B09034/D08024 イベント同型)。
//   - 「…してもよい。そうした場合、…」=> optional{effect: chain[...]} (D04007 同型)。
//     chain = step no-op で break: fileRemoveTop 0枚 (core.ts chain break) / 結成不在 → 後続不成立 (安全側)。
//   - 「FILE上から1枚リムーブ」=> fileRemoveTop n:1 (アシストパートナー skip 内蔵、公式Q&A 一致)。
//   - 「現場の[結成 少年探偵団]を1枚リムーブ」=> sceneRemove n:{min:1,max:1} filter cardName
//     (名前書換キャラも該当 — cardName filter は grantNames honor、公式Q&A 一致)。
//   - 「リムーブのレベル4以下・カード名相異[少年探偵団]を5枚まで選び、スリープ状態で登場」=>
//     sceneEnter from:'remove' + cardIds:'$pick.cardIds' 契約 (短縮形 N>1 collapse 罠 — 必須) +
//     enterSleep:true + distinctNames + n:{min:0,max:5} + bind:'$entered' (M2後半 multi 経路 bind —
//     実登場のみ計数、scene-full-skip 分は含まない)。効果登場でも【登場時】発動 (per-card emit、Q&A 一致)。
//   - 「この効果によってキャラが5枚登場した場合」=> conditional boundCountCompare{$entered, eq, 5}
//     (印字「5枚」= eq が忠実) → sceneRemove 短縮形 (「キャラを1枚まで」= 側指定なし・0枚可 rules/15)。
//   - 「このターン中、自分はネクストヒントできない」=> setNextHintBan (turn-scoped flag、
//     resetTurnFlags でターン境界解除)。
//   ⚠ スイッチ Q&A「この効果で登場させるキャラをリムーブ不可」— switchRemoveUids は既存 scene から
//     UI が事前収集 (満杯ケースは playwright 実踏対象)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { kind?: unknown }).kind === 'event-use';
    },
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // FILEエリアのカードを上から1枚リムーブ (0枚なら chain break — 後続不成立)
        { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'self', n: 1 } },
        // 現場の[結成 少年探偵団]を1枚リムーブ (不在なら chain break)。短縮形 n:1 = {min:1,max:1} 必須 pick
        { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'self', filter: { cardName: '結成 少年探偵団' }, n: 1, cause: 'effect' } },
        // そうした場合: 5枚まで登場 → 5枚登場なら 1枚リムーブ → ネクストヒント禁止
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self',
                from: 'remove',
                cardIds: '$pick.cardIds',
                enterSleep: true,
                viaEffect: true,
                bind: '$entered',
                target: {
                  kind: 'pick',
                  query: { area: 'remove', side: 'self', distinctNames: true, filter: { trait: '少年探偵団', levelMax: 4, kind: 'character' } },
                  n: { min: 0, max: 5 },
                  chooser: 'self',
                },
              },
            },
            {
              kind: 'conditional',
              if: { kind: 'boundCountCompare', bindKey: '$entered', cmp: 'eq', n: 5 },
              then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character' }, cause: 'effect' } },
            },
          ],
        },
      ],
    },
      },
      // 「このターン中、自分はネクストヒントできない」— optional の外 (無条件)。印字上「そうした場合」節に
      // 属さない独立文 = rules/15「〜する」必須効果。decline / FILE0 chain break でも ban は立つ
      // (semantic lens NIT → 裁定 2026-07-10: 字義優先)。
      { kind: 'atom', verb: 'setNextHintBan', args: { player: 'self' } },
    ],
  },
  description:
    '自分のFILEエリアにあるカードを上から1枚リムーブし、自分の現場にいる〚カード名［結成 少年探偵団］〛を1枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル4以下のそれぞれカード名の異なる〚特徴［少年探偵団］〛のキャラを5枚まで選び、スリープ状態で登場させる。この効果によってキャラが5枚登場した場合、キャラを1枚まで選び、リムーブする。このターン中、自分はネクストヒントできない。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B09019: CardDef = {
  id: 'B09019',
  no: '0964/B09019',
  kind: 'event',
  names: ['「くさるなよ！」'],
  colors: ['青'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1775608819021818.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
