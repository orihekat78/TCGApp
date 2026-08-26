// cards/ct-p07/B07104 ミステリーコースター (event) — engine変更0 wave (triage-verify+fix, 2026-06-28)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー黒】キャラを1枚まで選び、リムーブする。キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンから
//     すぐにアクションできる）を与える。自分と相手の現場にいるキャラ1枚につき、自分のデッキのカードを上から2枚リムーブする。
//
// 句マッピング (verified twin = B04017 sceneRemove短縮形 / charGrantKeyword短縮形(PA, ATOM_PICK_SPEC) / B02083 forEach over:all + mill):
//   - 【パートナー黒】= ability.condition partnerColor{color:'黒'} (B02083 同型)。
//   - イベント自己使用トリガ = trigger{hook:'effect:declared', selfOnly:true, matcher:(p)=>p.kind==='event-use'} (B08075/B02083 同型)。
//   - clause1「キャラを1枚まで選びリムーブ」= sceneRemove 短縮形{player:'self', max:1, side:'either', cause:'effect'} (エリア指定なし=両現場 rules/15)。
//   - clause2「キャラを1枚まで選びターン終了まで突撃付与」= charGrantKeyword 短縮形{player:'self', kw:'突撃', scope:'turn', max:1, side:'either'}。
//     ★短縮形必須 (uid:'$pick'+target 明示形は sequence 内で初期 walk push → human 経路で clause1 より先に pick surface
//      = 印字順逆転 BUG-158)。短縮形は paShortFormAwait の runtime push で clause1→clause2→clause3 の正順 surface。
//   - clause3「自分と相手の現場のキャラ1枚につきデッキ上2枚リムーブ」= aggregate mill
//     n:{dyn:'($self.sceneCount + $self.oppSceneCount) * 2'}。clause1 解決後の盤面を1回数え、
//     atom mill 1回で可能な限りリムーブ→refresh→停止する (rules/14・26、公式Q&A)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: { kind: 'partnerColor', color: '黒' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', kw: '突撃', scope: 'turn', max: 1, side: 'either' } },
      { kind: 'atom', verb: 'mill', args: { player: 'self', n: { dyn: '($self.sceneCount + $self.oppSceneCount) * 2' } } },
    ],
  },
  description: '【パートナー黒】キャラを1枚まで選び、リムーブする。キャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。自分と相手の現場にいるキャラ1枚につき、自分のデッキのカードを上から2枚リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const B07104: CardDef = {
  id: 'B07104',
  no: '0831/B07104',
  kind: 'event',
  names: ['ミステリーコースター'],
  colors: ['黒'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1762414041060117.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};
