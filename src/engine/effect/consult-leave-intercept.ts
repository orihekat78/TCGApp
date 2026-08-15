// engine.effect.consult-leave-intercept — 現場離脱の pre-splice consult (mega-wave W6 step10, row9)
// rules: 07/08 (コンタクト), 15 (してもよい), 16 (セット), 17 (現場リムーブ時), 21 (コスト)
//
// B01092 松田陣平「【相手ターン中】自分の現場にいるこのキャラ以外のキャラ1枚が相手の能力や効果、
// コンタクトによって現場から離れるとき、このキャラをリムーブしてもよい。そうした場合、そのキャラは
// 現場から離れる代わりに手札に移す。」(optional / destination:'hand') と
// B01039「このイベントがセットされているキャラが相手の能力や効果、コンタクトによって現場から
// 離れるとき、このイベントをリムーブし、そのキャラは現場から離れる代わりに現場に残る。」
// (on-set-host / 強制 / destination:'kept-in-scene') の判定部。
//
// 設計:
//   - **純関数 (state 無変更)**。mutate.scene.removeToRemove が splice 前に呼び、verdict に従って
//     コスト支払 / redirect を適用する (mutation の一元化 + 本 module → mutate の import cycle 回避)。
//   - event.emit('leave:intercept') は**しない** — invoke-leave-to-remove.ts と同じ理由 (emit すると
//     in-play scan の第三者 observer が誤発火しうる)。対象 def を直接走査する consult 型。
//   - 帰属 gate: 「相手の能力や効果、コンタクトによって」= cause 'contact-ap' (構造的に相手帰属、
//     rules/08) or cause 'effect' + byPlayer(効果 source 側) ≠ 離場キャラ owner。byPlayer 未伝搬の
//     legacy caller (turn.ts removeOnTurnEnd 等) は fail-closed で intercept しない (DEFERRED-INDEX)。
//     'cost'/'switch'/'misplay-overflow' は自己帰属 → 対象外。
//   - optional (B01092 型) は **AI-only**: 所有側が human の場合は null (素通し = 通常リムーブ)。
//     human-defender の accept/decline window (state-machine 'leave-intercept-window' phase) は
//     別 increment に明示 DEFER (row9 risks(e) — 【相手ターン中】ゆえ human 防御が主用途、要 loud 記録)。
//     AI は「コスト (このキャラをリムーブ) が支払可能なら accept」= 在場なら常に accept (簡易 heuristic)。
//   - 強制 set-card rider (B01039 型) を optional より先に判定 (キャラが動かない保全が優先。
//     複数 faceUp rider は全部消費して kept-in-scene 1 回 — 公式Q&A「2枚ともリムーブされます」)。

import { def as readDef } from '../read/def.js';
import { evalCond } from '../cond/eval.js';
import { char as readChar } from '../read/char.js';
import type { GameState, SceneCharacter, AbilityDef } from '../types/index.js';

type Player = 'self' | 'opp';

function getHumanPlayerSide(): Player | null {
  return (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
}

export type LeaveInterceptVerdict =
  | { kind: 'hand'; interceptorUid: string }
  | { kind: 'pending'; interceptorUid: string }
  | { kind: 'kept-in-scene'; consumedSetCards: string[] }
  | null;

function destinationOf(ability: AbilityDef): string | undefined {
  const eff = ability.effect as { kind?: string; verb?: string; args?: { destination?: string } } | undefined;
  if (eff && eff.kind === 'atom' && eff.verb === 'leaveInterceptRedirect') return eff.args?.destination;
  return undefined;
}

/** Definition-level identity check for a persisted optional hand redirect. */
export function isOptionalHandLeaveInterceptAbility(cardId: string, abilityId: string): boolean {
  const ability = readDef.card(cardId)?.abilities.find((candidate) => candidate.id === abilityId);
  if (!ability || ability.type !== 'triggered') return false;
  const trigger = ability.trigger;
  return trigger?.hook === 'leave:intercept'
    && trigger.optional === true
    && (ability.scope === undefined || ability.scope === 'on-scene' || ability.scope === 'always')
    && destinationOf(ability) === 'hand';
}

/** Recompute one exact live optional interceptor before accepting its public answer. */
export function findLiveHandLeaveInterceptor(
  state: GameState,
  target: SceneCharacter,
  player: Player,
  interceptorUid: string,
  byUid?: string,
): { cardId: string; abilityId: string } | null {
  const interceptor = state.players[player].scene.find((char) => char.uid === interceptorUid);
  if (!interceptor || interceptor.uid === target.uid || readChar.originalAbilitiesDisabled(state, interceptor.uid)) return null;
  const def = readDef.card(interceptor.cardId);
  if (!def) return null;
  const payload = { uid: target.uid, cause: 'contact-ap', byUid, ownerPlayer: player };
  for (const ability of def.abilities as AbilityDef[]) {
    if (!isOptionalHandLeaveInterceptAbility(interceptor.cardId, ability.id)) continue;
    const baseCtx = {
      source: { cardId: interceptor.cardId, uid: interceptor.uid, abilityId: ability.id, player, area: 'scene' as const },
      bindings: {},
      triggerPayload: payload,
    };
    if (ability.trigger?.matcherCondition && !evalCond(state, ability.trigger.matcherCondition, baseCtx as never)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx as never)) continue;
    return { cardId: interceptor.cardId, abilityId: ability.id };
  }
  return null;
}

export function consultLeaveIntercept(
  state: GameState,
  char: SceneCharacter,
  player: Player,
  cause: string,
  byUid?: string,
  byPlayer?: Player,
): LeaveInterceptVerdict {
  const attributed =
    cause === 'contact-ap' || (cause === 'effect' && byPlayer !== undefined && byPlayer !== player);
  if (!attributed) return null;
  const payload = { uid: char.uid, cause, byUid, ownerPlayer: player };

  // (1) 強制 set-card rider (B01039 型、on-set-host) — faceUp のみ (rules/16 裏向きは非イベント)
  const consumed: string[] = [];
  for (const entry of char.setCards) {
    if (!entry.faceUp) continue;
    const def = readDef.card(entry.cardId);
    if (!def) continue;
    for (const ability of def.abilities as AbilityDef[]) {
      if (ability.type !== 'triggered') continue;
      const trig = ability.trigger;
      if (!trig || trig.hook !== 'leave:intercept' || trig.optional) continue;
      if (ability.scope !== 'on-set-host') continue;
      const baseCtx = {
        source: { cardId: entry.cardId, uid: char.uid, abilityId: ability.id, player, area: 'scene' as const },
        bindings: {},
        triggerPayload: payload,
      };
      if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx as never)) continue;
      if (ability.condition && !evalCond(state, ability.condition, baseCtx as never)) continue;
      if (destinationOf(ability) !== 'kept-in-scene') continue;
      consumed.push(entry.cardId);
      break; // 1 entry につき 1 判定
    }
  }
  if (consumed.length > 0) return { kind: 'kept-in-scene', consumedSetCards: consumed };

  // (2) optional 現場 interceptor (B01092 型) — AI-only (human 所有は DEFER 素通し)
  for (const c of state.players[player].scene) {
    if (c.uid === char.uid) continue; // 「このキャラ以外」は構造的除外 (印字の filter 句ではない)
    if (readChar.originalAbilitiesDisabled(state, c.uid)) continue;
    const def = readDef.card(c.cardId);
    if (!def) continue;
    for (const ability of def.abilities as AbilityDef[]) {
      if (ability.type !== 'triggered') continue;
      const trig = ability.trigger;
      if (!trig || trig.hook !== 'leave:intercept' || trig.optional !== true) continue;
      if (ability.scope !== undefined && ability.scope !== 'on-scene' && ability.scope !== 'always') continue;
      const baseCtx = {
        source: { cardId: c.cardId, uid: c.uid, abilityId: ability.id, player, area: 'scene' as const },
        bindings: {},
        triggerPayload: payload,
      };
      if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx as never)) continue;
      if (ability.condition && !evalCond(state, ability.condition, baseCtx as never)) continue;
      if (destinationOf(ability) !== 'hand') continue;
      if (getHumanPlayerSide() === player) return { kind: 'pending', interceptorUid: c.uid };
      // AI heuristic: コスト (interceptor 自身のリムーブ) は在場なら常に支払可能 → accept
      // (常時 accept は戦略最適でない既知の簡易化 — row9 risks(d)、DEFERRED-INDEX)
      return { kind: 'hand', interceptorUid: c.uid };
    }
  }
  return null;
}
