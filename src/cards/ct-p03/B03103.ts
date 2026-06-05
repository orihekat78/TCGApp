// cards/ct-p03/B03103 ヤンチャな5人組 (イベント) — catalog-reuse batch
// rules: 03-field-areas.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【パートナー黄】相手の現場にいるキャラを1枚まで選び、スタンさせる。
//   （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   自分の現場にキャラが5枚以上いる場合、代わりにそのキャラをリムーブする。
//
// a1: イベント使用時 (effect:declared / kind:'event-use')。【パートナー黄】を ability condition で gate。
//     自分の現場のキャラが5枚以上なら「代わりにリムーブ」、それ以外はスタン。
//     条件は board count (pick 非依存) なので effect-level conditional で表現し、
//     実行される branch のみが runtime で pick を提起する (D08003/D01006 短縮形 pick と同型)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  // 【パートナー黄】
  condition: { kind: 'partnerColor', color: '黄' },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { kind?: unknown }).kind === 'event-use';
    },
  },
  effect: {
    kind: 'conditional',
    // 自分の現場にキャラが5枚以上いる場合
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self' }, nMin: 5 },
    // 代わりにそのキャラをリムーブする (相手の現場のキャラを1枚まで選び、リムーブ)
    then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'opp' } },
    // 相手の現場にいるキャラを1枚まで選び、スタンさせる
    else: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'opp', state: 'stun' } },
  },
  description:
    '【パートナー黄】相手の現場のキャラを1枚まで選びスタン。自分の現場のキャラが5枚以上なら代わりにリムーブ。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B03103: CardDef = {
  id: 'B03103',
  no: '0356/B03103',
  kind: 'event',
  names: ['ヤンチャな5人組'],
  colors: ['黄'],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133463323610.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
