// cards/ct-p01/B01094 「刑事なら刑事らしく…」 (イベント) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 28-errata.md
//
// 公式テキスト (エラッタ後 / rules/28 #6: 「コスト7以下」→「レベル7以下」):
//   自分のリムーブエリアにある【黄】のキャラを1枚まで選び、手札に加える。レベル7以下のキャラを1枚まで選び、
//   ターン終了時まで〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を与える。
//
// a1: イベント使用時 (effect:declared / matcher kind:'event-use') 発火。sequence で
//     ① リムーブの【黄】キャラを1枚まで手札へ (handAddFromRemove 明示 target)
//     ② レベル7以下のキャラを1枚まで選び 突撃[キャラ] を ターン終了まで付与 (charGrantKeyword $pick)
//     ※ 2 つは別 pick (別エリア) のため sequence (D11020 a1 同型の DSL コンパクト形)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use', // このイベント自身が使われたとき発火
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のリムーブエリアにある【黄】のキャラを1枚まで選び、手札に加える
      // BUG-123: テキストは「【黄】のキャラ」。kind:'character' が無いと remove の【黄】イベントも候補化する。
      { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '黄', kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
      // レベル7以下のキャラを1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$pick', kw: '突撃[キャラ]', scope: 'turn', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { levelMax: 7 } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
    ],
  },
  description:
    'リムーブの【黄】キャラを1枚まで手札へ / レベル7以下のキャラを1枚までターン終了まで〚突撃［キャラ］〛付与。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/28-errata.md'],
};

// a2: 【ヒラメキ】リムーブの【黄】キャラを1枚まで手札へ (BUG-140 補修 2026-06-13) — 自身 a1 step1 と同一 atom
// BUG-123: テキストは「【黄】のキャラ」。kind:'character' が無いと remove の【黄】イベントも候補化する。
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '黄', kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【黄】のキャラを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B01094: CardDef = {
  id: 'B01094',
  no: '0082/B01094',
  kind: 'event',
  names: ['「刑事なら刑事らしく…」'],
  colors: ['黄'],
  level: 3,
  traits: [],
  rarity: 'C',
  imageUrl: '1714013082049447.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/28-errata.md',
  ],
};
