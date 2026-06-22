// cards/ct-p05/B05102 「小五郎の弟子」 (イベント) — turn-scope levelDelta wave (engine変更0, 2026-06-21)
// rules: 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 20-color-and-switch.md,
//        10-action-event.md, 14-refresh.md
//
// 公式テキスト:
//   【パートナー黄】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//     カードを1枚引き、手札から自分のFILEエリアの枚数以下のレベルの【黄】のキャラを1枚まで登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//
// ⚠ DEFERRED-INDEX「evidence-self→hand cluster」表で「continuous (temp) levelDelta が不在」を理由に DEFER
//   されていたが、これは誤診断。「ターン終了時までレベル－1」= condition-gated continuous (B08050「【解決編】
//   レベル+3」= 再評価型 ContinuousModifier.levelDelta) ではなく、one-shot で turn end に失効する
//   turn-scope delta = 既存 charModifyLevel{scope:'turn'} (turnEffects['lvlMod_turn']、read/char.ts level()
//   4-scope 合算 + mutate/char.ts:148 で turn end に delete、BUG-119) で実装可能。よって本カードは engine変更0。
//
// 句マッピング (全 atom に出荷済 exemplar):
//   - 【パートナー黄】 = ability.condition {kind:'partnerColor', color:'黄'} (rules/17 Point: 未達なら
//     「何も効果のないイベント」扱い = 効果全体不発。draw も発火しない)。B04064 a1 VERBATIM (event-use + partnerColor gate)。
//   - イベント使用 = effect:declared selfOnly + matcher kind==='event-use' (D05014 / B04064 a1 同型。
//     手札の使用 / ネクストヒント両経路が同 payload を emit)。
//   - 効果は sequence (chain ではない): 公式Q&A「相手の現場にいるキャラを1枚も選ばなくても以降の効果を解決できますか？
//     → はい、可能です。（『カードを1枚引く』は必ず行います。手札からキャラを登場させないことは可能です。）」
//     = 各 step 独立、draw は mandatory 末尾発火。BUG-111 #2 修正 (2026-06-16) で sequence-origin の
//     0-pick decline / no-candidate でも remainder (draw + sceneEnter) を実行 (B09038 a2 inner sequence
//     [sceneEnter(0-pick), …, draw] が同 precedent: 「draw は sequence trailing step, runs even on 0-enter」)。
//   - 相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する =>
//     charModifyLevel{player:'self', max:1, side:'opp', delta:-1, scope:'turn'} (B05066 a2 VERBATIM)。
//     max:1 = 「1枚まで」0枚可 (rules/15)。
//   - カードを1枚引き => draw{player:'self', n:1} (必須、rules/15「〜する」)。
//   - 手札から自分のFILEエリアの枚数以下のレベルの【黄】のキャラを1枚まで登場させる =>
//     sceneEnter{player:'self', from:'hand', max:1, viaEffect:true,
//       filter:{color:'黄', kind:'character', levelMax:{dyn:'$self.fileCount'}}} (D05014 a1 VERBATIM)。
//     levelMax:{dyn:'$self.fileCount'} = 「FILEエリアの枚数以下のレベル」(cluster12 nested-filter-dyn、
//     アシストパートナー込み rules/17 §FILE(X))。viaEffect:true = 効果による登場 (事件の色制限を受けない rules/20)。
//   - 【ヒラメキ】このカードを手札に加える => handAddFromRemove{player:'self', fromSelf:true}
//     (PR085 a2 VERBATIM)。証拠から action[事件] でリムーブされるそのカード自身を手札へ (rules/10)。
//     optional:true (発動 / 不発は所有者選択、rules/10)。event カードも証拠エリアで hirameki 発火
//     (D08024/B02053 等 event+hirameki 出荷済)。

import type { AbilityDef, CardDef } from '@/engine/types';

// 【パートナー黄】イベント使用効果
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  condition: { kind: 'partnerColor', color: '黄' },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する (0枚可)
      { kind: 'atom', verb: 'charModifyLevel', args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' } },
      // カードを1枚引く (必須 — sequence mandatory 末尾、0-pick decline でも発火: BUG-111 #2)
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // 手札から FILE 枚数以下のレベルの【黄】のキャラを1枚まで登場させる (効果による登場 = 色制限なし)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { color: '黄', kind: 'character', levelMax: { dyn: '$self.fileCount' } } } },
    ],
  },
  description:
    '【パートナー黄】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。カードを1枚引き、手札から自分のFILEエリアの枚数以下のレベルの【黄】のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

// 【ヒラメキ】このカードを手札に加える (証拠から action[事件] でリムーブされる自身を手札へ)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B05102: CardDef = {
  id: 'B05102',
  no: '0600/B05102',
  kind: 'event',
  names: ['小五郎の弟子'],
  colors: ['黄'],
  level: 1,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628078739579.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
  ],
};
