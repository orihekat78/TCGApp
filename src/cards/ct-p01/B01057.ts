// cards/ct-p01/B01057 「最も出会いたくない…恋人ってトコロかな？」 (event) — M2 latter batch (on-set-host rider leave:to-remove walk, 2026-07-10)
// rules: 10-action-event.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   このイベントを自分の現場にいる【白】のキャラ1枚にセットする。
//   このイベントがセットされているキャラは「【相手ターン中】【現場リムーブ時】手札からレベル7以下の【白】の
//     キャラを1枚まで登場させる。」を持つ。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 公式Q&A:
//   - 現場にキャラ0枚でも使用可 (セット不能なら解決後リムーブエリアへ。セット可能なキャラがいれば必ずセット)。
//   - 2枚セットされていれば【相手ターン中】【現場リムーブ時】を2つ持つ (条件成立で2つとも発動)。
//   - 【相手ターン中】【現場リムーブ時】= 相手ターン中に現場からリムーブされた (リムーブエリアに置かれた) とき。
//
// 句マッピング (grounding dossier .tmp/_ground/B01057.md):
//   - a1 = effect:declared (event-use) trigger → charSetCard{fromSelf:true, n:1, filter:{kind:'character', color:'白'}}
//     (B01023 a1 同型 + 【白】filter。fromSelf は host pick 経由で使用イベント自身を remove から faceUp セット —
//      atom-handlers/char.ts fromSelf branch は常に faceUp。M2 latter P14 rider walk は faceUp set のみ発火)。
//   - a2 = rider (scope:'on-set-host'): trigger leave:to-remove selfOnly (【現場リムーブ時】=host のリムーブ、
//     M2 latter P14 — handleLeaveToRemoveSelf が faceUp setCards の on-set-host triggered を walk) +
//     condition turn:opp (【相手ターン中】) + sceneEnter{from:'hand', max:1, viaEffect:true,
//     filter:{kind:'character', color:'白', levelMax:7}} (「1枚まで」=0枚可 rules/15、効果による登場=色制限なし rules/20)。
//     2枚セット→entry 2つ (per-setCard walk) = Q&A「2つ持つ」。
//   - a3 = 【ヒラメキ】draw1 (B01023 a3 同型)。

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
  // このイベントを自分の現場にいる【白】のキャラ1枚にセットする (fromSelf = 使用イベント自身を表向きセット)
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', fromSelf: true, n: 1, filter: { kind: 'character', color: '白' } },
  },
  description: 'このイベントを自分の現場にいる【白】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

// 付与能力 (rider): このイベントがセットされているキャラは
// 「【相手ターン中】【現場リムーブ時】手札からレベル7以下の【白】のキャラを1枚まで登場させる。」を持つ。
const a2: AbilityDef = {
  id: 'b01057_set_t1', // rider ability.id は card-unique に
  type: 'triggered',
  scope: 'on-set-host',
  trigger: { hook: 'leave:to-remove', selfOnly: true }, // 【現場リムーブ時】= host 自身のリムーブ
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'hand',
      max: 1, // 「1枚まで」= 0枚可 (rules/15)
      viaEffect: true, // 効果による登場 = 事件の色制限を受けない (rules/20)
      filter: { kind: 'character', color: '白', levelMax: 7 },
    },
  },
  description:
    'このイベントがセットされているキャラは「【相手ターン中】【現場リムーブ時】手札からレベル7以下の【白】のキャラを1枚まで登場させる。」を持つ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B01057: CardDef = {
  id: 'B01057',
  no: '0049/B01057',
  kind: 'event',
  names: ['「最も出会いたくない…恋人ってトコロかな？」'],
  colors: ['白'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1714013041176877.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
  ],
};
