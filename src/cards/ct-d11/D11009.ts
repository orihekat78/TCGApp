// cards/ct-d11/D11009 萩原研二 (キャラ)
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 17-icons.md, 24-qa-naming-stun.md
// spec: .claude/specs/cards-analysis/D11009.md
//
// 公式テキスト:
//   【パートナー黄】〚突撃［キャラ］〛（名乗り状態でもアクション［キャラ］できる）
//   【疾風】キャラを1枚まで選び、スリープさせる。
//   ヒラメキ: キャラを1枚まで選び、スリープさせる。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1 partnerColorKeyword (突撃[キャラ])
const a1 = partnerColorKeyword({ color: '黄', kw: '突撃[キャラ]', abilityId: 'a1' });

// a2 疾風: 1番目登場時にキャラ1枚スリープ
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      return (p as { enterOrder?: number }).enterOrder === 1;
    },
  },
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description: '【疾風】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

// a3: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (旧 hiramekiCharStun factory を inline + sceneSetState 短縮形)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // キャラを1枚まで選び、スリープさせる
  // 注: hirameki fire は hiramekiResolve handler が chooseAtomTarget で $pick を自動解決するため、
  //     明示 target ($pick + pick query) を保持する (sceneSetState 短縮形だと fire 時 auto-pick されず side-channel 待ちになる)。
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
      },
    ],
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const D11009: CardDef = {
  id: 'D11009',
  no: '0939/D11009',
  kind: 'character',
  names: ['萩原研二'],
  colors: ['黄'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1775608962481705.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
