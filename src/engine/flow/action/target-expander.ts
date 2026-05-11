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

  // expander
  const seen = new Set(baseList.map(c => c.uid));
  const extra: TargetCandidate[] = [];
  for (const expander of _expanders.values()) {
    let returned: TargetCandidate[] = [];
    try {
      returned = expander(state, byUid);
    } catch {
      // 防御的: expander が throw しても candidates 全体は壊さない
      returned = [];
    }
    for (const c of returned) {
      if (!seen.has(c.uid)) {
        seen.add(c.uid);
        extra.push(c);
      }
    }
  }

  return [...baseList, ...extra];
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

  const out: TargetCandidate[] = [];
  for (const c of state.players[opp].scene) {
    if (c.turnEffects.mustBeTargeted === true) {
      out.push({ uid: c.uid, cardId: c.cardId, player: opp });
    }
  }
  return out;
}
