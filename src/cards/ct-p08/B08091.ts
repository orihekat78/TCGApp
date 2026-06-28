// cards/ct-p08/B08091 マッドサイエンティスト (character) — engine変更0 wave (triage-verify, 2026-06-28)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
//
// 公式テキスト:
//   【事件青＆黒】【登場時】自分の現場に【黒】以外の色を持つキャラがいる場合、自分のリムーブエリアにある
//     【現場リムーブ時】を持つレベル6以下のキャラを1枚まで選び、スリープ状態で登場させる。
//   【相手ターン中】【現場リムーブ時】自分の表向きの証拠を1つまで選び、裏向きにする。
//
// 句マッピング (verified twin = B02066 a1/a2 / B05091 a2 / B06017 a2 / B02010 colorNot / D06010 caseColor-and / B08005 keyword-filter):
//   - a1 【事件青＆黒】= ability.condition caseColor{color:['青','黒'], combine:'and'} (D06010 同型)。
//     【登場時】= trigger{hook:'enter', selfOnly:true}。
//     「自分の現場に【黒】以外の色を持つキャラがいる場合」= conditional{if: sceneHas{query{area:'scene', side:'self',
//        filter:{colorNot:'黒'}}, nMin:1}} (colorNot=some説: 黒以外の色を1色でも持つ、B02010 同型)。
//     「リムーブエリアの【現場リムーブ時】持ちレベル6以下を1枚までスリープ登場」= sceneEnter{from:'remove', max:1,
//        enterSleep:true, filter:{keyword:'現場リムーブ時', levelMax:6, kind:'character'}} (B05091/B02066 from:remove + B08005 keyword filter)。
//     ※公式Q&A:【現場リムーブ時】は印字静的判定 (能力有効/相手ターン中かどうか問わず) = keyword filter は ability 構造を見るため一致。
//     ※conditional が PA短縮形 sceneEnter を包む形は BUG-145 非該当 (PA pick は初期 walk 非可視・runtime surface)。
//   - a2 【相手ターン中】【現場リムーブ時】= trigger{hook:'leave:to-remove', selfOnly:true} + condition turn:opp。
//     「自分の表向き証拠を1つまで裏向きに」= evidenceFlipDown{player:'self', max:1, faceUp:true} (B06017 a2 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'caseColor', color: ['青', '黒'], combine: 'and' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { colorNot: '黒' } }, nMin: 1 },
    then: {
      kind: 'atom',
      verb: 'sceneEnter',
      args: { player: 'self', from: 'remove', max: 1, viaEffect: true, enterSleep: true, filter: { keyword: '現場リムーブ時', levelMax: 6, kind: 'character' } },
    },
  },
  description: '【事件青＆黒】【登場時】自分の現場に【黒】以外の色を持つキャラがいる場合、自分のリムーブエリアにある【現場リムーブ時】を持つレベル6以下のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'evidenceFlipDown', args: { player: 'self', max: 1, faceUp: true } },
  description: '【相手ターン中】【現場リムーブ時】自分の表向きの証拠を1つまで選び、裏向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/17-icons.md'],
};

export const B08091: CardDef = {
  id: 'B08091',
  no: '0927/B08091',
  kind: 'character',
  names: ['マッドサイエンティスト'],
  colors: ['黒'],
  level: 7, ap: 5000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'C',
  imageUrl: '1770731270536755.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
