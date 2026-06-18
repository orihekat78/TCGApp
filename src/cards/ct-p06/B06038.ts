// cards/ct-p06/B06038 鬼丸猛 (character) — engine拡張 wave#2 cluster15 follow-up (removal-observer + partnerColorKeyword, 2026-06-18)
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト (ct-p06/character.tsv B06038):
//   【パートナー緑】〚突撃〛（登場したターンからすぐにアクションできる）
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。
//   このキャラのアクション［事件］によって証拠を得たとき、相手は手札を1枚リムーブする。
//
// 句マッピング:
//   a1 (常時有効): 【パートナー緑】〚突撃〛 = __shared partnerColorKeyword({color:'緑',kw:'突撃'})。
//       continuousModifier.grantKeywords は closure 型 (JSON 不能) のため共通クラス経由 (D02007/B06087 同型)。
//       括弧書きは突撃の rules リマインダ文で別効果なし。
//   a2 (条件発動): removal-observer (cluster15 反撃一族)。「相手の現場にいるキャラがこのキャラとの
//       コンタクトによってリムーブされたとき」= trigger {hook:'leave:to-remove'} (selfOnly 無 = 他者除去に反応)
//       + condition {kind:'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'}
//       (by:'self' = 除去者=このキャラ / cond/eval.ts:336-364)。effect = draw1 (必須・removal verb 非含 → cascade 無)。
//   a3 (条件発動): 「このキャラのアクション［事件］によって証拠を得たとき」= trigger {hook:'evidence:gain', selfOnly:true}
//       (evidence:gain は flow/action-case.ts gainSelfEvidence の実獲得時のみ emit = 「アクション[事件]によって」を構造保証。
//       B08012 a2 同型)。effect = 相手 discard1 (D04010 a1 同型、chooser=opp が自手札1枚を選びリムーブ)。
//       qAndA: 証拠獲得より前に現場を離れた場合は非発火 → selfOnly 在場 scan で自然成立。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー緑】〚突撃〛
const a1: AbilityDef = partnerColorKeyword({ color: '緑', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description:
    '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラのアクション［事件］によって証拠を得たとき (実獲得時のみ emit / rules/10 手順3)
  trigger: { hook: 'evidence:gain', selfOnly: true },
  // 相手は手札を1枚リムーブする
  effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  description:
    'このキャラのアクション［事件］によって証拠を得たとき、相手は手札を1枚リムーブする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06038: CardDef = {
  id: 'B06038',
  no: '0661/B06038',
  kind: 'character',
  names: ['鬼丸猛'],
  colors: ['緑'],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1754285189475409.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
