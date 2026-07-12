// cards/ct-p09/B09105 キッ (event) — S1 defer-unlock (requireActive / requireExact / distinctLevel, 2026-07-11)
// rules: 03-field-areas.md, 12-next-hint.md, 15-abilities-effects.md (§「まで」=0可/してもよい),
//        17-icons.md (§条件アイコン未達=持たない扱い), 20-color-and-switch.md (§スイッチ), 25-qa-effects-resolution.md
//
// ※カード名: cards-data TSV 第3列が 'キッ' (source データ側で truncate 済) — dossier 準拠で 'キッ' を採用。
//
// 公式テキスト:
//   【事件犯人】自分のパートナーをスリープさせ、手札を1枚リムーブし、自分のFILEエリアにあるカードを
//   上から2枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下でそれぞれレベルの
//   異なる〚特徴［犯人］〛のキャラを5枚まで選び、登場させる。このターン中、自分はネクストヒントできない。
//
// 公式 qAndA (dossier .tmp/_ground/B09105.md):
//   Q:【事件犯人】は？ A:自分の事件が特徴[犯人]を持つ場合に有効 (= condition{caseTrait '犯人'} gate)。
//   Q:パートナーがスリープ状態でも使用できる？ A:使用は可能だが「〜してもよい」を全て実行できない場合、
//     以降の効果は解決できない (= partnerSetState requireActive gate)。
//   Q:FILE が1枚の場合、それをリムーブして以降を解決できる？ A:いいえ。全て実行できない → 以降不解決
//     (= fileRemoveTop requireExact gate、n:2 未満で chain break)。
//   Q:FILE のアシスト済パートナーをリムーブできる？ A:いいえ (= fileRemoveTop はパートナー skip 内蔵)。
//   Q:能力/効果で登場したキャラの【登場時】は発動する？ A:はい (= sceneEnter viaEffect、per-card emit)。
//   Q:ネクストヒントで使用できる？ A:はい。
//
// 句マッピング:
//   本体 = triggered on-hand effect:declared matcher kind==='event-use' (B09019/B09034 イベント同型) +
//     condition{caseTrait '犯人'} (【事件犯人】= triggered listener が発火前に gate、triggered.ts:352-366)。
//   effect = sequence[
//     optional{ chain[
//       partnerSetState{state:'sleep', requireActive:true} — 「パートナーをスリープさせ」。既スリープなら
//         requireActive が chainStepNoApply → 以降 skip (Q&A: 全実行不可なら以降不解決)。
//       discard{n:1} — 「手札を1枚リムーブ」。手札0なら resolve-picks が候補0 → chainStepNoApply。
//       fileRemoveTop{n:2, requireExact:true} — 「FILE を上から2枚リムーブ」。2枚未満なら requireExact が
//         chainStepNoApply (リムーブ自体は可能な限り実行 = rules/15、以降のみ gate = Q&A FILE=1)。
//       sceneEnter{from:'remove', distinctLevel:true, filter{character, 犯人, levelMax:8}, n 0-5,
//         cardIds 契約} — 「レベル8以下でそれぞれレベルの異なる[犯人]を5枚まで選び登場」。distinctLevel は
//         apply-pick greedy dedup (同レベル skip)。「そうした場合」= chain 継続 (前段 gate 波及)。
//     ]},
//     setNextHintBan — 「このターン中、自分はネクストヒントできない」。
//   ]
//   ⚠ ban 文の位置: 印字は「〜してもよい。そうした場合、〜登場させる。このターン中、〜できない。」で、
//     ban 文は「そうした場合」節に従属しない独立文 (rules/15「〜する」必須効果) → optional の**外**
//     (sequence 末尾)。qAndA に ban を「そうした場合」に括る裁定は無く、B09019 同型の裁定 (字義優先、
//     decline/gate でも ban は立つ) に従う。
//   ⚠ スイッチ既知 nit (qAndA): 「スイッチでは、このイベントの効果によって登場させるキャラをリムーブ
//     できません」— switchRemoveUids の victim 収集は UI/AI 側 (現場満杯経路) の既存挙動に委ねる。本 probe
//     は現場非満杯で検証 (5枚 room 十分)。満杯 switch 制約は playwright 実踏対象。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【事件犯人】= 自分の事件が特徴[犯人]を持つ (未達なら listener が発火せず = rules/17 持たない扱い)
  condition: { kind: 'caseTrait', trait: '犯人' },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown } | null)?.kind === 'event-use',
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            // パートナーをスリープさせ (既スリープなら requireActive gate → 以降 skip)
            { kind: 'atom', verb: 'partnerSetState', args: { player: 'self', state: 'sleep', requireActive: true } },
            // 手札を1枚リムーブ (手札0なら候補0 → chain break)
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
            // FILE を上から2枚リムーブ (2枚未満なら requireExact gate → 以降 skip)
            { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'self', n: 2, requireExact: true } },
            // そうした場合: レベル8以下・レベル相異の[犯人]を5枚まで選び登場
            {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self',
                from: 'remove',
                cardIds: '$pick.cardIds',
                viaEffect: true,
                target: {
                  kind: 'pick',
                  query: { area: 'remove', side: 'self', distinctLevel: true, filter: { kind: 'character', trait: '犯人', levelMax: 8 } },
                  n: { min: 0, max: 5 },
                  chooser: 'self',
                },
              },
            },
          ],
        },
      },
      // このターン中、自分はネクストヒントできない (optional の外 = 独立文・無条件)
      { kind: 'atom', verb: 'setNextHintBan', args: { player: 'self' } },
    ],
  },
  description:
    '【事件犯人】自分のパートナーをスリープさせ、手札を1枚リムーブし、自分のFILEエリアにあるカードを上から2枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル8以下でそれぞれレベルの異なる〚特徴[犯人]〛のキャラを5枚まで選び、登場させる。このターン中、自分はネクストヒントできない。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

export const B09105: CardDef = {
  id: 'B09105',
  no: '1044/B09105',
  kind: 'event',
  names: ['キッ'],
  colors: ['黒'],
  level: 8,
  traits: [],
  rarity: 'C',
  imageUrl: '1775608943972817.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
