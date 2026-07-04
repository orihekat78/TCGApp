// cards/ct-p03/B03126 犯人 (character) — CARD PHASE step12 (colorIgnoreOnHandUse / setEvidenceGainSuppress 初 card consumer、engine変更0)
// rules: rules/10-action-event.md, rules/17-icons.md, rules/19-special-rules.md,
//        rules/20-color-and-switch.md, rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   手札から使用する場合、このキャラは事件カードの色を無視できる。（ネクストヒントでの使用も「手札から使用」に含まれる）
//   【事件編】LP＋1
//   【解決編】AP＋2000
//   【ヒラメキ】（証拠からリムーブされるときに発動する）相手はこのアクションによって証拠を得られない。
//
// 句マッピング:
//   - 「手札から使用する場合、事件カードの色を無視できる」=> scope:'on-hand' continuous +
//     continuousModifier.colorIgnoreOnHandUse (rules/20 色制限バイパス — 手札の使用 + ネクストヒント両経路、
//     engine 側コメントに B03126 名指し)。
//   - 【事件編】LP+1 / 【解決編】AP+2000 => continuous condition caseStatus (B06006/D08021 idiom)。
//     公式Q&A「解決編に移行した時点で LP+1 は無効」= rules/24 常時有効型の即失効で自動整合。
//   - 【ヒラメキ】「相手はこのアクションによって証拠を得られない」=> setEvidenceGainSuppress{player:'opp'}
//     (engine mega-wave W6 step7 r70 — gainSelfEvidence consume-on-read gate + hirameki defer 再順序化。
//     公式Q&A「相手の『証拠を得たとき』能力は発動しない」= gain 自体が起きないため自動整合。
//     発動させない選択も可 = ヒラメキ optional 既存機序)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-hand',
  continuousModifier: { colorIgnoreOnHandUse: true },
  description:
    '手札から使用する場合、このキャラは事件カードの色を無視できる。（ネクストヒントでの使用も「手札から使用」に含まれる）',
  ruleRefs: ['rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '事件編' },
  continuousModifier: { lpDelta: 1 },
  description: '【事件編】LP＋1',
  ruleRefs: ['rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  continuousModifier: { apDelta: 2000 },
  description: '【解決編】AP＋2000',
  ruleRefs: ['rules/17-icons.md'],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'setEvidenceGainSuppress', args: { player: 'opp' } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手はこのアクションによって証拠を得られない。',
  ruleRefs: ['rules/10-action-event.md', 'rules/25-qa-effects-resolution.md'],
};

export const B03126: CardDef = {
  id: 'B03126',
  no: '0375/B03126',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 5,
  ap: 4000,
  lp: 0,
  traits: ['犯人'],
  rarity: 'C',
  imageUrl: '1729133510396540.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
