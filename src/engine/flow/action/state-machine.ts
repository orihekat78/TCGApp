// engine.flow.action — アクション状態機械 (Phase 4 Group B Task 4.4)
// spec: .claude/specs/engine-api-flow-control.md
// rules: 07-action-flow.md, 08-contact.md, 22-qa-action-contact.md
//
// 状態遷移:
//   declared → guard-window → leave-resolution → contact-pending → contact-order-pending →
//   action-1 → action-2 → (action-1-redo if applicable) → judge → contact-end → action-end
//
// ActionContext は GameState に保持する。save/replay/produce rollback の境界を越えても
// 進行中アクションと採番が一致し、別matchへmodule-global stateが漏れない。
//
// 注意: caller は produce(state, draft => { flow.action.declare(draft, ...); ... }) で呼ぶ。
import { continuePendingContactOrder } from './contact-order-continuation.js';
import type { GameState, ActionContext, ActionPhase } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { clearActionScopedState, clearContactScopedState } from '../../mutate/action-scopes.js';
import { event } from '../../event/index.js';
import { char as readChar } from '../../read/char.js';
import { def as readDef } from '../../read/def.js';
import { canActionAgainstChar, canActionAgainstCase } from '../main/action.js';
import { canGuard, mustGuardCandidates } from '../guard.js';
import { buildContactBindings } from '../contact.js';
import { finalizePendingHiramekiEvidenceRemoval, gainSelfEvidence } from '../action-case.js';
import { computeOrder } from './order.js';
import { contextForState } from './context-registry.js';
import { withStructuredCausalResolution } from '../../log/effect-causal.js';
import {
  actionCorrelationEventId,
  completeActionCausalOperation,
  otherPlayer,
  publicUidLocator,
  recordActionCausalOperation,
  startActionCausalTrace,
} from './causal.js';
import {
  candidates as targetCandidates,
  consumeMustTargetSelfOnce,
  mustTargetCandidates,
  registerTargetExpander,
  _resetTargetExpanders,
} from './target-expander.js';
// Re-export computeOrder for callers that import from state-machine directly
export { computeOrder };

type Player = 'self' | 'opp';
type Target = ActionContext['target'];
/** partner / scene 共通の effective AP reader。 */
const readEffectiveAp = readChar.ap;

/**
 * User request 2026-05-25: contact 開始時に「レベルX キャラ名(ID):APXXXX VS 〜」を
 * log に出力するための format helper。partner uid も考慮 (level は CardDef.level)。
 */
function formatContactSide(s: GameState, uid: string): string {
  let cardId: string | undefined;
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    cardId = s.players[p].partner?.cardId;
  } else {
    for (const p of ['self', 'opp'] as const) {
      const c = s.players[p].scene.find(c => c.uid === uid);
      if (c) { cardId = c.cardId; break; }
    }
  }
  if (!cardId) return `${uid}:AP?`;
  const d = readDef.card(cardId);
  const name = d?.names?.[0] ?? cardId;
  const level = d?.level ?? '?';
  const ap = readEffectiveAp(s, uid);
  return `Lv${level} ${name}(${cardId}):AP${ap}`;
}

function formatContactDetail(s: GameState, aUid: string, bUid: string): string {
  return `${formatContactSide(s, aUid)} VS ${formatContactSide(s, bUid)}`;
}

function contexts(state: GameState): Record<string, ActionContext> {
  state.actionContexts ??= {};
  return state.actionContexts;
}

function nextId(state: GameState): string {
  let seq = state.actionContextSeq ?? 0;
  for (const id of Object.keys(state.actionContexts ?? {})) {
    const match = /^ax_(\d+)$/.exec(id);
    if (match) seq = Math.max(seq, Number(match[1]));
  }
  state.actionContextSeq = seq + 1;
  return `ax_${state.actionContextSeq}`;
}

/** @deprecated ActionContext is state-owned; retained as a no-op for old setup code. */
export function _resetActionContexts(): void {
  // no-op
}

export function _getContext(state: GameState, id: string): ActionContext | undefined {
  return state.actionContexts?.[id];
}

/**
 * Immer の produce 境界を越えて保持された ActionContext は frozen object になり得る。
 * public mutator は必ず現在の GameState 内の draft-owned instance へ解決してから更新する。
 */
/** A declared ability cannot begin while any ActionContext is still resolving. */
export function _hasOpenActionContext(state: GameState): boolean {
  return Object.values(state.actionContexts ?? {}).some((context) => context.phase !== 'action-end');
}

/**
 * _deleteContext — ActionContext をレジストリから削除
 *
 * advance が 'action-end' に遷移したとき呼ぶ。
 * 長いゲームでの Map の無限成長を防ぐためのメモリ管理。
 * Context 本体は GameState 所有。完了時に state registry から除去する。
 */
export function _deleteContext(state: GameState, id: string): void {
  if (state.actionContexts) delete state.actionContexts[id];
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
    // G28: mustBeTargeted 強制指定モード (rules: cards-analysis/D11005)
    // 相手の scene に turnEffects.mustBeTargeted=true のキャラがいる場合、
    // char target はそのリストから選ばなければならない。
    // 注: case target はこの制約を受けない (rules: 公式テキスト「相手の現場にいるキャラがアクションするとき」)。
    const mustList = mustTargetCandidates(state, byUid);
    if (mustList.length > 0 && !mustList.some(c => c.uid === target.uid)) {
      const uids = mustList.map(c => c.uid).join(', ');
      throw new Error(
        `flow.action.declare: must target one of [${uids}] (mustBeTargeted enforced)`,
      );
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

  // B02022: pre-target preview では消費せず、合法性と強制指定が確定した宣言時にだけ消費する。
  consumeMustTargetSelfOnce(state, byUid);

  // ActionContext 生成
  const id = nextId(state);
  const ax: ActionContext = {
    id,
    byUid,
    byPlayer,
    target,
    phase: 'declared',
    startedAt: { turn: state.turn.number, nano: Date.now() },
    cutInUsed: {},
  };
  contexts(state)[id] = ax;

  startActionCausalTrace(state, ax);
  // byUid スリープ化
  sleepActor(state, byUid);
  recordActionCausalOperation(state, ax, {
    actor: byPlayer,
    kind: 'sleep',
    source: { kind: 'player', side: byPlayer },
    targets: [publicUidLocator(state, byUid, byPlayer)],
    outcome: { type: 'state', state: 'sleep' },
  });

  // action:declare emit (spec: { byUid, target })
  // 2026-06-06 タスクC: triggerCharMatches が payload.uid/player を読めるよう uid/player を併記
  // (multi-hook trigger で「自分の現場の[X]がアクションしたとき」を gate するため、reasoning:end と統一)。
  // 既存 consumer は byUid/target / source.uid (selfOnly) のみ参照のため additive。
  // engine拡張 wave#2 cluster3 (2026-06-13): targetUid を flat 併記 (char target 時のみ)。
  // 「指定したキャラ」(B08048) を $trigger.targetUid / triggerCharMatches{payloadKey:'targetUid'} で
  // 参照可能にする ($trigger.<field> は flat 一階解決のみのため。宣言時 snapshot — ガード成立後も
  // guardUid に差し替えない、qAndA「ガードされてもレベル-1適用済」)。
  event.emit(state, 'action:declare', {
    byUid, target, uid: byUid, player: byPlayer,
    targetUid: target.kind === 'char' ? target.uid : undefined,
  }, { player: byPlayer, uid: byUid }, {
    causalCorrelationEventId: ax.causalTrace?.rootEventId,
  });

  // engine additive wave-7 (2026-07-02, P17): アクション[キャラ]宣言時、actor へ「今ターン アクション[キャラ]
  // した」flag を立てる (rules/22: 宣言=ガード判定前に確定、ガード有無・成否に依らず「アクションした」)。
  // アクション[事件] (target.kind==='case') では立てない。actor が partner (uid='partner:*') の場合
  // setTurnEffect は findChar 不在で no-op。清掃は clearTurnEffects('turn') (ターン終了)。TargetFilter.
  // actedCharThisTurn が honor。B08049「このターン中にアクション[キャラ]していた〚特徴[FBI]〛のキャラ」。
  if (target.kind === 'char') {
    mutate.char.setTurnEffect(state, byUid, 'actedCharThisTurn', true);
  }

  // 即座に guard-window へ遷移
  ax.phase = 'guard-window';
  event.emit(state, 'action:guard-window', { byUid, target }, { player: byPlayer, uid: byUid }, {
    causalCorrelationEventId: ax.causalTrace?.rootEventId,
  });

  return ax;
}

/**
 * startFromEffect — 「コンタクトを発生させる」効果の bootstrap (mega-wave W6 step9, row65)
 *
 * B06020 佐々木小次郎 a2 / B06042 ここで会うたが百年目 (付与宣言能力):
 * 「相手の現場にいるキャラを1枚まで選び、このキャラとのコンタクトを発生させる。
 *  （このキャラがアクションした側のキャラになる）」
 *
 * 通常アクションとの差分 (すべて公式Q&A B06020/B06042/B07017 pin):
 *   - declare を通らない: canActionAgainstChar は呼ばない (スリープ/スタン限定 gate を迂回 —
 *     「アクティブ状態のキャラともコンタクトを発生させられます」)
 *   - sleepActor しない (「キャラはスリープ状態になりません」)
 *   - action:declare / action:guard-window / action:guarded / action:unguarded を emit しない
 *     (「ガードすることはできません」= ガード窓自体が存在しない)
 *   - actedCharThisTurn を立てない (「アクションによって発動する能力は発動しない」— P17 は
 *     『アクションした』の代理フラグ)
 *   - generatedByEffect=true → advance() の contact-end 分岐が action:end を emit しない
 * contact-pending 以降 (contact:start emit / buildContactBindings / computeOrder / cutin / 変装 /
 * AP 判定) は既存 advance を無改造で再利用 (「【カットイン】や【変装】も使用できます」)。
 *
 * @returns 生成した ax。contact:start 効果なしなら action-1、効果解決待ちは
 * contact-order-pending。actor/target 不在は null (rules/15 0枚選択と同 posture)
 */
export function startFromEffect(state: GameState, byUid: string, targetUid: string): ActionContext | null {
  const byPlayer = findActorPlayer(state, byUid);
  if (!byPlayer) return null;
  // 対象は相手の現場のキャラ (両 exemplar とも「相手の現場にいるキャラ」印字。fail-closed)
  const targetSide: Player = byPlayer === 'self' ? 'opp' : 'self';
  if (!state.players[targetSide].scene.some((c) => c.uid === targetUid)) return null;

  const id = nextId(state);
  const ax: ActionContext = {
    id,
    byUid,
    byPlayer,
    target: { kind: 'char', uid: targetUid },
    phase: 'contact-pending',
    startedAt: { turn: state.turn.number, nano: Date.now() },
    cutInUsed: {},
    generatedByEffect: true,
  };
  contexts(state)[id] = ax;
  startActionCausalTrace(state, ax, ['contact']);
  ax.contactCausalEventId = ax.causalTrace?.rootEventId;
  // contact-pending → action-1 (contact:start emit + order 計算は既存分岐を再利用)
  advance(state, ax);
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
  ax = contextForState(state, ax);
  if (abortIfMissing(state, ax)) return;
  // Task D E4: アクション対象キャラ自身はガード不可 (B09028/B09054 Q&A、sleepGuard 重複領域)
  const guardExclude = ax.target.kind === 'char' ? ax.target.uid : undefined;
  if (!canGuard(state, ax.byUid, guardUid, guardExclude)) {
    throw new Error(`flow.action.tryGuard: invalid guard ${guardUid} for action by ${ax.byUid}`);
  }
  // W2b (2026-07-03, r28): mustGuard 義務 (B09040 a2)。義務 char が存在する場合、ガードは
  // **義務 char 自身** で行わねばならない (公式Q&A「このキャラがガードできる場合は必ずガード」/
  // 義務複数は「その中から持ち主が1枚選択」)。通常 char での代替ガードは throw (fail-safe、
  // mustBeTargeted declare と同型)。義務 0 件は従来挙動 byte 等価。
  const mustListT = mustGuardCandidates(state, ax.byUid, guardExclude);
  if (mustListT.length > 0 && !mustListT.some(c => c.uid === guardUid)) {
    const uids = mustListT.map(c => c.uid).join(', ');
    throw new Error(
      `flow.action.tryGuard: must guard with one of [${uids}] (mustGuard enforced)`,
    );
  }

  ax.guardUid = guardUid;
  ax.guarded = { guardUid };
  const guardPlayer = otherPlayer(ax.byPlayer);
  const guardDecisionEventId = recordActionCausalOperation(state, ax, {
    actor: guardPlayer,
    kind: 'select',
    source: { kind: 'player', side: guardPlayer },
    targets: [publicUidLocator(state, guardUid, guardPlayer)],
    outcome: { type: 'state', state: 'success' },
  });
  // guardUid スリープ化
  mutate.scene.setState(state, guardUid, 'sleep');
  recordActionCausalOperation(state, ax, {
    actor: guardPlayer,
    kind: 'sleep',
    source: { kind: 'player', side: guardPlayer },
    targets: [publicUidLocator(state, guardUid, guardPlayer)],
    outcome: { type: 'state', state: 'sleep' },
  });

  // engine additive A2 (2026-07-11, B04073 千葉和伸): action:guarded payload に targetUid を同梱。
  // 「アクションで指定されていたのが〚カード名［三池苗子］〛だった場合」= ガード成立後に元の
  // アクション**宣言時**対象 (ax.target、rules/22 宣言時 snapshot 固定) を読む手段。passGuard
  // (action:unguarded) は既に target 同梱済 (line ~327) — 非対称を解消。char 以外 (事件対象) は
  // undefined。消費側 = triggerCharMatches{payloadKey:'targetUid'} (action:declare で実証済 exemplar)。
  event.emit(
    state,
    'action:guarded',
    { byUid: ax.byUid, guardUid, targetUid: ax.target.kind === 'char' ? ax.target.uid : undefined },
    { player: ax.byPlayer, uid: ax.byUid },
    { causalCorrelationEventId: guardDecisionEventId },
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
  ax = contextForState(state, ax);
  if (abortIfMissing(state, ax)) return;
  // W2b (2026-07-03, r28): mustGuard 義務 (B09040 a2)。ガード可能な義務 char が居る限り
  // pass 不可 (公式Q&A)。スリープ/ブレット/対象自身は candidates() 除外で義務から自動免除。
  // AI (action-resolution) / UI (useContactFlowDriver) は事前に義務 char へ誘導するため、
  // ここは fail-safe backstop (mustBeTargeted declare:159 と同型)。義務 0 件は byte 等価。
  const guardExcludeP = ax.target.kind === 'char' ? ax.target.uid : undefined;
  const mustListP = mustGuardCandidates(state, ax.byUid, guardExcludeP);
  if (mustListP.length > 0) {
    const uids = mustListP.map(c => c.uid).join(', ');
    throw new Error(
      `flow.action.passGuard: must guard with one of [${uids}] (mustGuard enforced)`,
    );
  }
  const guardPlayer = otherPlayer(ax.byPlayer);
  const guardDecisionEventId = recordActionCausalOperation(state, ax, {
    actor: guardPlayer,
    kind: 'select',
    source: { kind: 'player', side: guardPlayer },
    targets: [],
    outcome: { type: 'none' },
  });
  event.emit(
    state,
    'action:unguarded',
    { byUid: ax.byUid, target: ax.target },
    { player: ax.byPlayer, uid: ax.byUid },
    { causalCorrelationEventId: guardDecisionEventId },
  );

  if (ax.target.kind === 'char') {
    ax.phase = 'leave-resolution';
  } else {
    // actionCase は judge フェーズで証拠操作する設計
    ax.phase = 'judge';
  }
}



/**
 * snapshotAP — AP スナップショット
 *
 * - 攻撃側 (byUid) と 対象 (target char or guard char) の AP を取得
 * - ax.apSnapshot に保存
 * - contact:before-judge emit (spec: { aUid, bUid, aAP, bAP })
 */
export function snapshotAP(state: GameState, ax: ActionContext): void {
  ax = contextForState(state, ax);
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

  const aAP = readEffectiveAp(state, aUid);
  const bAP = readEffectiveAp(state, bUid);

  ax.apSnapshot = { aUid, aAP, bUid, bAP };

  // Task D E4 (2026-06-12): contactImmune の正規配線。judge (contact.ts) は従来から
  // ax.contactImmune を読むが writer がゼロだった。防御側 (bUid) の turnEffects /
  // 'text:' keyword を snapshot する。rules/22: AP 判定リムーブのみに適用 (カットイン等の
  // 直接リムーブは貫通)。case target fallback (bUid===aUid) では攻撃者の flag を読まない。
  if (bUid !== aUid) {
    ax.contactImmune = readChar.hasTextAbility(state, bUid, 'contactImmune');
  }

  event.emit(
    state,
    'contact:before-judge',
    { aUid, bUid, aAP, bAP },
    { player: ax.byPlayer, uid: ax.byUid },
    { causalCorrelationEventId: actionCorrelationEventId(ax) },
  );
}

/**
 * abortIfMissing — byUid or target char がいなければ即座に action-end
 *
 * rules/07: ガードまでに攻撃キャラ or 対象が現場を離れた場合、アクションはその時点で終了
 */
export function isMissingBeforeGuard(state: GameState, ax: ActionContext): boolean {
  ax = contextForState(state, ax);
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

  return byMissing || targetMissing;
}

/**
 * Terminal paths must invalidate action work before the terminal causal event.
 * That keeps replay frames from carrying a continuation past their final node.
 */
export function abortForTerminal(
  state: GameState,
  winner: Player,
  reason: 'concede',
): void {
  if (state.gameResult !== undefined) return;
  mutate.gameResult.set(state, winner, reason);
}

export function abortIfMissing(state: GameState, ax: ActionContext): boolean {
  ax = contextForState(state, ax);
  if (isMissingBeforeGuard(state, ax)) {
    ax.phase = 'action-end';
    const cancelEventId = completeActionCausalOperation(
      state,
      ax,
      'cancel',
      { type: 'state', state: 'cancelled' },
    );
    // Task D E4 (2026-06-12): 中断経路でも '_action' scope の効果を清掃 (rules/08 §6-7)
    clearActionScopedState(state);
    if (!ax.generatedByEffect && state.gameResult === undefined) {
      event.emit(
        state,
        'action:end',
        { byUid: ax.byUid, result: 'aborted' },
        { player: ax.byPlayer, uid: ax.byUid },
        { causalCorrelationEventId: cancelEventId },
      );
    }
    // メモリ管理: 中断時も Context を削除
    _deleteContext(state, ax.id);
    return true;
  }
  return false;
}

/**
 * advance — フェーズ遷移
 *
 * 各フェーズで適切な Hook を emit しつつ次フェーズへ。
 */
export function advance(state: GameState, ax: ActionContext): void {
  ax = contextForState(state, ax);
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
    // ガード不成立の case だけはコンタクトせず、証拠判定へ進む。
    if (ax.target.kind === 'case' && !ax.guardUid) {
      ax.phase = 'judge';
      return;
    }
    // char target またはガード成立 case: コンタクト開始
    const aUid = ax.byUid;
    const bUid = ax.guardUid ?? (ax.target as { kind: 'char'; uid: string }).uid;

    // User request: コンタクト詳細を log に出力 (「レベルXキャラ名(ID):APXXXX VS 〜」)
    if (ax.causalTrace === undefined) {
      const contactDetail = formatContactDetail(state, aUid, bUid);
      mutate.log.append(state, {
        ts: Date.now(),
        player: ax.byPlayer,
        turn: state.turn.number,
        action: 'contact:detail',
        result: contactDetail,
      });
    }

    ax.contactCausalEventId ??= recordActionCausalOperation(state, ax, {
      actor: ax.byPlayer,
      kind: 'declare',
      tags: ['contact'],
      source: publicUidLocator(state, aUid, ax.byPlayer),
      targets: [publicUidLocator(state, bUid, otherPlayer(ax.byPlayer))],
      outcome: { type: 'state', state: 'active' },
    });

    // engine additive wave-18 (2026-07-03): source に contact bindings (byUid=aUid/targetUid=bUid の客観 contact)。
    // キャンティ (B04092)「自分の他キャラがコンタクトしたとき…コンタクト中のキャラを選び AP+」の observer effect が
    // inContact pick で $contact 参加者を解決するため。matcher は payloadKey aUid/bUid (triggerCharMatches) で
    // 別途判定。既存 contact:start consumer (B02079/D07018 等 payloadKey 系) は bindings を読まない → 挙動不変。
    event.emit(state, 'contact:start', { aUid, bUid }, {
      player: ax.byPlayer, uid: ax.byUid, bindings: buildContactBindings(ax, ax.byPlayer),
    }, {
      causalCorrelationEventId: ax.contactCausalEventId,
    });

    // 「コンタクトしたとき」効果をすべて解決してから、その結果の AP で行動順を決める。
    // 効果が人間の選択で止まる場合も GameState 上の phase から resolver が再開する。
    ax.phase = 'contact-order-pending';
    continuePendingContactOrder(state);
    return;
  }

  if (phase === 'action-1') {
    ax.phase = 'action-2';
    return;
  }

  if (phase === 'action-2') {
    // redo 判定: 1番目 pass (firstActed=false) かつ 2番目 acted (secondActed=true)
    // action-1-redo: undefined の firstActed は「未行動」を意味する — 明示的 false のみが「パス」
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
    event.emit(state, 'contact:end', {}, { player: ax.byPlayer, uid: ax.byUid }, {
      causalCorrelationEventId: actionCorrelationEventId(ax),
    });
    return;
  }

  if (phase === 'contact-end') {
    if (ax.pendingHiramekiEvidenceRemoval?.decisionResolved === false) return;
    // An optional Hirameki keeps the removed evidence card owned by this
    // ActionContext until its effect (including nested public decisions) has
    // finished. Commit that exact card before the normal case evidence gain.
    withStructuredCausalResolution(
      state,
      () => finalizePendingHiramekiEvidenceRemoval(state, ax),
      ax.causalTrace,
    );
    if (ax.deferredCaseEvidenceGain) {
      withStructuredCausalResolution(state, () => gainSelfEvidence(state, ax), ax.causalTrace);
      delete ax.deferredCaseEvidenceGain;
    }
    ax.phase = 'action-end';
    if (ax.causalTrace !== undefined && ax.causalTrace.completed !== true) {
      completeActionCausalOperation(state, ax, 'summary', { type: 'state', state: 'success' });
    }
    // Task D E4 (2026-06-12): rules/08 §6-7 — アクション終了時に「アクション終了時まで」の
    // 効果 ('_action' suffix turnEffects、例: B09041 contactImmune_action) が切れる。
    // BUG-143: rules/08 §6 — コンタクト終了時にカットイン由来の修正 (apMod_contact 等、'contact' scope)
    // も切れる。判定 (judge) と contact:end emit は既に済んでいるためこの時点で清掃して安全。
    // 両プレイヤーの scene を清掃 (同ターン 2 回目のアクション/コンタクトへの stale 持ち越し防止)。
    clearActionScopedState(state);
    clearContactScopedState(state);
    // mega-wave W6 step9 (row65): 効果生成コンタクト (startFromEffect) は「アクションではない」—
    // action:end を emit しない (公式Q&A「アクションによって発動する能力や『アクション終了時』の
    // 能力は発動しません」を実現する唯一の分岐点)。turnEffects clear (上) と _deleteContext (下) は
    // 無条件維持 — effect-contact 経路では 'action' scope turnEffect が立たないので clear は no-op で安全。
    if (!ax.generatedByEffect && state.gameResult === undefined) {
      event.emit(
        state,
        'action:end',
        { byUid: ax.byUid, result: 'completed' },
        { player: ax.byPlayer, uid: ax.byUid },
        { causalCorrelationEventId: actionCorrelationEventId(ax) },
      );
    }
    // メモリ管理: action-end に到達した Context は不要なので削除 (長いゲーム対策)
    _deleteContext(state, ax.id);
    return;
  }

  // action-end は終端
}

// flow.action namespace
export const action = {
  declare,
  startFromEffect, // W6 step9 (row65): 効果生成コンタクト bootstrap
  tryGuard,
  passGuard,
  advance,
  abortIfMissing,
  abortForTerminal,
  isMissingBeforeGuard,
  snapshotAP,
  computeOrder,
  candidates: targetCandidates,
  mustTargetCandidates,
  registerTargetExpander,
  _resetActionContexts,
  _resetTargetExpanders,
  _getContext,
  _hasOpenActionContext,
  _deleteContext,
};

// ActionPhase 型の re-export 用 (consumer 側で `type` import するため)
export type { ActionPhase };
