// cards/ct-p09/B09071 萩原千速 (character) — engine拡張 wave#2 cluster15 follow-up (removal-observer + partnerColorKeyword + 疾風 grant, 2026-06-18)
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト (ct-p09/character.tsv B09071):
//   【パートナー黄】〚突撃〛
//   【疾風】ターン終了時までこのキャラは「このキャラは相手の現場にいるアクティブ状態のキャラを指定して
//     アクションできる。」を持つ。（自分の現場にこのターンで1番に登場したときに発動する）
//   【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、キャラを1枚まで選び、スリープさせる。
//
// 句マッピング:
//   a1 (常時有効): 【パートナー黄】〚突撃〛 = __shared partnerColorKeyword({color:'黄',kw:'突撃'})
//       (grantKeywords closure・JSON 不能 → 共通クラス経由。D11007/B06087 同型)。
//   a2 (条件発動): 【疾風】= trigger {hook:'enter', selfOnly:true, matcherCondition:{kind:'enterOrderEquals', n:1}}
//       (このターン1番目に登場で発火。D11009 a2 同型)。effect = 「ターン終了時までアクティブ指定アクション可」を自身に付与
//       = charSetTurnEffect{uid:'$self', key:'actionTargetsActive', val:true} (B08032 a1 同型、target-expander が
//       hasTextAbility('actionTargetsActive') で相手アクティブを候補化、clearTurnEffects('turn') でターン終了時失効)。
//   a3 (条件発動): 【ターン1】removal-observer (cluster15)。limit {kind:'turn', n:1}。trigger {hook:'leave:to-remove'} (selfOnly 無)
//       + condition removedCharMatches{side:'opp',cause:'contact-ap',by:'self'}。effect = sceneSetState 短縮形 sleep
//       (max:1 side:'either' = キャラを1枚まで選びスリープ / D11009 a2 同型。非 hirameki triggered なので短縮形でよい)。
//       removal verb 非含 + 【ターン1】 → cascade DEFER 非該当。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー黄】〚突撃〛
const a1: AbilityDef = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【疾風】= このターン1番目に登場で発火 (enterOrderThisTurn / BUG-100)
  trigger: { hook: 'enter', selfOnly: true, matcherCondition: { kind: 'enterOrderEquals', n: 1 } },
  // ターン終了時までこのキャラは「相手の現場にいるアクティブ状態のキャラを指定してアクションできる」を持つ
  effect: { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$self', key: 'actionTargetsActive', val: true } },
  description:
    '【疾風】ターン終了時までこのキャラは「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  // キャラを1枚まで選び、スリープさせる
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description:
    '【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
  ],
};

export const B09071: CardDef = {
  id: 'B09071',
  no: '1011/B09071',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1775608890154914.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
