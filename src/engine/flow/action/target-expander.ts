// engine.flow.action target expander (G29) + mustBeTargeted (G28)
// spec: .claude/specs/engine-api-flow-control.md ("アクション対象拡張 / 強制指定")
// rules: 07-action-flow.md (通常の対象 = 相手の sleep / stun)
// cards: D11005 (mustBeTargeted 挑発), D11007 (level≥7 active 拡張)
//
// G29: registerTargetExpander でカード固有の対象拡張をプラグインで受ける。
// G28: turnEffects.mustBeTargeted=true のキャラがいる場合、それを必ず指定対象に含む。
//
// ActionContext と同様、expander は **モジュールレベル Map** で保持 (Immer の produce
// 境界を越えるため; state には積まない)。
//
// 注意:
//   - candidates() は通常候補 (rules/07) + 拡張候補のユニオン (uid で dedup)
//   - mustTargetCandidates() は opp の scene の turnEffects.mustBeTargeted===true のキャラ
//   - declare 側 (state-machine.ts) で mustTargetCandidates.length > 0 のとき
//     char target が mustTarget リストに含まれない場合は throw

import type { GameState } from '../../types/index.js';
import { def as readDef } from '../../read/def.js';
import { char as readChar } from '../../read/char.js';

type Player = 'self' | 'opp';
export type TargetCandidate = { uid: string; cardId: string; player: Player };
export type TargetExpander = (s: GameState, byUid: string) => TargetCandidate[];
type Unsubscribe = () => void;

const _expanders: Map<string, TargetExpander> = new Map();

/**
 * registerTargetExpander — 指定 uid を発火元とする対象拡張を登録する。
 *
 * 戻り値の Unsubscribe を呼ぶと該当 uid のエントリを削除する。
 * 同じ uid で複数回登録した場合は **後勝ち** (上書き)。
 */
export function registerTargetExpander(uid: string, expander: TargetExpander): Unsubscribe {
  _expanders.set(uid, expander);
  return () => {
    _expanders.delete(uid);
  };
}

export function _resetTargetExpanders(): void {
  _expanders.clear();
}

export function _hasExpander(uid: string): boolean {
  return _expanders.has(uid);
}

/**
 * actorPlayer — byUid のプレイヤー側を判定 (partner:self/opp 対応)
 */
function actorPlayer(state: GameState, byUid: string): Player | null {
  if (byUid === 'partner:self') return 'self';
  if (byUid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some(c => c.uid === byUid)) return p;
  }
  return null;
}

/**
 * candidates — アクション対象候補を返す。
 *
 * 通常 (rules/07): 相手の現場 + state ∈ {sleep, stun}
 * 拡張: registerTargetExpander で登録された expander の戻り値を追加
 *   - 同一 uid は dedup (base 優先)
 */
export function candidates(state: GameState, byUid: string): TargetCandidate[] {
  const actor = actorPlayer(state, byUid);
  if (!actor) return [];
  const opp: Player = actor === 'self' ? 'opp' : 'self';

  // base: rules/07 — opp の sleep / stun キャラ
  const baseList: TargetCandidate[] = [];
  for (const c of state.players[opp].scene) {
    if (c.state === 'sleep' || c.state === 'stun') {
      baseList.push({ uid: c.uid, cardId: c.cardId, player: opp });
    }
  }

  // expander (legacy registerTargetExpander; G29)
  const seen = new Set(baseList.map(c => c.uid));
  const extra: TargetCandidate[] = [];
  for (const expander of _expanders.values()) {
    let returned: TargetCandidate[];
    try {
      returned = expander(state, byUid);
    } catch {
      // 防御的: expander が throw しても candidates 全体は壊さない
      continue;
    }
    for (const c of returned) {
      if (!seen.has(c.uid)) {
        seen.add(c.uid);
        extra.push(c);
      }
    }
  }

  // D11007 v2 Phase 3: 「action:pre-target」 declarative trigger を直接 lookup
  //
  // Card-side DSL は trigger { hook: 'action:pre-target', selfOnly: true } + effect:
  // atom expandActionTargets { side, state[], levelMin, levelMax, hasSetCards } で表現される。
  // queue 経由の事後 resolve では candidates() の即時 enumeration に間に合わないので、
  // ここで直接 scene 上の triggered ability を walk して args を読む (sync inline)。
  applyPreTargetExpansion(state, byUid, actor, opp, seen, extra);

  // Task D E4 (2026-06-12): actionTargetsActive token —
  // 「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」の **付与版**
  // (B07090/B08029/B08032/B08037)。印字版は上の action:pre-target walk、付与版は攻撃キャラ自身の
  // turnEffects/「text:」keyword を hasTextAbility で直読みする (flag 不在時は byte 等価)。
  // 全消費者 (canActionAgainstChar / UI / AI) は candidates() 経由なので単一配線 (rules/07 対象拡張)。
  if (readChar.hasTextAbility(state, byUid, 'actionTargetsActive')) {
    for (const c of state.players[opp].scene) {
      if (c.state !== 'active') continue;
      if (seen.has(c.uid)) continue;
      seen.add(c.uid);
      extra.push({ uid: c.uid, cardId: c.cardId, player: opp });
    }
  }

  // engine mega-wave W2 (2026-07-03, P07/r24): untargetableByAction — 対象キャラ自身の継続 aura
  // 「相手の現場にいるキャラはこのキャラを指定してアクションできない」(B03057「スリープ状態の場合」等は
  // ability.condition で gate)。最終集合への負 filter = base/expander/pre-target 全経路を単一配線で除外
  // (rules/07)。hot-path guard (W2 review opus-lens nit): 候補側 (opp) の現場に token を **印字 def 上**
  // 持つキャラが 1 枚も居なければ per-candidate walk (evalCond 含む) を丸ごと skip — AI move-enum /
  // smoke の ~99% no-token 経路を素通し (静的 def 走査のみ、evalCond なし = 安価)。
  const merged = [...baseList, ...extra];
  const anyUntargetableDef = state.players[opp].scene.some(c => {
    const d = readDef.card(c.cardId);
    return d?.abilities?.some(a => a.type === 'continuous' && a.continuousModifier?.untargetableByAction === true) ?? false;
  });
  const filtered = anyUntargetableDef
    ? merged.filter(c => !readChar.selfContinuousFlag(state, c.uid, 'untargetableByAction'))
    : merged;
  // engine mega-wave W6 step5 (2026-07-04, r50/B04072): untargetableByActionAura — 同 side bearer が
  // filter 越しに他キャラを対象除外する aura 版。self bool 版と同じ静的 pre-check (候補側現場に aura
  // 宣言 def が 1 枚も無ければ per-candidate walk を丸ごと skip = no-token 経路素通し)。
  // ガード経路 (state-machine tryGuard) は candidates() 非経由 → 無改修で Q&A「ガード可能」と整合。
  const anyAuraDef = state.players[opp].scene.some(c => {
    const d = readDef.card(c.cardId);
    return d?.abilities?.some(a => a.type === 'continuous' && a.continuousModifier?.untargetableByActionAura !== undefined) ?? false;
  });
  if (!anyAuraDef) return filtered;
  return filtered.filter(c => !readChar.auraUntargetableByAction(state, c.uid));
}

function applyPreTargetExpansion(
  state: GameState,
  byUid: string,
  actor: Player,
  opp: Player,
  seen: Set<string>,
  extra: TargetCandidate[],
): void {
  for (const ownerSide of ['self', 'opp'] as const) {
    for (const sceneCard of state.players[ownerSide].scene) {
      if (readChar.originalAbilitiesDisabled(state, sceneCard.uid)) continue;
      const cardDef = readDef.card(sceneCard.cardId);
      if (!cardDef?.abilities) continue;
      for (const ab of cardDef.abilities) {
        if (ab.type !== 'triggered') continue;
        if (ab.trigger?.hook !== 'action:pre-target') continue;
        // selfOnly: source カード自身が attacker のときのみ
        if (ab.trigger?.selfOnly && sceneCard.uid !== byUid) continue;
        const eff = ab.effect;
        if (!eff || eff.kind !== 'atom' || eff.verb !== 'expandActionTargets') continue;
        const args = (eff.args ?? {}) as Record<string, unknown>;
        const sideArg = (args.side as 'self' | 'opp' | 'either' | undefined) ?? 'opp';
        const stateFilter = args.state as ('active' | 'sleep' | 'stun')[] | undefined;
        const levelMin = args.levelMin as number | undefined;
        const levelMax = args.levelMax as number | undefined;
        const hasSetCards = args.hasSetCards === true;
        const sides: Player[] = sideArg === 'opp' ? [opp]
          : sideArg === 'self' ? [actor]
          : [actor, opp]; // 'either'
        for (const sd of sides) {
          for (const c of state.players[sd].scene) {
            if (seen.has(c.uid)) continue;
            if (stateFilter && !stateFilter.includes(c.state)) continue;
            const lvl = readChar.level(state, c.uid);
            if (levelMin !== undefined && lvl < levelMin) continue;
            if (levelMax !== undefined && lvl > levelMax) continue;
            if (hasSetCards && c.setCards.length === 0) continue;
            seen.add(c.uid);
            extra.push({ uid: c.uid, cardId: c.cardId, player: sd });
          }
        }
      }
    }
  }
}

/**
 * mustTargetCandidates — 必ず指定すべき対象 (G28: turnEffects.mustBeTargeted=true)
 *
 * - 相手 (opp) の scene を走査
 * - turnEffects.mustBeTargeted === true のキャラのみ返す
 */
export function mustTargetCandidates(state: GameState, byUid: string): TargetCandidate[] {
  const actor = actorPlayer(state, byUid);
  if (!actor) return [];
  const opp: Player = actor === 'self' ? 'opp' : 'self';

  // BUG-101: 「このキャラを指定できる場合、必ず指定する」(D11005)。強制対象は legal な
  // action target (candidates = opp の sleep/stun + 拡張) でもある場合のみ。active 等で対象に
  // 取れない mustBeTargeted キャラは強制しない (state-machine enforce / canActionAgainstChar と整合)。
  const legal = candidates(state, byUid);
  const out: TargetCandidate[] = [];
  for (const c of state.players[opp].scene) {
    if (c.turnEffects.mustBeTargeted === true && legal.some(x => x.uid === c.uid)) {
      out.push({ uid: c.uid, cardId: c.cardId, player: opp });
    }
  }
  out.push(...mustTargetSelfOnceCandidates(state, byUid));
  return out;
}

function hasMustTargetSelfOnce(state: GameState, uid: string, cardId: string): boolean {
  if (readChar.originalAbilitiesDisabled(state, uid)) return false;
  const cardDef = readDef.card(cardId);
  return cardDef?.abilities?.some(ab =>
    ab.type === 'triggered'
    && ab.scope === 'on-scene'
    && ab.trigger?.hook === 'action:pre-target'
    && ab.effect?.kind === 'atom'
    && ab.effect.verb === 'mustTargetSelfOnce',
  ) ?? false;
}

/** B02022: declaration commit で同時発動した全コピーを【ターン1】消費する。 */
export function mustTargetSelfOnceCandidates(state: GameState, byUid: string): TargetCandidate[] {
  const actor = sceneActorPlayer(state, byUid);
  if (!actor) return []; // 印字は「相手の現場にいるキャラ」がアクションするとき。partner は対象外。
  const opp: Player = actor === 'self' ? 'opp' : 'self';
  const legal = candidates(state, byUid);
  return state.players[opp].scene.flatMap((c) =>
    hasMustTargetSelfOnce(state, c.uid, c.cardId)
      && c.turnEffects.mustTargetSelfOnce !== state.turn.number
      && legal.some(x => x.uid === c.uid)
      ? [{ uid: c.uid, cardId: c.cardId, player: opp }]
      : [],
  );
}

export function consumeMustTargetSelfOnce(state: GameState, byUid: string): void {
  const actor = sceneActorPlayer(state, byUid);
  if (!actor) return;
  const opp: Player = actor === 'self' ? 'opp' : 'self';
  for (const c of state.players[opp].scene) {
    if (hasMustTargetSelfOnce(state, c.uid, c.cardId)) {
      c.turnEffects.mustTargetSelfOnce = state.turn.number;
    }
  }
}

function sceneActorPlayer(state: GameState, byUid: string): Player | null {
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some(c => c.uid === byUid)) return p;
  }
  return null;
}
