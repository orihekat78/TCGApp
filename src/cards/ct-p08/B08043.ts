// cards/ct-p08/B08043 手のこんだ悪巧み (イベント) — engine additive wave-14 (G16 残 relative-LP filter, 2026-07-02)
// rules: 03-field-areas.md, 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md
//
// 公式テキスト:
//   相手の現場にいるキャラを1枚まで選ぶ。そのキャラが自分の現場にいるLPがもっとも高いキャラのLP以下のLPの場合、リムーブする。
//
// 公式Q&A:
//   Q: 元のLPから能力や効果によって増減しているキャラは、どのLPを参照しますか？
//   A: 効果を解決する時点の（能力や効果によって増減した状態の）LPを参照します。 → 実効LP比較 (charRead.lp)。
//   Q: 自分の現場にキャラがいない場合、選んだキャラをリムーブできますか？
//   A: いいえ。その場合は条件を満たさず、リムーブできません。 → 現場0枚で sceneMaxLp=-Infinity → 候補0。
//
// 句マッピング:
//   イベント使用      => ability.type:'triggered' scope:'on-hand' trigger{hook:'effect:declared', selfOnly, matcher kind==='event-use'} (D01014 同型)
//   相手の現場にいるキャラを1枚まで選ぶ。そのキャラが…LP以下のLPの場合、リムーブする
//                     => sceneRemove 短縮形 {player:'self', max:1, side:'opp', cause:'effect',
//                        filter:{ lpMax:{dyn:'$self.sceneMaxLp'} }}
//     - 「自分の現場でLPがもっとも高いキャラのLP以下」= lpMax=$self.sceneMaxLp (wave-14 新 dyn。ctx.source.player
//       の現場実効LP最大値)。resolveFilterDynObj が pick 列挙前に literalize → matchOneFilter が対象の実効LP と
//       突合 (G15 B09096 の apMin/apMax:{dyn:'$self.ap'} と同経路、engine 変更は dyn case 追加のみ = 純 additive)。
//     - 「1枚まで」= max:1 / n.min:0 (0枚可、rules/15)。side:'opp' = 相手現場のみ (rules/03 現場=scene)。
//     - cause:'effect' → 「コンタクトによってリムーブされない」効果を貫通 (rules/08、能力/効果リムーブ)。
//     - 現場0枚 → sceneMaxLp=-Infinity → lpMax:-Infinity で全候補除外 (公式Q&A リムーブ不可と整合)。LP は
//       下限なし (rules/19、マイナス可) だが -Infinity 以下は存在しないため負値の相手も除外される。
//     - 「選ぶ→場合リムーブ」の filter 化: 非該当キャラを選んでも何も起きない = strictly-dominated ゆえ、
//       lpMax filter で該当キャラのみ選択可能にしても到達可能な盤面は同一 (B09096「同じAP」と同じ collapse)。

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
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'opp',
      cause: 'effect',
      filter: { lpMax: { dyn: '$self.sceneMaxLp' } },
    },
  },
  description:
    '相手の現場にいるキャラを1枚まで選ぶ。そのキャラが自分の現場にいるLPがもっとも高いキャラのLP以下のLPの場合、リムーブする。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
  ],
};

export const B08043: CardDef = {
  id: 'B08043',
  no: '0882/B08043',
  kind: 'event',
  names: ['手のこんだ悪巧み'],
  colors: ['白'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1770731222614385.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
