// cards/ct-p07/B07014 弁当型携帯FAX (event) — CARD PHASE step12 (on-set-host declared rider + removeAreaToDeckTop 初 consumer、engine変更0)
// rules: rules/13-keywords.md, rules/16-card-set.md, rules/21-declared-ability-cost.md,
//        rules/22-qa-action-contact.md
//
// 公式テキスト:
//   このイベントを自分の現場にいる【青】のキャラ1枚にセットする。
//   このイベントがセットされているキャラは〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定して
//   アクションできる）と「【宣言】【ターン1】自分のリムーブエリアにあるキャラを1枚まで選び、デッキの上に
//   移す。」を持つ。
//
// 句マッピング:
//   - 「【青】のキャラ1枚にセット」=> charSetCard fromSelf (B05041 a1 同型、色差のみ)。
//     公式Q&A「青キャラ0枚でも使用可 (セット不可ならリムーブに残る)」= host-absent no-op で自動整合。
//   - 「〚突撃［キャラ］〛を持つ」=> scope:'on-set-host' continuous grantKeywords
//     (read/char.ts keywords() fromSetHost walk → action.ts namedExceptionAllowed が honor)。
//     公式Q&A「アクション中にセットが外れても継続」= rules/22 アクション継続性 (既存機序)。
//   - 「【宣言】【ターン1】リムーブエリアのキャラを1枚まで選び、デッキの上に移す」=>
//     scope:'on-set-host' declared rider + removeAreaToDeckTop{max:1, filter:{kind:'character'}}
//     (engine mega-wave W6 step11 — findDeclaredAbility rider walk + UI riderDeclaredAbilities、
//     atom-pick-spec.ts に B07014 名指し。engine probe §11-4 で end-to-end 済)。
//     「1枚まで」= 0枚可。remove からキャラ pick = kind:'character' 必須 (BUG-123)。
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
    args: { player: 'self', fromSelf: true, n: 1, filter: { color: '青', kind: 'character' } },
  },
  description: 'このイベントを自分の現場にいる【青】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-set-host',
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'] },
  description:
    'このイベントがセットされているキャラは〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/16-card-set.md', 'rules/22-qa-action-contact.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-set-host',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'removeAreaToDeckTop',
    args: { player: 'self', max: 1, filter: { kind: 'character' } },
  },
  description: '【宣言】【ターン1】自分のリムーブエリアにあるキャラを1枚まで選び、デッキの上に移す。',
  ruleRefs: ['rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};

export const B07014: CardDef = {
  id: 'B07014',
  no: '0746/B07014',
  kind: 'event',
  names: ['弁当型携帯FAX'],
  colors: ['青'],
  level: 5,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413976119187.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
  ],
};
