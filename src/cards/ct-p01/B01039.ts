// cards/ct-p01/B01039 「かっ…和葉ァ!!!」 (event) — CARD PHASE step12 (leave:intercept kept-in-scene 初 consumer、engine変更0)
// rules: rules/08-contact.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md
//
// 公式テキスト:
//   このイベントを自分の現場にいる【緑】のキャラ1枚にセットする。
//   このイベントがセットされているキャラが相手の能力や効果、コンタクトによって現場から離れるとき、
//   このイベントをリムーブし、そのキャラは現場から離れる代わりに現場に残る。
//
// 句マッピング:
//   - 「【緑】のキャラ1枚にセット」=> charSetCard fromSelf (B05041 a1 同型)。
//   - 「相手の能力や効果、コンタクトによって現場から離れるとき、このイベントをリムーブし、
//     代わりに現場に残る」=> trigger{hook:'leave:intercept', matcherCondition:leaveCauseIn
//     {causes:['contact-ap','effect']}} + leaveInterceptRedirect{destination:'kept-in-scene'}
//     (engine mega-wave W6 step10 r9 — consultLeaveIntercept が「相手起因」gate を内蔵:
//     contact-ap 常時 + cause 'effect' は byPlayer≠owner のみ consult。set-card interceptor は
//     コストとして自動リムーブ、engine probe §10-5/§10-5b SETGUARD と同 shape)。
//     公式Q&A「離れる行為そのものを行わなかった = 【現場リムーブ時】等は発動しない」=
//     pre-splice consult (leave:to-remove 非 emit) で自動整合。
//   - 「〜するとき、（…）代わりに〜」= rules/15 即座解決の例外 (intercept は同期 consult、queue 非経由)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', fromSelf: true, n: 1, filter: { color: '緑', kind: 'character' } },
  },
  description: 'このイベントを自分の現場にいる【緑】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-set-host',
  trigger: {
    hook: 'leave:intercept',
    matcherCondition: { kind: 'leaveCauseIn', causes: ['contact-ap', 'effect'] },
  },
  effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'kept-in-scene' } },
  description:
    'このイベントがセットされているキャラが相手の能力や効果、コンタクトによって現場から離れるとき、このイベントをリムーブし、そのキャラは現場から離れる代わりに現場に残る。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

export const B01039: CardDef = {
  id: 'B01039',
  no: '0033/B01039',
  kind: 'event',
  names: ['「かっ…和葉ァ!!!」'],
  colors: ['緑'],
  level: 5,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013020281063.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
