// cards/ct-p09/B09028 大滝悟郎 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 07-action-flow.md, 13-keywords.md, 15-abilities-effects.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分の現場に〚特徴［大阪府警］〛のキャラが2枚以上いる場合、このキャラは
//   「このキャラはスリープ状態でもガードできる。」を持つ。
//
// 句マッピング:
//   - 自分の現場に〚特徴［大阪府警］〛のキャラが2枚以上いる場合 =>
//     condition {kind:'sceneHas', query:{area:'scene', side:'self', filter:{trait:'大阪府警'}}, nMin:2}
//     (公式Q&A: このキャラ自身も2枚に数える → excludeSelf 無し)
//   - このキャラは「このキャラはスリープ状態でもガードできる。」を持つ =>
//     type:'continuous' + continuousModifier.grantKeywords ['text:sleepGuard']
//     (印字常時条件型 = Task D E4 'text:' 擬似キーワードチャネル。read/char.keywords() が
//     condition を read 時評価 → rules/24 常時有効型: 条件外で即失効。
//     flow/guard.ts:57 が sleep キャラの hasTextAbility(s,uid,'sleepGuard') を読む。
//     rules/19: disabledOriginal で keywords() から消える既存分岐と自動整合)
//
// 公式Q&A:
//   - 相手の「アクションしたとき」能力で2枚未満になった場合ガード不可 → read 時 condition 評価で live 判定 ✓
//   - アクティブ状態でガードした場合もスリープになる (ガードの他ルール不変) ✓ (guard 通常処理)
//   - スタン状態はガード不可 ✓ (guard.ts は state==='sleep' のみ拡張、rules/03)
//   - ブレット持ちのアクションはガード不可 (「できない」優先) ✓ (既存ブレット処理が優先)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 自分の現場に〚特徴［大阪府警］〛のキャラが2枚以上いる場合 (自身も数える)
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '大阪府警' } }, nMin: 2 },
  // 「このキャラはスリープ状態でもガードできる。」を持つ (text: 擬似キーワード → guard.ts が hasTextAbility で読む)
  continuousModifier: { grantKeywords: () => ['text:sleepGuard'] },
  description:
    '自分の現場に〚特徴［大阪府警］〛のキャラが2枚以上いる場合、このキャラは「このキャラはスリープ状態でもガードできる。」を持つ。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/24-qa-naming-stun.md'],
};

export const B09028: CardDef = {
  id: 'B09028',
  no: '0972/B09028',
  kind: 'character',
  names: ['大滝悟郎'],
  colors: ['緑'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608835795211.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/24-qa-naming-stun.md',
  ],
};
