// engine.flow.action — アクション状態機械 (Phase 4 Group B Task 4.4)
// spec: .claude/specs/engine-api-flow-control.md
// rules: 07-action-flow.md, 08-contact.md, 22-qa-action-contact.md
//
// 9 フェーズ:
//   declared → guard-window → leave-resolution → contact-pending →
//   action-1 → action-2 → (action-1-redo if applicable) → judge → contact-end → action-end
//
// ActionContext は **モジュールレベルの Map** で保持する (state に積まない)。
// 理由:
//   - Immer の produce() は state を新規オブジェクトに置き換えるため
//   - 状態機械の遷移は副作用として state を mutate するが、context 自体は GameState 外
//   - テスト用に _resetActionContexts() を公開
//
// 注意: caller は produce(state, draft => { flow.action.declare(draft, ...); ... }) で呼ぶ。

import type { GameState, ActionContext, ActionPhase } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { char as readChar } from '../../read/char.js';
import { canActionAgainstChar, canActionAgainstCase } from '../main/action.js';
import { canGuard } from '../guard.js';

type Player = 'self' | 'opp';
type Target = ActionContext['target'];

// ActionContext モジュールレベル保持
const _contexts: Map<string, ActionContext> = new Map();
let _idCounter = 0;

function nextId(): string {
  _idCounter += 1;
  return `ax_${_idCounter}`;
}

export function _resetActionContexts(): void {
  _contexts.clear();
  _idCounter = 0;
}

export function _getContext(id: string): ActionContext | undefined {
  return _contexts.get(id);
}

/**
 * findActor: byUid からプレイヤー側を判定 (canAction* で重複している処理だが、
 * ここでは internal use のみ)
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
 * byUid のスリープ化 (rules/07: アクション宣言時にスリープ)
 */
function sleepActor(state: GameState, uid: string): void {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    mutate.partner.setState(state, p, 'sleep');
  } else {
    mutate.scene.setState(state, uid, 'sleep');
  }
}

/**
 * declare — アクション宣言
 *
 * - canAction* で可否確認
 * - byUid スリープ化
 * - action:declare emit
 * - ActionContext 生成 (phase='declared' → 即時 'guard-window' へ遷移)
 */
export function declare(state: GameState, byUid: string, target: Target): ActionContext {
  // 可否確認
  if (target.kind === 'char') {
    if (!canActionAgainstChar(state, byUid, target.uid)) {
      throw new Error(`flow.action.declare: cannot action by ${byUid} against char ${target.uid}`);
    }
  } else {
    if (!canActionAgainstCase(state, byUid, target.player)) {
      throw new Error(`flow.action.declare: cannot action by ${byUid} against case ${target.player}`);
    }
  }

  const byPlayer = findActorPlayer(state, byUid);
  if (!byPlayer) {
    throw new Error(`flow.action.declare: actor not found ${byUid}`);
  }

  // byUid スリープ化
  sleepActor(state, byUid);

  // ActionContext 生成
  const id = nextId();
  const ax: ActionContext = {
    id,
    byUid,
    byPlayer,
    target,
    phase: 'declared',
    startedAt: { turn: state.turn.number, nano: Date.now() },
    cutInUsed: {},
  };
  _contexts.set(id, ax);

  // action:declare emit (spec: { byUid, target })
  event.emit(state, 'action:declare', { byUid, target }, { player: byPlayer, uid: byUid });

  // 即座に guard-window へ遷移
  ax.phase = 'guard-window';
  event.emit(state, 'action:guard-window', { byUid, target }, { player: byPlayer, uid: byUid });

  return ax;
}

/**
 * tryGuard — ガード成立
 *
 * - canGuard で確認 (引数で guardUid)
 * - guardUid スリープ化
 * - action:guarded emit (spec: { byUid, guardUid })
 * - phase → 'leave-resolution'
 */
export function tryGuard(state: GameState, ax: ActionContext, guardUid: string): void {
  if (!canGuard(state, ax.byUid, guardUid)) {
    throw new Error(`flow.action.tryGuard: invalid guard ${guardUid} for action by ${ax.byUid}`);
  }

  ax.guardUid = guardUid;
  ax.guarded = { guardUid };
  // guardUid スリープ化
  mutate.scene.setState(state, guardUid, 'sleep');

  event.emit(
    state,
    'action:guarded',
    { byUid: ax.byUid, guardUid },
    { player: ax.byPlayer, uid: ax.byUid },
  );

  ax.phase = 'leave-resolution';
}

/**
 * passGuard — ガード不成立 (相手がガードしない選択)
 *
 * - action:unguarded emit (spec: { byUid, target })
 * - phase: char target → 'leave-resolution', case target → 'judge' (actionCase 側で処理)
 */
export function passGuard(state: GameState, ax: ActionContext): void {
  event.emit(
    state,
    'action:unguarded',
    { byUid: ax.byUid, target: ax.target },
    { player: ax.byPlayer, uid: ax.byUid },
  );

  if (ax.target.kind === 'char') {
    ax.phase = 'leave-resolution';
  } else {
    // actionCase は judge フェーズで証拠操作する設計
    ax.phase = 'judge';
  }
}

/**
 * computeOrder — コンタクト行動順 (rules/08)
 *
 * AP 低い側が 1 番目。同値の場合は **アクションされた側 (= 非ターンプレイヤー)** が 1 番目。
 *
 * @param aAP 攻撃側 AP
 * @param bAP 防御側 AP
 * @param attackerSide 攻撃側プレイヤー
 */
export function computeOrder(
  aAP: number,
  bAP: number,
  attackerSide: { aUid: string; bUid: string },
): { firstUid: string; secondUid: string } {
  if (aAP < bAP) {
    return { firstUid: attackerSide.aUid, secondUid: attackerSide.bUid };
  }
  if (aAP > bAP) {
    return { firstUid: attackerSide.bUid, secondUid: attackerSide.aUid };
  }
  // 同値: 防御側 (アクションされた側 = 非ターンプレイヤー) が 1 番目
  return { firstUid: attackerSide.bUid, secondUid: attackerSide.aUid };
}

/**
 * snapshotAP — AP スナップショット
 *
 * - 攻撃側 (byUid) と 対象 (target char or guard char) の AP を取得
 * - ax.apSnapshot に保存
 * - contact:before-judge emit (spec: { aUid, bUid, aAP, bAP })
 */
export function snapshotAP(state: GameState, ax: ActionContext): void {
  const aUid = ax.byUid;
  let bUid: string;
  if (ax.guardUid) {
    bUid = ax.guardUid;
  } else if (ax.target.kind === 'char') {
    bUid = ax.target.uid;
  } else {
    // case target: AP 判定はないが、念のため安全側で aUid を入れる
    bUid = aUid;
  }

  const aAP = readChar.ap(state, aUid);
  const bAP = readChar.ap(state, bUid);

  ax.apSnapshot = { aUid, aAP, bUid, bAP };

  event.emit(
    state,
    'contact:before-judge',
    { aUid, bUid, aAP, bAP },
    { player: ax.byPlayer, uid: ax.byUid },
  );
}

/**
 * abortIfMissing — byUid or target char がいなければ即座に action-end
 *
 * rules/07: ガードまでに攻撃キャラ or 対象が現場を離れた場合、アクションはその時点で終了
 */
export function abortIfMissing(state: GameState, ax: ActionContext): void {
  const byMissing =
    ax.byUid !== 'partner:self' &&
    ax.byUid !== 'partner:opp' &&
    findActorPlayer(state, ax.byUid) === null;

  let targetMissing = false;
  if (ax.target.kind === 'char') {
    const targetUid = ax.target.uid;
    let found = false;
    for (const p of ['self', 'opp'] as const) {
      if (state.players[p].scene.some(c => c.uid === targetUid)) {
        found = true;
        break;
      }
    }
    targetMissing = !found;
  }

  if (byMissing || targetMissing) {
    ax.phase = 'action-end';
    event.emit(
      state,
      'action:end',
      { byUid: ax.byUid, result: 'aborted' },
      { player: ax.byPlayer, uid: ax.byUid },
    );
  }
}

/**
 * advance — フェーズ遷移
 *
 * 各フェーズで適切な Hook を emit しつつ次フェーズへ。
 */
export function advance(state: GameState, ax: ActionContext): void {
  const phase = ax.phase;

  if (phase === 'declared') {
    ax.phase = 'guard-window';
    return;
  }

  if (phase === 'guard-window') {
    // ガード判定終了後、leave-resolution へ
    ax.phase = 'leave-resolution';
    return;
  }

  if (phase === 'leave-resolution') {
    // 【現場リムーブ時】解決後、コンタクト発生
    ax.phase = 'contact-pending';
    return;
  }

  if (phase === 'contact-pending') {
    // case target は判定スキップして judge へ
    if (ax.target.kind === 'case') {
      ax.phase = 'judge';
      return;
    }
    // char target: コンタクト開始
    const aUid = ax.byUid;
    const bUid = ax.guardUid ?? (ax.target as { kind: 'char'; uid: string }).uid;
    event.emit(state, 'contact:start', { aUid, bUid }, { player: ax.byPlayer, uid: ax.byUid });

    // 行動順 (AP は snapshot 後だが、ここでは未スナップショットでも先に order を計算)
    // -> snapshotAP は judge 直前。ここでは即時 AP 参照で十分
    const aAP = readChar.ap(state, aUid);
    const bAP = readChar.ap(state, bUid);
    const order = computeOrder(aAP, bAP, { aUid, bUid });
    ax.firstUid = order.firstUid;
    ax.secondUid = order.secondUid;

    event.emit(
      state,
      'contact:order-set',
      { firstUid: order.firstUid, secondUid: order.secondUid },
      { player: ax.byPlayer, uid: ax.byUid },
    );

    ax.phase = 'action-1';
    return;
  }

  if (phase === 'action-1') {
    ax.phase = 'action-2';
    return;
  }

  if (phase === 'action-2') {
    // redo 判定: 1番目 pass (firstActed=false) かつ 2番目 acted (secondActed=true)
    if (ax.firstActed === false && ax.secondActed === true) {
      ax.phase = 'action-1-redo';
    } else {
      ax.phase = 'judge';
    }
    return;
  }

  if (phase === 'action-1-redo') {
    ax.phase = 'judge';
    return;
  }

  if (phase === 'judge') {
    ax.phase = 'contact-end';
    event.emit(state, 'contact:end', {}, { player: ax.byPlayer, uid: ax.byUid });
    return;
  }

  if (phase === 'contact-end') {
    ax.phase = 'action-end';
    event.emit(
      state,
      'action:end',
      { byUid: ax.byUid, result: 'completed' },
      { player: ax.byPlayer, uid: ax.byUid },
    );
    return;
  }

  // action-end は終端
}

// flow.action namespace
export const action = {
  declare,
  tryGuard,
  passGuard,
  advance,
  abortIfMissing,
  snapshotAP,
  computeOrder,
  _resetActionContexts,
  _getContext,
};

// ActionPhase 型の re-export 用 (consumer 側で `type` import するため)
export type { ActionPhase };
