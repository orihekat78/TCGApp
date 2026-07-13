// cards/ct-p07/B07030P 黒羽快斗＆中森青子 (キャラ MR) — Cluster WB1 exemplar (toPartnerArea pick, a1後段)
// rules: 03, 15, 17, 18-mr, 19-special-rules, 20-color-and-switch, 21-declared-ability-cost, 22
// 公式テキスト:
//   【パートナー白】【宣言】【ターン1】相手の現場にいるレベル8以下のキャラを1枚まで選び、デッキの下に移す。自分のリムーブエリアにある〚特徴［ビッグジュエル］〛のイベントを1枚まで選び、パートナーエリアに移す。
//   【宣言】【ターン1】〚パートナーエリアにある特徴［ビッグジュエル］のカードを2枚リムーブする〛：手札からレベル3以下の【白】のキャラを1枚までスリープ状態で登場させる。この能力は自分の現場に〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛がいる場合に宣言できる。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
// 句マッピング:
//   - a1【パートナー白】=> condition partnerColor 白 / 【宣言】【ターン1】=> declared + limit turn1。
//     sequence[ sceneToDeck{side:'opp', max:1, pos:'bottom', filter:{levelMax:8}} (相手 lv8以下1枚デッキ下),
//               toPartnerArea{max:1, filter:{trait:'ビッグジュエル', kind:'event'}} (リムーブの宝石イベント1枚 PA へ) ]。
//     ★ toPartnerArea pick-form = Cluster WB1 解禁 (B07061 と同 primitive)。両句独立 (Q&A: 片方のみ可、rules/15「まで」0可)。
//   - a2 gate「現場に[黒羽快斗]か[怪盗キッド]がいる場合」=> or[bond 黒羽快斗, bond 怪盗キッド]。現場宣言時は
//     このカード自身が split-name[黒羽快斗] を持つため自足 (Q&A)。PA 宣言時は現場の別カードが必要 (bond は scene 走査)。
//   - a2「パートナーエリアでも宣言できる」=> scope:'on-partner-area' (declared-ability.ts:147: PA=PA-scope要 / scene=無制限
//     ゆえ scene+PA 双方で宣言可、B08046 a2 同型)。cost partnerAreaRemove{n:2, filter ビッグジュエル}。
//     effect sceneEnter{from:'hand', max:1, enterSleep:true, filter:{color:'白', levelMax:3, kind:'character'}}。
//   - a3【カットイン】AP＋2000 => on-hand + effect:declared selfOnly + charModifyAP{$contact.byUid, scope:'contact'}。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '白' },
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom', filter: { levelMax: 8 } } },
      { kind: 'atom', verb: 'toPartnerArea', args: { player: 'self', max: 1, filter: { trait: 'ビッグジュエル', kind: 'event' } } }
    ]
  },
  description: '【パートナー白】【宣言】【ターン1】相手の現場にいるレベル8以下のキャラを1枚まで選び、デッキの下に移す。自分のリムーブエリアにある〚特徴［ビッグジュエル］〛のイベントを1枚まで選び、パートナーエリアに移す。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  condition: { kind: 'or', cs: [{ kind: 'bond', cardName: '黒羽快斗' }, { kind: 'bond', cardName: '怪盗キッド' }] },
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'partnerAreaRemove',
    target: {
      kind: 'pick',
      query: { area: 'partner-area', side: 'self', filter: { trait: ['ビッグジュエル'] } },
      n: { min: 2, max: 2 },
      chooser: 'self'
    },
    n: 2
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: { player: 'self', from: 'hand', max: 1, enterSleep: true, viaEffect: true, filter: { color: '白', levelMax: 3, kind: 'character' } }
  },
  description: '【宣言】【ターン1】〚パートナーエリアにある特徴［ビッグジュエル］のカードを2枚リムーブする〛：手札からレベル3以下の【白】のキャラを1枚までスリープ状態で登場させる。この能力は自分の現場に〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛がいる場合に宣言できる。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md']
};

export const B07030P: CardDef = {
  id: 'B07030P',
  no: '0759/B07030P',
  kind: 'character',
  names: [
    '黒羽快斗＆中森青子',
    '黒羽快斗',
    '中森青子'
  ],
  colors: [
    '白'
  ],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: [
    '高校生',
    'マジシャン'
  ],
  rarity: 'MRP',
  imageUrl: '1763546809849500.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
