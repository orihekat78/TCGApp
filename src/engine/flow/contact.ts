// engine.flow.contact — コンタクト中の行動 / AP判定 (Phase 4 Group B Task 4.5)
// spec: .claude/specs/engine-api-flow-contact.md
// rules: 08-contact.md, 09-cutin-disguise.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
//
// 提供 API:
//   - canCutIn / cutIn         (1コンタクト1枚, 色制限なし)
//   - canDisguise / disguise   (元キャラをデッキ下、新カードへ入替)
//   - pass                     (no-op + log)
//   - judge                    (AP判定。同値もリムーブ。攻撃側はリムーブされない)
//   - computeOrder             (低AP先、同値→防御側先)

import type { GameState, ActionContext, JudgeResult, CardDef } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js';
import { computeOrder as _computeOrder } from './action/order.js';

type Player = 'self' | 'opp';

/**
 * CardDef.abilities から指定 type を持つ ability があるか判定
 * (Phase 5 で AbilityDef 型が定まる予定。現状 unknown[] のため narrow して判定)
 */
function hasAbilityType(def: CardDef | undefined, type: string): boolean {
  if (!def) return false;
  return def.abilities.some(a => {
    if (a && typeof a === 'object') {
      const rec = a as Record<string, unknown>;
      return rec.type === type;
    }
    return false;
  });
}

/**
 * cutIn 持ちか
 *
 * 2026-05-27 Option C: type:'icon-cutin' は廃止、type:'triggered' + scope:'on-hand'
 * + trigger:{hook:'effect:declared', optional:true} のパターンを「カットイン」と判定。
 * optional:true は「プレイヤー選択 (cutin/disguise/pass) 経由で発動」マーカー。
 */
function isCutInCard(cardId: string): boolean {
  const def = readDef.card(cardId);
  if (!def) return false;
  return def.abilities.some((a: unknown) => {
    const ab = a as { type?: string; scope?: string; trigger?: { hook?: string; optional?: boolean } };
    return (
      ab.type === 'triggered' &&
      ab.scope === 'on-hand' &&
      ab.trigger?.hook === 'effect:declared' &&
      ab.trigger?.optional === true
    );
  });
}

/**
 * 変装 持ちか
 */
function isDisguiseCard(cardId: string): boolean {
  return hasAbilityType(readDef.card(cardId), 'icon-disguise');
}

/**
 * ax からプレイヤー p のコンタクト中のキャラ uid を取得
 * - p === ax.byPlayer なら byUid
 * - else: guardUid (存在すれば) または target.uid
 */
function contactCharUidOf(ax: ActionContext, p: Player): string | undefined {
  if (p === ax.byPlayer) return ax.byUid;
  // 防御側
  if (ax.guardUid) return ax.guardUid;
  if (ax.target.kind === 'char') return ax.target.uid;
  return undefined;
}

/**
 * canCutIn — カットイン可否
 *
 * - cardId が p の手札にある
 * - CardDef に カットイン 持ち
 * - 1 コンタクト 1 枚 (ax.cutInUsed[p] !== true)
 * - 色制限なし (rules/09)
 */
export function canCutIn(state: GameState, ax: ActionContext, p: Player, cardId: string): boolean {
  if (!state.players[p].hand.includes(cardId)) return false;
  if (!isCutInCard(cardId)) return false;
  if (ax.cutInUsed?.[p]) return false;
  return true;
}

/**
 * cutIn — カットイン実行
 *
 * - validate
 * - 手札 → リムーブエリアへ
 * - ax.cutInUsed[p] = true
 * - effect:declared (Phase 5 で listener が pendingEffects に積む)
 *
 * @remarks
 * Phase 4 scope: cutInUsed フラグのセットと \effect:declared\ emit のみ行う。
 * カットイン効果 (AP+ 等) はここではキューに積まれない。
 * Caller は \effect:declared\ に Phase 5 listener を登録し、
 * その中で cutin Effect を pendingEffects に push した後、
 * engine.resolve.runAllUntilEmpty() を駆動すること。
 */
export function cutIn(state: GameState, ax: ActionContext, p: Player, cardId: string): void {
  if (!canCutIn(state, ax, p, cardId)) {
    throw new Error(`flow.contact.cutIn: cannot cut in cardId=${cardId} for ${p}`);
  }
  // 2026-05-27 Option C: emit を discardToRemove より前に実行。triggered listener が
  // scope:'on-hand' で card を hand 上で見つけて effect を queue する必要があるため
  // (旧 icon-cutin 専用 listener では handler 内で別経路だった、新 path では順序が重要)。
  // emit は同期的に listener を呼び pendingEffects に push。push 後の discardToRemove で
  // card が remove に移っても、queue 済 effect は ctx を保持しているので動作不変。
  //
  // 2026-05-27 (Option C follow-up): source.bindings.contact に当該 ax 情報を詰めて emit。
  // triggered listener が event.queue に伝達し、entry.bindings → entryToCtx → ctx.bindings
  // と渡り、atom-handler の resolveBindRef が `$contact.byUid` を解決できる。
  const contactBindings: Record<string, unknown[]> = {
    contact: [{
      byUid: ax.byUid,
      byPlayer: ax.byPlayer,
      targetUid: ax.target.kind === 'char' ? ax.target.uid : undefined,
      guardUid: ax.guardUid,
    }],
  };
  event.emit(state, 'effect:declared', { cardId, abilityId: 'cutin' }, {
    player: p, cardId, bindings: contactBindings,
  });
  mutate.hand.discardToRemove(state, p, [cardId]);
  if (!ax.cutInUsed) ax.cutInUsed = {};
  ax.cutInUsed[p] = true;

  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'contact-cutin',
    target: cardId,
  });
}

/**
 * canDisguise — 変装可否
 *
 * - cardId が p の手札にある
 * - CardDef に 変装 持ち
 * - p 側のコンタクト中キャラが存在
 */
export function canDisguise(state: GameState, ax: ActionContext, p: Player, cardId: string): boolean {
  if (!state.players[p].hand.includes(cardId)) return false;
  if (!isDisguiseCard(cardId)) return false;
  const targetUid = contactCharUidOf(ax, p);
  if (!targetUid) return false;
  // 対象キャラが存在するか
  return state.players[p].scene.some(c => c.uid === targetUid);
}

/**
 * disguise — 変装実行
 *
 * - validate
 * - 元 cardId をデッキ下へ (toDeckBottom 内部処理: scene から取り出し → deck.push)
 *   ⚠ rules/09: 元キャラはデッキの下へ、リムーブではない
 *   ⚠ rules/23: 元キャラの「現場リムーブ時」は発動しない
 *   実装: 元の cardId を退避 → char.disguiseInto で uid 維持・cardId 差替え →
 *       退避した cardId を デッキ下へ追加
 * - mutate.char.disguiseInto(uid, newCardId)
 * - 手札から disguise cardId を削除
 * - disguise:into emit (spec: { uid, fromCardId, newCardId })
 */
export function disguise(state: GameState, ax: ActionContext, p: Player, cardId: string): void {
  if (!canDisguise(state, ax, p, cardId)) {
    throw new Error(`flow.contact.disguise: cannot disguise cardId=${cardId} for ${p}`);
  }
  const targetUid = contactCharUidOf(ax, p)!;
  const targetChar = state.players[p].scene.find(c => c.uid === targetUid);
  if (!targetChar) {
    throw new Error(`flow.contact.disguise: target char not found uid=${targetUid}`);
  }
  const fromCardId = targetChar.cardId;

  // 元 cardId を デッキ下へ
  state.players[p].deck.push(fromCardId);
  // uid 維持で cardId 入替
  mutate.char.disguiseInto(state, targetUid, cardId);
  // 手札から disguise カードを削除
  mutate.hand.remove(state, p, [cardId]);

  // disguise:into emit (spec: { uid, fromCardId, newCardId })
  event.emit(
    state,
    'disguise:into',
    { uid: targetUid, fromCardId, newCardId: cardId },
    { player: p, uid: targetUid },
  );
  // rules/23: 元キャラのデッキ下移動は「リムーブ扱いではない」→ leave:to-deck Hook を発火
  event.emit(state, 'leave:to-deck', { cardId: fromCardId }, { player: p });

  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'contact-disguise',
    target: targetUid,
    result: `${fromCardId} → ${cardId}`,
  });
}

/**
 * pass — コンタクト行動でパス
 *
 * 副作用なし。ログのみ。caller が firstActed/secondActed を false に維持する。
 */
export function pass(state: GameState, _ax: ActionContext, p: Player): void {
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'contact-pass',
  });
}

/**
 * judge — AP 判定 (rules/08)
 *
 * - ax.apSnapshot を参照 (caller が snapshotAP 済み前提)
 * - attackerAP >= defenderAP AND defender NOT contactImmune → defender リムーブ
 * - attacker は決してリムーブされない
 * - contact:judge emit (spec: { winner, loser })
 */
export function judge(state: GameState, ax: ActionContext): JudgeResult {
  if (!ax.apSnapshot) {
    throw new Error('flow.contact.judge: apSnapshot is missing — call snapshotAP first');
  }
  const { aUid, aAP, bUid, bAP } = ax.apSnapshot;

  // User request 2026-05-25: judge 時点の最終 AP (能力 / カットイン適用後) を log に出すため、
  // removeToRemove する前に card 情報を捕捉。
  const aSide = formatJudgeSide(state, aUid, aAP);
  const bSide = formatJudgeSide(state, bUid, bAP);

  let defenderRemoved = false;
  if (aAP >= bAP && !ax.contactImmune) {
    mutate.scene.removeToRemove(state, bUid, 'contact-ap');
    defenderRemoved = true;
  }

  const result: JudgeResult = {
    attackerAP: aAP,
    defenderAP: bAP,
    defenderRemoved,
    attackerRemoved: false,
  };

  // contact:judge emit
  const winner = defenderRemoved ? aUid : (aAP < bAP ? bUid : aUid /* tie 以上は攻撃側勝ち */);
  const loser = defenderRemoved ? bUid : (aAP < bAP ? aUid : bUid);
  event.emit(
    state,
    'contact:judge',
    { winner, loser },
    { player: ax.byPlayer, uid: ax.byUid },
  );

  // Phase 8.10e: judge 結果を state.log に記録 (UI の RecentActionToast / LogPanel が拾う)
  // 2026-05-25 拡張: 最終 AP 詳細 + 勝敗を含める。
  const verdict = defenderRemoved ? '✓ HIT (defender removed)' : '✗ MISS';
  mutate.log.append(state, {
    ts: Date.now(),
    player: ax.byPlayer,
    turn: state.turn.number,
    action: 'contact-judge',
    result: `${aSide} VS ${bSide} → ${verdict}`,
  });

  return result;
}

/**
 * 最終 AP 判定用の side format。state-machine.ts の formatContactSide と同形だが
 * (1) contact.ts が partner uid を受け取らない (snapshotAP 経由で uid を保持)、
 * (2) judge 時点の最終 AP を引数で受け取る、点が異なる。
 */
function formatJudgeSide(s: GameState, uid: string, finalAp: number): string {
  let cardId: string | undefined;
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p = uid === 'partner:self' ? 'self' : 'opp';
    cardId = s.players[p].partner?.cardId;
  } else {
    for (const p of ['self', 'opp'] as const) {
      const c = s.players[p].scene.find(c => c.uid === uid);
      if (c) { cardId = c.cardId; break; }
    }
  }
  if (!cardId) return `${uid}:AP${finalAp}`;
  const d = readDef.card(cardId);
  const name = d?.names?.[0] ?? cardId;
  const level = d?.level ?? '?';
  return `Lv${level} ${name}(${cardId}):AP${finalAp}`;
}

/**
 * computeOrder — コンタクト行動順 (rules/08)
 *
 * AP 低い側が 1 番目。同値の場合は **アクションされた側 (= 非ターンプレイヤー)** が 1 番目。
 * 実装は action/order.ts に集約し、ここでは caller 利便性のために re-export する。
 */
export function computeOrder(
  aAP: number,
  bAP: number,
  attackerSide: { aUid: string; bUid: string },
): { firstUid: string; secondUid: string } {
  return _computeOrder(aAP, bAP, attackerSide);
}

// readChar は将来用 (Phase 5)
void readChar;

export const contact = {
  canCutIn,
  cutIn,
  canDisguise,
  disguise,
  pass,
  judge,
  computeOrder,
};
