// cards/ct-p04/B04064 「消えろ!!」 (イベント) — Task D batch (2026-06-12)
// rules: 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   このイベントは自分のFILEエリアにあるカードが5枚以下の場合に使用できる。
//   【パートナー赤】【解決編】レベル8以上のキャラを1枚まで選び、リムーブする。
//   手札からレべル4以下のキャラを1枚まで登場させる。
//
// a1: イベント使用 = effect:declared selfOnly + matcher kind==='event-use' (B02053 a1 同型。
//     手札の使用 / ネクストヒント両経路が同 payload を emit)。
//     使用ゲート「FILE 5枚以下の場合に使用できる」= condition not(fileAtLeast 6) — B02032/B04047 の condition 近似前例。
//     ⚠ 近似注記 (DEFERRED-INDEX 対象): engine は ability.condition 不成立でもイベントの使用自体は拒否しない
//     (効果不発の vacuous 使用)。公式裁定は「使用できない」(Q&A: 他カードの能力や効果による使用でも条件必須)。
//     FILE 枚数はアシスト中のパートナー込み (公式Q&A「はい、数えます」/ cond/eval.ts fileAtLeast = file.length)。
//     【パートナー赤】【解決編】も condition (rules/17 Point: 未達なら「何も効果のないイベント」扱い — こちらは正確な semantics)。
//     効果は sequence (chain ではない): 公式Q&A「レベル8以上を1枚も選ばず (何もリムーブせず) 登場だけ行うことも可能」
//     = 各 step 独立の max:1 (0枚選択可) が意図。
//     ⚠ 既知 engine 制約 (BUG 起票対象): sequence は step1 の pick await で残り step を pending.continuation
//     に同梱して一時停止する (resolver.ts)。human が skip (useEngineDispatch effectPickResolve pickedUid=null)
//     / AI 側候補0 (apply-pick.ts drainAiEffectPicks) の場合、pending 破棄と同時に continuation (= step2
//     sceneEnter) も drop される (BUG-111 設計) ため、「リムーブを選ばず登場だけ行う」が現状実機では不可 —
//     本 Q&A と不整合。step1 で 1枚選んだ場合は applyPickAndContinuation が step2 を post-pick 盤面で実行
//     (正常)。D08024/D11020 出荷済 sequence と共通の骨格バグで、カード DSL 側では回避不能 (chain は同様に
//     drop、ability 分割は解決順 owner-choice という別の rules/15 逸脱を生む)。
//     登場は効果による登場 = viaEffect:true (事件の色制限を受けない rules/20)。公式Q&A「効果によって登場したキャラの
//     【登場時】能力は発動する」= sceneEnter の enter hook emit (engine 既存挙動)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  // 【パートナー赤】【解決編】は使用後に評価する効果条件。
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'caseStatus', status: '解決編' }] },
  effect: {
    kind: 'sequence',
    steps: [
      // レベル8以上のキャラを1枚まで選び、リムーブする (0枚選択可 — Q&A: 選ばず登場だけ行うことも可能。⚠ ヘッダの sequence skip-drop 注記参照)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMin: 8 } } },
      // 手札からレべル4以下のキャラを1枚まで登場させる (効果による登場 = 色制限なし rules/20)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { levelMax: 4, kind: 'character' } } },
    ],
  },
  description:
    'このイベントは自分のFILEエリアにあるカードが5枚以下の場合に使用できる。【パートナー赤】【解決編】レベル8以上のキャラを1枚まで選び、リムーブする。手札からレべル4以下のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B04064: CardDef = {
  id: 'B04064',
  no: '0453/B04064',
  kind: 'event',
  names: ['「消えろ!!」'],
  colors: ['赤'],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287801284711.jpg',
  useCondition: { kind: 'not', c: { kind: 'fileAtLeast', n: 6 } },
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
  ],
};
