// engine.flow.guard — ガード判定 (Phase 4 Group B Task 4.7)
// spec: .claude/specs/engine-api-flow-contact.md
// rules: 07-action-flow.md, 13-keywords.md (ブレット), 24-qa-naming-stun.md (名乗りOK)
//
// 仕様:
//   - candidates: 防御側 (相手側) の active キャラ。名乗り状態 OK。AP条件なし
//   - 攻撃側が ブレット を持つ場合 candidates は [] (ガード不可)
//   - canGuard: 攻撃側ブレット判定 + 候補判定

import type { GameState } from '../types/index.js';
import { char as readChar } from '../read/char.js';
import { def as readDef } from '../read/def.js';

type Player = 'self' | 'opp';

/**
 * findActorPlayer: byUid から攻撃側プレイヤーを判定
 *  - partner:self/opp 対応
 *  - 通常キャラは scene からスキャン
 */
function findActorPlayer(state: GameState, uid: string): Player | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some(c => c.uid === uid)) return p;
  }
  return null;
}

/**
 * candidates — ガード候補
 *
 * 攻撃側 (byUid) に対し、防御側プレイヤー (反対側) の **active** キャラ全員を返す。
 * 名乗り状態 OK (rules/24)、AP条件なし (rules/07)。
 * ⚠ 攻撃側が ブレット を持つ場合 [] を返す (ガード不可)。
 */
export function candidates(
  state: GameState,
  byUid: string,
  // Task D E4 (2026-06-12): アクション対象キャラ自身はガード不可 (B09028/B09054 公式Q&A
  // 「相手のアクションで指定された場合、そのキャラ自身でガードすることはできますか？→いいえ」)。
  // sleepGuard 導入前は guard候補=active / 対象=sleep|stun で集合が排反のため暗黙成立していた。
  // 省略時 (undefined) は従来挙動 (byte 等価)。
  excludeUid?: string,
): { uid: string; cardId: string }[] {
  // 攻撃側ブレット判定 (rules/13)
  if (byUid !== 'partner:self' && byUid !== 'partner:opp') {
    if (readChar.hasKeyword(state, byUid, 'ブレット')) {
      return [];
    }
  }
  // パートナーキャラのブレット判定は Phase 5 で読み出し API を拡張する想定
  // (現状 read.char はキャラのみ対象なので、partner uid の場合は ブレットチェックを skip)

  const attackerSide = findActorPlayer(state, byUid);
  if (!attackerSide) return [];
  const defenderSide: Player = attackerSide === 'self' ? 'opp' : 'self';

  // Bearer-only prohibition (B01082): unlike Bullet, this never changes the
  // attacker or other defenders' guard legality.
  const hasCannotGuardBearer = state.players[defenderSide].scene.some(c => {
    const d = readDef.card(c.cardId);
    return d?.abilities?.some(a => a.type === 'continuous' && a.continuousModifier?.cannotGuard === true) ?? false;
  });

  // Task D E4 (2026-06-12): sleepGuard token — 「このキャラはスリープ状態でもガードできる。」
  // (B09054/B09028)。スタンは flag があっても不可 (rules/03 行動不可)。flag 不在時は従来と byte 等価。
  return state.players[defenderSide].scene
    .filter(c => c.uid !== excludeUid)
    .filter(c => c.state === 'active'
      || (c.state === 'sleep' && readChar.hasTextAbility(state, c.uid, 'sleepGuard')))
    .filter(c => !hasCannotGuardBearer || !readChar.selfContinuousFlag(state, c.uid, 'cannotGuard'))
    .map(c => ({ uid: c.uid, cardId: c.cardId }));
}

/**
 * canGuard — guardUid がガードできるか
 *
 * - 攻撃側がブレットなら false
 * - guardUid が候補リストに含まれていれば true
 */
export function canGuard(state: GameState, byUid: string, guardUid: string, excludeUid?: string): boolean {
  const list = candidates(state, byUid, excludeUid);
  return list.some(c => c.uid === guardUid);
}

/**
 * mustGuardCandidates — ガード義務のある候補 (engine mega-wave W2b 2026-07-03, r28)
 *
 * 「このキャラはガードできる場合、必ずガードする。」(B09040 a2 が charSetTurnEffect で付与) の
 * enforce 用。candidates() の legal 集合のうち、防御側キャラの mustGuard token
 * (turnEffects flag / 'text:' 擬似キーワード、hasTextAbility 2チャネル) が立っているものだけ返す。
 *
 * candidates() を legal 集合とすることで公式Q&A が自動成立:
 *  - スリープ等でガードできない義務 char は候補外 → 強制されない
 *  - 攻撃側ブレット → 候補 [] → 義務なし
 *  - アクション対象自身 (excludeUid) → 候補外 → 義務なし
 * 非空のとき passGuard は throw (pass 不可) / tryGuard は本リスト内 uid のみ許可
 * (義務 char 複数は「その中から持ち主が1枚選択」公式Q&A)。
 * consumer 0 (flag 未 set) なら常に [] = 既存挙動 byte 等価。
 */
export function mustGuardCandidates(
  state: GameState,
  byUid: string,
  excludeUid?: string,
): { uid: string; cardId: string }[] {
  // engine additive A2 (2026-07-11, B03041 直球勝負): 攻撃側起点の強制ガード token。
  // 「このキャラ (attacker=byUid) がアクションしたとき、相手はガードできる場合、必ずガードする。」
  // = attacker が 'text:forceGuard' を持つとき、legal な防御候補すべてが義務化される (公式Q&A:
  // 「ガードできるキャラが1枚以上いる場合、その中から1枚でガードしなければいけない」)。
  // 従来の防御側 'mustGuard' token (B09040 a2) は個別 char 単位の義務。両者は OR で合流し
  // candidates() の legal 集合 (スリープ/ブレット/対象自身除外) を共有するため公式Q&A が自動成立。
  // hasTextAbility は turnEffects + keywords() (on-set-host grantKeywords 'text:forceGuard' 含む) の
  // 2チャネルを見るため B03041 のセットイベント継続付与を honor。consumer 0 なら [] = byte 等価。
  const attackerForces = readChar.hasTextAbility(state, byUid, 'forceGuard');
  return candidates(state, byUid, excludeUid)
    .filter(c => attackerForces || readChar.hasTextAbility(state, c.uid, 'mustGuard'));
}

export const guard = {
  candidates,
  canGuard,
  mustGuardCandidates,
};
