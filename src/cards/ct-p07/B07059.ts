// cards/ct-p07/B07059 赤い涙 (event) — engine wave-12 exemplar (toPartnerArea / G39)
// rules: rules/03-field-areas.md (§パートナーエリア), rules/06-card-types.md (§イベント使い切り),
//        rules/10-action-event.md (§ヒラメキ), rules/15-abilities-effects.md (§量指定子),
//        rules/17-icons.md (§【パートナー(色)】), rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト (TSV ct-p07/event.tsv + 公式 API ct-p07-api.json id=1787):
//   effect: 【パートナー白】AP8000以下のキャラを1枚まで選び、リムーブする。このカードをパートナーエリアに移す。
//   hirameki: 【ヒラメキ】（証拠からリムーブされるときに発動する）このカードをパートナーエリアに移す。
//   category1: ビッグジュエル (公式 API。TSV は event の category を drop するため明示 — B07055 と同運用)
// 公式 Q&A (TSV qAndA 列):
//   Q: AP8000以下のキャラを選ばず (リムーブせず)、このカードをパートナーエリアに移すことは可能? → A: はい。その場合でも必ず移す。
//   Q: パートナーエリアに置けるカードの枚数に上限は? → A: 上限なし。
//   Q:【ヒラメキ】を発動させないことは可能? → A: はい。その場合そのままリムーブエリアへ。
// 句マッピング (certify wf_66b41e13 grounding 3/3 誤訳ゼロ、YELLOW 指摘反映済):
//   - イベント使用の起動配線 => a1 {type:'triggered', scope:'on-hand', trigger:{hook:'effect:declared',
//     selfOnly:true, matcher: p.kind==='event-use'}} [D01014/B07055 a1 と同型。hand-use-card.ts / next-hint.ts が
//     effect:declared を {kind:'event-use'} payload で emit]
//   - 【パートナー白】 => a1.condition {kind:'partnerColor', color:'白'} [cond/eval.ts case 'partnerColor'。
//     不成立時は rules/17 Point「能力を持たない扱い」→ 効果全体 (PA 移動含む) 不発、カードは remove 残留。
//     B07055 a1 / D01015 と同型]
//   - AP8000以下のキャラを1枚まで選び、リムーブする => sceneRemove {player:'self', max:1, side:'either',
//     cause:'effect', filter:{apMax:8000}} [B07055 a1 / B07002 a1 同型 PA 短縮形。max:1 (n ではない) =
//     「1枚まで」0枚可 (rules/15)。無修飾「キャラ」= side:'either' (rules/15)。cause:'effect' =
//     「コンタクトによってリムーブされない」を貫通する効果リムーブ分類]
//   - このカードをパートナーエリアに移す => toPartnerArea {} [engine wave-12 新 verb。ctx.source.cardId
//     (=当該イベント自身、使用時に remove へ置かれ済) を remove から PA (partnerAreaCards) へ。
//     ★plain sequence 必須 (chain 不可): 0枚 skip でも remainder が発火 = Q&A「その場合でも必ず移す」]
//   - 【ヒラメキ】このカードをパートナーエリアに移す => a2 {type:'triggered', scope:'on-evidence',
//     trigger:{hook:'evidence:remove-by-action', optional:true}, effect: toPartnerArea {}} [B01018/D01003 a2 と
//     同 wrapper。optional:true = 発動しない選択可 (Q&A) → その場合 remove 残留。evidence.removeTop が
//     remove へ移動済のため toPartnerArea が同経路で拾う]

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
      // AP8000以下のキャラを1枚まで選び、リムーブする (0枚可)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
      // このカードをパートナーエリアに移す (0枚 skip でも必ず = Q&A、chain 不可)
      { kind: 'atom', verb: 'toPartnerArea', args: {} },
    ],
  },
  description: '【パートナー白】AP8000以下のキャラを1枚まで選び、リムーブする。このカードをパートナーエリアに移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
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

export const B07059: CardDef = {
  id: 'B07059',
  no: '0788/B07059',
  kind: 'event',
  names: ['赤い涙'],
  colors: ['白'],
  level: 5,
  // 特徴 (公式 API category1 由来): ビッグジュエル。TSV が event の category を drop するため明示 (B07055 同運用)
  traits: ['ビッグジュエル'],
  rarity: 'R',
  imageUrl: '1762414010617160.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
