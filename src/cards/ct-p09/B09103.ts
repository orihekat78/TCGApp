// cards/ct-p09/B09103 ライ (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【自分ターン中】〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、このキャラをAP＋2000する。
//   【事件編】【登場時】相手のデッキのカードを上から3枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// a1: 【自分ターン中】痕跡発見済 continuous apDelta self +2000 (turn AND scratchTrace)
// a2: 【事件編】【登場時】相手デッキ上 3 mill
// a3: 【ヒラメキ】キャラを1枚まで選びスリープ (D08019 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【自分ターン中】かつ 〚痕跡［発見済み］〛(engine 値は '発見済')
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'scratchTrace', player: 'self', v: '発見済' }] },
  // このキャラをAP＋2000する (self-only continuous apDelta)
  continuousModifier: { apDelta: 2000 },
  description: '【自分ターン中】〚痕跡［発見済み］〛の場合、このキャラをAP＋2000する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【事件編】
  condition: { kind: 'caseStatus', status: '事件編' },
  trigger: { hook: 'enter', selfOnly: true },
  // 相手のデッキのカードを上から3枚リムーブする
  effect: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 3 } },
  description: '【事件編】【登場時】相手のデッキのカードを上から3枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D08019 a2 同型 — fire 時 auto-pick のため explicit pick target を保持)
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
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md'],
};

export const B09103: CardDef = {
  id: 'B09103',
  no: '1042/B09103',
  kind: 'character',
  names: ['ライ'],
  colors: ['黒'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608943954427.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
