// cards/ct-p08/B08087 吞口重彦 (character) — engine mega-wave W2b exemplar (r27/P50, 2026-07-03)
// rules: 03-field-areas.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ。
//   【相手ターン中】【現場リムーブ時】自分の表向きの証拠を1つまで選び、裏向きにする。
//
// 句マッピング:
//   a1: 「相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ」
//       => continuous self-scope flag continuousModifier.mustBeSelectedByOppEvent:true (W2b 新 primitive)。
//       effect-pick の全 selection site (resolve-picks human push / AI 同期 walk / apply-pick chooseAiPick)
//       が forced-inclusion を enforce。「選べる場合」= 候補集合に入っている場合のみ (公式Q&A、
//       候補外 filter 不一致は強制しない)。「現場にいる場合に有効」(公式Q&A) = read.char.selfContinuousFlag
//       が scene.byUid のみ走査で自動整合。「相手が使用したイベントの効果」= ctx.triggerPayload
//       kind==='event-use' + cardId 一致 gate (手札の使用/ネクストヒント経路のみ。キャラ能力・
//       カットイン・イベント印字の【ヒラメキ】・第三者 reaction 由来 pick は非該当 — 混成 review
//       blocker 反映)。2枚以上/好きな数 = forced 全含、
//       1枚まで × flag 2枚 = min(forced, nMax) 枚に clamp してどちらか選択 (公式Q&A)。
//   a2: 【相手ターン中】【現場リムーブ時】自分の表向きの証拠を1つまで選び、裏向きにする
//       => B08091 マッドサイエンティスト a2 と byte 同型 clone: trigger{hook:'leave:to-remove',
//       selfOnly:true} + condition{turn:opp} + evidenceFlipDown{player:'self', max:1, faceUp:true}。
//       公式Q&A「どの順番に置かれている証拠でも選べる」= evidenceFlipDown の faceUp 候補列挙と整合。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { mustBeSelectedByOppEvent: true },
  description: '相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'],
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

export const B08087: CardDef = {
  id: 'B08087',
  no: '0923/B08087',
  kind: 'character',
  names: ['吞口重彦'],
  colors: ['黒'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['政治家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731255859432.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
