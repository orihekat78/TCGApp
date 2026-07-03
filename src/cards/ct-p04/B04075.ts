// cards/ct-p04/B04075 白鳥任三郎 (character) — engine wave-18 exemplar (inContact + 相手cutin/変装 reaction 初 consumer, 2026-07-03)
// rules: 07-action-flow.md, 08-contact.md, 09-cutin-disguise.md, 10-action-event.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【ターン1】相手が【カットイン】か【変装】を使用したとき、コンタクト中のキャラを1枚まで選び、このコンタクト中、AP－1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   - 【ターン1】 => a1.limit = {kind:'turn', n:1}
//       (B02079 a1 / B01028 a3 と同型。triggered.ts declaredUseCount で uid+abilityId 単位に fire-time 計数。
//        multi-hook でも 1 ability = 共有【ターン1】。cutin か変装のどちらか 1 回で消費、rules/24 Q&A 準拠)。
//   - 相手が【カットイン】か【変装】を使用したとき => a1.trigger = { hooks:['cutin:used','disguise:into'],
//       matcherCondition:{kind:'triggerPlayerIs', side:'opp'} }。
//       ★ multi-hook = trig.hooks 配列 (triggered.ts:260 trig.hooks?.includes、2026-06-06 タスクC)。
//       cutin:used / disguise:into は共に payload.player を持つ (contact.ts、後者は engine wave-18 で追加) →
//       triggerPlayerIs side:'opp' = payload.player !== owner (eval.ts:250) = 相手が使用。B03118 (cutin:used +
//       triggerPlayerIs) が先例。共有 matcherCondition は両 hook に一律適用 (card-def.ts:68)。
//   - コンタクト中のキャラを1枚まで選び、このコンタクト中、AP-1000 => a1.effect = charModifyAP 短縮形
//       { delta:-1000, max:1, inContact:true, scope:'contact' }。
//       inContact = pick を現コンタクト参加者 (ctx.contact.{byUid,targetUid,guardUid}) に限定 (engine wave-18、
//       candidates.matchesQueryForChar)。ctx.contact は cutin:used/disguise:into emit の source.bindings.contact
//       → entryToCtx で populate。max:1 = 「1枚まで」(0 可、rules/15)。side 既定 'either' = コンタクト中のキャラ
//       (どちら側でも、text に側指定なし)。scope:'contact' = 「このコンタクト中」(コンタクト終了時に失効)。
//   - 【ヒラメキ】カードを1枚引く => a2 = triggered on-evidence { hook:'evidence:remove-by-action', optional:true },
//       effect atom draw {player:'self', n:1} (B03118 a2 / D02004 a2 VERBATIM)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'cutin:used',
    hooks: ['disguise:into'], // multi-hook: primary=cutin:used + additional=disguise:into (D03007 idiom)
    matcherCondition: { kind: 'triggerPlayerIs', side: 'opp' },
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: { delta: -1000, max: 1, inContact: true, scope: 'contact' },
  },
  description: '【ターン1】相手が【カットイン】か【変装】を使用したとき、コンタクト中のキャラを1枚まで選びこのコンタクト中AP-1000。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md'],
};

export const B04075: CardDef = {
  id: 'B04075',
  no: '0256/B04075',
  kind: 'character',
  names: ['白鳥任三郎'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287822626030.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
