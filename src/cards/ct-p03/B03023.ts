// cards/ct-p03/B03023 脇田兼則 (character) — engine変更0 wave (triage-verify, 2026-06-28)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/10-action-event.md, rules/19-special-rules.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】〚特徴［毛利探偵事務所］〛のキャラが自分の現場に登場したとき、
//     相手はデッキのカードを上から1枚公開する。（その後、元に戻す）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング (verified twin = B07050 a1 / B02012 a2 / B01074):
//   - a1 【自分ターン中】=condition turn:self / 【ターン1】=limit turn1。
//     〚特徴［毛利探偵事務所］〛のキャラが自分の現場に登場したとき = trigger{hook:'enter',
//     matcherCondition: triggerCharMatches{side:'self', payloadKey:'uid', filter:{trait:'毛利探偵事務所'}}}
//     (NOT selfOnly — bearer が他キャラ登場を観測。enter payload は player キー無 → payloadKey:'uid' 必須。B07050 a1 同型)。
//   - 「相手はデッキ上から1枚公開（その後、元に戻す）」= 同位置へ戻す純 state no-op → atom log
//     (B01074/D05004 の reveal-return を log で表現。位置移動も情報追跡も無いため engine 状態不変)。
//     ※公式Q&A「複数発動しても公開は上から1枚」= log no-op ゆえ重複発動でも盤面差なし。
//   - a2 【ヒラメキ】カードを1枚引く = triggered on-evidence, trigger{hook:'evidence:remove-by-action', optional:true},
//     draw1 (B02012/B05091 a3 系の hirameki draw 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'enter',
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'uid', filter: { trait: '毛利探偵事務所' } },
  },
  effect: { kind: 'atom', verb: 'log', args: { player: 'opp', action: 'reveal-deck-top', result: '相手はデッキのカードを上から1枚公開する（その後、元に戻す）' } },
  description: '【自分ターン中】【ターン1】〚特徴［毛利探偵事務所］〛のキャラが自分の現場に登場したとき、相手はデッキのカードを上から1枚公開する。（その後、元に戻す）',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B03023: CardDef = {
  id: 'B03023',
  no: '0281/B03023',
  kind: 'character',
  names: ['脇田兼則'],
  colors: ['青'],
  level: 4, ap: 4000, lp: 1,
  traits: ['寿司職人'], keywords: [],
  rarity: 'C',
  imageUrl: '1729133201269989.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/10-action-event.md', 'rules/19-special-rules.md'],
};
