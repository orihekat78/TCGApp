// engine.effect.invoke-hirameki — 別カードの【ヒラメキ】効果を明示的に発動させる (証拠リムーブ契機でない)
// engine night-wave WC2b (2026-07-11, B06023/B06034/B06036 cluster)
// rules: 10-action-event.md §ヒラメキ, 17-icons.md §条件アイコン未達=持っていない扱い, 15-abilities-effects.md
//
// 用途: 「(証拠を) 表向きにした【ヒラメキ】を持つカードの、その【ヒラメキ】の効果を発動させてもよい」型
//   (B06023 金棒博士 / B06034 鬼丸城 / B06036 鬼丸天下統一プロジェクト)。ヒラメキ本来の
//   「証拠からリムーブされるとき」文脈ではなく、別カードの効果/コストが表向きにした証拠カードの
//   【ヒラメキ】effect を直接 queue する。
//
// invoke-leave-to-remove.ts (W3 r12) の直接の設計先例。emit を使わない理由・leaf 独立化の理由は同一:
//   - emit すると in-play scan が回り盤面 observer 型を誤発火する。ここでは何も証拠が「リムーブ」
//     されていない (単に別カードの effect を借りて実行するだけ) ため、対象 CardDef の hirameki
//     ability を直接走査し effect のみ queue する。盤面波及は構造的に発生しない。
//   - handleHook (triggered.ts) を atom-handlers から import すると import cycle が生じる。
//
// 公式Q&A 整合 (B06023/B06034/B06036 共通):
//   - 「【ヒラメキ】を発動できない (世良真純等) 場合でも、この能力で【ヒラメキ】の『効果』を発動できる」
//     → 本 verb は hiramekiSuppressed / restrictsOpponent('hirameki') を一切見ない (invoke は
//       「発動」制限を貫通、triggered.ts の hirameki gate とは別経路)。
//   - 「アイコンの条件を満たしていない等、有効でない【ヒラメキ】の効果を発動させても何も起こらない」
//     → ability.condition (【解決編】等) 不成立は effect を queue せず skip (rules/17 持っていない扱い)。
//   - 「発動させた場合はすべての効果を解決 (一部だけ不可)」 → effect 全体を単一 queue (分割しない)。
//   - trait gate は印字判定 (rules/17 Q&A §「〜を持つ」は静的印字で判定): opts.trait 指定時、
//     対象 CardDef が印字 trait を持たなければ no-op (条件アイコン充足は問わない)。
//   - 「アクション中のキャラ」($trigger.byUid) 依存 ヒラメキ (B05111 等) を invoke した場合、
//     アクション[事件] 文脈でないため byUid unbound → resolveBindRef が literal 返却 → target 解決
//     失敗 → 当該 atom no-op (= 有効でない効果は何も起こらない、と整合)。payload に byUid を載せない。

import { def as readDef } from '../read/def.js';
import { evalCond } from '../cond/eval.js';
import { event } from '../event/index.js';
import { cardOccurrenceUid, isLiveCardOccurrenceWitness } from '../target/card-occurrence.js';
import type { GameState, AbilityDef, EffectCtx } from '../types/index.js';

type Player = 'self' | 'opp';
type HiramekiOccurrenceArea = 'evidence' | 'remove' | 'scene' | 'case' | 'partner-area' | 'hand' | 'file';
const HIRAMEKI_OCCURRENCE_AREAS = new Set<HiramekiOccurrenceArea>([
  'evidence', 'remove', 'scene', 'case', 'partner-area', 'hand', 'file',
]);

/** One concrete card occurrence. Invocation must never silently retarget a duplicate cardId. */
export type HiramekiOccurrence = {
  uid: string;
  cardId: string;
  player: Player;
  area: HiramekiOccurrenceArea;
  index?: number;
  occurrenceWitness?: string;
};

/** Runtime boundary for untrusted persisted/$pick occurrence data. */
export function isHiramekiOccurrence(value: unknown): value is HiramekiOccurrence {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const occurrence = value as Record<string, unknown>;
  if (typeof occurrence.uid !== 'string' || occurrence.uid.length === 0
    || typeof occurrence.cardId !== 'string' || occurrence.cardId.length === 0
    || (occurrence.player !== 'self' && occurrence.player !== 'opp')
    || typeof occurrence.area !== 'string'
    || !HIRAMEKI_OCCURRENCE_AREAS.has(occurrence.area as HiramekiOccurrenceArea)) return false;
  const needsIndex = occurrence.area === 'evidence' || occurrence.area === 'remove'
    || occurrence.area === 'partner-area' || occurrence.area === 'hand' || occurrence.area === 'file';
  if (needsIndex !== Number.isSafeInteger(occurrence.index)) return false;
  if (occurrence.area === 'evidence' || occurrence.area === 'remove') {
    return typeof occurrence.occurrenceWitness === 'string';
  }
  return occurrence.occurrenceWitness === undefined || typeof occurrence.occurrenceWitness === 'string';
}

function occurrenceAreaMatchesKind(cardId: string, area: HiramekiOccurrenceArea): boolean {
  const kind = readDef.card(cardId)?.kind;
  if (!kind) return false;
  if (area === 'scene') return kind === 'character';
  if (area === 'case') return kind === 'case';
  return area !== 'partner-area' || kind === 'partner';
}

export function liveHiramekiOccurrence(state: GameState, occurrence: HiramekiOccurrence): boolean {
  if (!isHiramekiOccurrence(occurrence) || !occurrenceAreaMatchesKind(occurrence.cardId, occurrence.area)) return false;
  const { player, area, cardId, index, uid } = occurrence;
  if (area === 'evidence') {
    return Number.isInteger(index)
      && uid === `evidence:${player}:${index}`
      && isLiveCardOccurrenceWitness(state, player, 'evidence', occurrence.occurrenceWitness)
      && state.players[player].evidence[index!]?.cardId === cardId;
  }
  if (area === 'remove') {
    return Number.isInteger(index)
      && uid === cardOccurrenceUid(player, 'remove', cardId, index!)
      && isLiveCardOccurrenceWitness(state, player, 'remove', occurrence.occurrenceWitness)
      && state.players[player].remove[index!] === cardId;
  }
  if (area === 'scene') return state.players[player].scene.some(card => card.uid === uid && card.cardId === cardId);
  if (area === 'case') return state.players[player].case?.cardId === cardId;
  if (area === 'partner-area') return Number.isInteger(index) && state.players[player].partnerAreaCards?.[index!] === cardId;
  if (area === 'hand') return Number.isInteger(index) && state.players[player].hand[index!] === cardId;
  if (area === 'file') return Number.isInteger(index) && state.players[player].file[index!]?.cardId === cardId;
  return false;
}

/**
 * cardId の CardDef が持つ triggered hook==='evidence:remove-by-action' (=【ヒラメキ】) ability の
 * effect を、player 所有の ctx で発動 (queue) させる。
 * - def 不在 → silent no-op。
 * - trait 指定時、印字 trait 不一致 → no-op (印字判定)。
 * - matcher / matcherCondition / ability.condition 不成立 → skip (何も起こらない)。
 * hiramekiSuppressed 等の「発動できない」制限は見ない (invoke は「効果」を発動させるため)。
 */
export function invokeHiramekiOfCard(
  state: GameState,
  source: HiramekiOccurrence | string,
  player?: Player,
  trait?: string,
): void {
  const occurrence: HiramekiOccurrence = typeof source === 'string'
    ? { uid: `invokeHir:${player ?? 'self'}:${source}`, cardId: source, player: player ?? 'self', area: 'evidence' }
    : source;
  // Compatibility callers may supply only cardId. Every physical DSL path supplies
  // an occurrence and fails closed if its selected object moved or was replaced.
  if (typeof source !== 'string' && !liveHiramekiOccurrence(state, occurrence)) return;
  const { cardId, player: owner, uid, area, index } = occurrence;
  const def = readDef.card(cardId);
  if (!def) return;
  // trait gate — 印字判定 (rules/17 Q&A: 静的印字で「〜を持つ」を判定)。
  if (trait !== undefined && !(def.traits ?? []).includes(trait)) return;
  const sourceUid = uid;
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'evidence:remove-by-action') continue;
    // ヒラメキは scope:'on-evidence'。仮想 area も 'evidence' 相当。
    // payload に byUid を載せない — アクション[事件] actor は存在しないため $trigger.byUid は unbound。
    const payload = { uid: sourceUid, cardId, player: owner, area, index, invoked: true };
    const baseCtx: EffectCtx = {
      source: { cardId, uid: sourceUid, abilityId: ability.id, player: owner, area },
      bindings: {
        occurrence: [{ kind: 'card', uid: sourceUid, cardId, player: owner, area, ...(index === undefined ? {} : { index }), ...(occurrence.occurrenceWitness === undefined ? {} : { occurrenceWitness: occurrence.occurrenceWitness }) }],
      },
      triggerPayload: payload,
    };
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    event.queue(
      state,
      ability.effect,
      { player: owner, uid: sourceUid, cardId, abilityId: ability.id, area, description: ability.description },
      'evidence:remove-by-action',
      payload,
      baseCtx.bindings,
      { deferredPicks: true },
    );
  }
}
