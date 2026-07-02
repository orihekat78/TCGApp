// cards/ct-p07/B07060 クリスタル・マザー (event) — engine wave-12 exemplar (toPartnerArea / G39)
// rules: rules/03-field-areas.md (§パートナーエリア), rules/06-card-types.md, rules/10-action-event.md,
//        rules/15-abilities-effects.md, rules/17-icons.md (§【パートナー(色)】/【FILE(X)】),
//        rules/20-color-and-switch.md
// 公式テキスト (TSV ct-p07/event.tsv + 公式 API ct-p07-api.json id=1679):
//   effect: 【パートナー白】カードを1枚引く。手札から自分のFILEエリアの枚数以下のレベルの【白】のキャラを1枚まで登場させる。このカードをパートナーエリアに移す。
//   hirameki: 【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。
//   category1: ビッグジュエル (公式 API。TSV drop のため明示 — B07055 同運用)
// 公式 Q&A: キャラを登場させず PA に移すこと可 (その場合でも必ず移す) / PA 上限なし / ヒラメキ decline 可。
// 句マッピング (certify wf_66b41e13 grounding 誤訳ゼロ):
//   - 起動配線 / 【パートナー白】 => B07059 と同型 (D01014/B07055 前例)
//   - カードを1枚引く => draw {player:'self', n:1}
//   - 手札から自分のFILEエリアの枚数以下のレベルの【白】のキャラを1枚まで登場させる =>
//     sceneEnter {player:'self', from:'hand', max:1, viaEffect:true, filter:{color:'白', kind:'character',
//     levelMax:{dyn:'$self.fileCount'}}} [D01014.ts:37 と byte 同型 (色差のみ)。levelMax dyn = FILE 枚数
//     (アシストパートナー込み rules/17 §FILE(X))。max:1 = 「1枚まで」0枚可 (rules/15)。効果による登場 =
//     viaEffect:true (色制限を受けない rules/20 例外だが自効果は白限定 filter)]
//   - このカードをパートナーエリアに移す => toPartnerArea {} [plain sequence 末尾 = 前段 skip でも必ず発火]
//   - 【ヒラメキ】 => a2 B07059 と同型 (optional decline 可)

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  condition: { kind: 'partnerColor', color: '白' },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // 手札から FILE 枚数以下のレベルの【白】のキャラを1枚まで登場 (D01014 同型 levelMax dyn)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { color: '白', kind: 'character', levelMax: { dyn: '$self.fileCount' } } } },
      // このカードをパートナーエリアに移す (前段 0枚 skip でも必ず = Q&A、chain 不可)
      { kind: 'atom', verb: 'toPartnerArea', args: {} },
    ],
  },
  description: '【パートナー白】カードを1枚引く。手札から自分のFILEエリアの枚数以下のレベルの【白】のキャラを1枚まで登場させる。このカードをパートナーエリアに移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'toPartnerArea', args: {} },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B07060: CardDef = {
  id: 'B07060',
  no: '0789/B07060',
  kind: 'event',
  names: ['クリスタル・マザー'],
  colors: ['白'],
  level: 1,
  // 特徴 (公式 API category1 由来): ビッグジュエル (B07055 同運用)
  traits: ['ビッグジュエル'],
  rarity: 'C',
  imageUrl: '1758249671507652.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
