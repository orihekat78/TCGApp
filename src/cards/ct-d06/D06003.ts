// cards/ct-d06/D06003 服部平次 (character) — M2後半 batch (engine: cutinTextIncludes filter は同 branch 出荷済)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【事件緑＆白】〚突撃〛（登場したターンからすぐにアクションできる）
//   【パートナー緑】【ターン1】このキャラがアクションしたとき、自分のリムーブエリアにある「【カットイン】AP＋」を持つカードを1枚まで選び、手札に加える。
// 句マッピング (grounding: .claude/specs/grounding/D06003.md):
//   - a1 = D06010 a1 の印字同文 clone: 【事件緑＆白】= caseColor combine:'and'、〚突撃〛= grantKeywords (継続、条件外で即失効)。
//   - a2 trigger = D06010 a2 同型: action:declare + selfOnly。qAndA「アクションを宣言し、対象を指定して
//     このキャラをスリープさせた時点で発動（ガード前）」= rules/22 の action:declare emit 位置と 1対1。
//   - 「【カットイン】AP＋」を持つカード = filter {cutinTextIncludes:'AP＋'}
//     (read/keyword.ts defHasCutinTextIncludes — cutin ability の印字 description 文字列包含。qAndA の裁定基準は
//      文字列包含: B01097 ウォッカ (draw型 cutin) は「AP＋」を含まないため候補外 — qAndA 名指し decoy)。
//   - 「カードを1枚まで選び、手札に加える」= handAddFromRemove 短縮形 max:1 (min0 =「まで」= 0枚可 rules/15、
//     kind filter なし =「カード」= キャラ/イベント両方。B09061 a2 と同 verb、defaultArea:'remove')。
//     qAndA「同アクションのコンタクトで加えた【カットイン】を使用可」は手札 zone 到達で engine 既定成立。
//   - D06004 / D06021 / D06023 は印字完全同文の別 printings (id/no/imageUrl のみ差)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【事件緑＆白】の間 〚突撃〛を付与 (continuous, grantKeywords) — D06010 a1 同文 clone
const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【事件緑＆白】= 事件が緑と白の両方を持つ (rules/17 「&」= すべての色)
  condition: { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
  // 〚突撃〛を持つ
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【事件緑＆白】〚突撃〛（登場したターンからすぐにアクションできる）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

// a2: 【パートナー緑】【ターン1】このキャラがアクションしたとき、リムーブの「【カットイン】AP＋」持ちを1枚まで手札へ
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー緑】
  condition: { kind: 'partnerColor', color: '緑' },
  // このキャラがアクションしたとき (宣言・対象指定・スリープ時点 = ガード前、rules/22 + qAndA)
  trigger: { hook: 'action:declare', selfOnly: true },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 自分のリムーブエリアにある「【カットイン】AP＋」を持つカードを1枚まで選び、手札に加える
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { cutinTextIncludes: 'AP＋' } },
  },
  description:
    '【パートナー緑】【ターン1】このキャラがアクションしたとき、自分のリムーブエリアにある「【カットイン】AP＋」を持つカードを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const D06003: CardDef = {
  id: 'D06003',
  no: '0167/D06003',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1718844176798125.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
