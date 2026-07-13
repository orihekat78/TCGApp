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

import type { GameState, ActionContext, JudgeResult, AbilityDef, EffectCtx, SceneCharacter } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js';
import { toPlainDeep } from '../effect/pending-state.js';
import { effectiveCutinAbilities } from '../read/hand-cutin.js';
import { evalCond } from '../cond/eval.js';
import { matchOneFilter } from '../target/candidates.js'; // engine A3 wave (2026-07-11): B05007 filtered action-scoped cutin ban
import { computeOrder as _computeOrder } from './action/order.js';

type Player = 'self' | 'opp';

/**
 * cutIn 持ちか
 *
 * 2026-05-27 Option C: type:'icon-cutin' は廃止、type:'triggered' + scope:'on-hand'
 * + trigger:{hook:'effect:declared', optional:true} のパターンを「カットイン」と判定。
 * optional:true は「プレイヤー選択 (cutin/disguise/pass) 経由で発動」マーカー。
 */
function isCutInCard(state: GameState, player: Player, cardId: string): boolean {
  return effectiveCutinAbilities(state, player, cardId).length > 0;
}

/**
 * 変装 ability (type:'icon-disguise') を返す。無ければ undefined。
 * 変装の可否ゲート条件 (【事件白】【FILE6】等, rules/09 §変装) はこの ability の
 * `condition` フィールドに格納し、canDisguise が評価する。
 */
function disguiseAbility(cardId: string): AbilityDef | undefined {
  const def = readDef.card(cardId);
  if (!def) return undefined;
  return (def.abilities as AbilityDef[]).find(a => a?.type === 'icon-disguise');
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
 * engine additive wave-18 (2026-07-03): contact bindings を組む共通 helper。
 *
 * source.bindings.contact に載せると triggered listener が entry.bindings → entryToCtx →
 * ctx.contact と渡し、observer effect の inContact pick / `$contact.*` 解決を可能にする
 * (cutin:used が先例、BUG-104)。p 視点で byUid=自コンタクトキャラ / targetUid=相手コンタクトキャラ。
 * contact:start では p=ax.byPlayer で呼ぶと byUid=攻撃側 aUid / targetUid=防御側 bUid の客観 contact になる。
 */
export function buildContactBindings(ax: ActionContext, p: Player): Record<string, unknown[]> {
  return {
    contact: [{
      byUid: contactCharUidOf(ax, p) ?? ax.byUid,
      byPlayer: p,
      targetUid: contactCharUidOf(ax, p === 'self' ? 'opp' : 'self'),
      guardUid: ax.guardUid,
      attackerSide: ax.byPlayer,
    }],
  };
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
  if (!isCutInCard(state, p, cardId)) return false;
  if (ax.cutInUsed?.[p]) return false;
  // engine拡張 wave#2 cluster5 (2026-06-14): cut-in する p の相手が「相手は【カットイン】を使用できない」
  // aura を現場に展開している場合は不可 (B02063/B04034/B09017、rules/09 §カットイン)。
  // other = aura 所有者側 = cut-in する p の相手。不在時 false → 既存挙動不変 (smoke baseline 不変)。
  const other: Player = p === 'self' ? 'opp' : 'self';
  if (readChar.restrictsOpponent(state, other, 'cutin')) return false;
  // engine additive wave (2026-06-29d): action-scoped cutin ban (D02008/B05007「このキャラがアクション
  // したとき、アクション終了時まで相手は【カットイン】を使用できない」)。継続 aura (restrictsOpponent) ではなく
  // actor に立つ _action turnEffect フラグ。write は既存 charSetTurnEffect(uid:'$self', key:'cutinBanOpp_action',
  // val:true)、清掃は clearTurnEffects('action') (アクション終了時) + turn-end safety net。p のカットインは、
  // 相手側 (other = action 宣言側) のいずれかのキャラが本フラグを持つとき不可。既存カードは本キー未使用 → 回帰0。
  if (sideHasActionCutinBan(state, other)) return false;
  // engine additive wave-10 (2026-07-02): turn-scoped cutin ban (B07002 a2「このターン中、相手は
  // 【カットイン】と【変装】を使用できない」)。setCutinBan verb が turnState[p].cutinBanned を書込、
  // resetTurnFlags (turn:start) が清掃。side-level flag ゆえ発動キャラ離場後も有効 (公式 Q&A B07002)。
  // 既存カードは本 flag 未使用 → 回帰0。
  if (state.turnState[p].cutinBanned) return false;
  // engine A3 wave (2026-07-11, B05007 妃英理): filtered action-scoped cutin ban。現行アクションの actor
  //   (ax.byUid、owner ax.byPlayer) が armer の actionCutinBanOppFilter に一致し、p が armer の相手なら不可。
  //   「自分の[毛利探偵事務所]がアクションしたとき、アクション終了時まで相手は【カットイン】使用できない」=
  //   一致キャラのアクション中のみ封じる (canCutIn がアクション中のみ呼ばれる → 自然に action スコープ)。
  //   将来登場キャラも filter 一致なら適用 (per-char flag でなく filter live 照合)。partner actor は scene 不在 → 非該当。
  {
    const armerSide = ax.byPlayer;
    const acbFilter = state.turnState[armerSide].actionCutinBanOppFilter;
    if (acbFilter && p !== armerSide) {
      const actor = state.players[armerSide].scene.find(c => c.uid === ax.byUid);
      if (actor && matchOneFilter(state, actor.cardId, acbFilter, actor,
        { kind: 'char', uid: actor.uid, cardId: actor.cardId, player: armerSide })) {
        return false;
      }
    }
  }
  // engine mega-wave W2 (2026-07-03, P07/r24): selfCutinBanInContact — p 側のコンタクト参加キャラ自身が
  // 「このキャラのコンタクト中、自分は【カットイン】を使用できない」継続 aura を持つ場合、p は cutin 不可
  // (B07005)。参加キャラは contactCharUidOf(ax, p)。不在時 false = 挙動不変。
  const pContactUid = contactCharUidOf(ax, p);
  if (pContactUid && readChar.selfContinuousFlag(state, pContactUid, 'selfCutinBanInContact')) return false;
  return true;
}

/** other 側の現場に cutinBanOpp_action フラグ (action-scoped、相手のカットイン禁止) を持つキャラが居るか。 */
function sideHasActionCutinBan(state: GameState, side: Player): boolean {
  return state.players[side].scene.some(c => c.turnEffects['cutinBanOpp_action'] === true);
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
export function cutIn(state: GameState, ax: ActionContext, p: Player, cardId: string, cutinAbilityId?: string): void {
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
  // BUG-104: p 視点の contact bindings (攻撃側/防御側 cutin で $contact.byUid が正しく解決)。
  const contactBindings = buildContactBindings(ax, p);
  const cutinAbilities = effectiveCutinAbilities(state, p, cardId);
  const selected = cutinAbilityId
    ? cutinAbilities.find(a => a.id === cutinAbilityId)
    : cutinAbilities[0];
  if (!selected) throw new Error(`flow.contact.cutIn: cutin ability not found cardId=${cardId}`);
  event.emit(state, 'effect:declared', { cardId, abilityId: 'cutin', cutinAbilityId: selected.id }, {
    player: p, cardId, bindings: contactBindings,
  });
  // engine additive wave-3 (2026-06-30): カットイン使用を第三者キャラが観測する専用 hook (rules/09)。
  // effect:declared(自効果ゲート) とは別 hook = 自効果と第三者観測を分離。payload.player で側、payload.cardId で
  // 使用カットインの名/特徴 (triggerCutinMatches) を判定。source.bindings に contact を渡し observer effect の
  // $contact.byUid 解決を可能にする (B02080「そのキャラを AP+1000」)。新 hook = 既存カード未宣言 → 挙動不変。
  event.emit(state, 'cutin:used', { player: p, cardId }, {
    player: p, cardId, bindings: contactBindings,
  });
  mutate.hand.discardToRemove(state, p, [cardId], { byPlayer: p }); // W3 (r17): 自己起因を明示
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
 * - 変装 ability の condition (【事件白】【FILE6】等, rules/09 §変装) を満たす
 *   ⚠ 条件未達なら「そもそも変装を持っていない扱い」(rules/17 §条件アイコン Point) → 変装不可
 */
export function canDisguise(state: GameState, ax: ActionContext, p: Player, cardId: string): boolean {
  if (!state.players[p].hand.includes(cardId)) return false;
  // engine additive wave-10 (2026-07-02): turn-scoped disguise ban (B07002 a2)。canCutIn の
  // cutinBanned gate と mirror (setDisguiseBan verb 書込 / resetTurnFlags 清掃 / side-level)。
  if (state.turnState[p].disguiseBanned) return false;
  const ability = disguiseAbility(cardId);
  if (!ability) return false;
  const targetUid = contactCharUidOf(ax, p);
  if (!targetUid) return false;
  // 対象キャラが存在するか
  if (!state.players[p].scene.some(c => c.uid === targetUid)) return false;
  // 変装ゲート条件 (【事件(色)】/【FILE(X)】等)。owner=p で evalCond。
  // 条件未達は rules/17 §条件アイコン Point に従い「変装を持っていない」=変装不可。
  if (ability.condition) {
    const ctx: EffectCtx = {
      source: { cardId, uid: targetUid, abilityId: ability.id, player: p, area: 'hand' },
      bindings: {},
    };
    if (!evalCond(state, ability.condition, ctx)) return false;
  }
  return true;
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
  // engine mega-wave W3 (2026-07-03, r51): 入替え元キャラの snapshot (disguiseInto は同一オブジェクトの
  // cardId を書換えるため shallow copy で凍結)。uid は sentinel 化 — targetUid slot はこの後も同 uid の
  // まま新カードが residence するため、素の uid だと disguiseReplacedMatches の filter 評価
  // (matchOneFilter → continuousDeltaSafe 等が scene.byUid) が「新カード自身の継続効果」を誤参照する。
  // sentinel は scene に実在しない → continuous/aura 軸 0 (removedCharMatches と同じ既知 limitation、
  // turnEffects/override 軸は snapshot が保持し正確)。
  // toPlainDeep (BUG-132 posture): shallow copy だと nested field (setCards/turnEffects/keywordOverrides)
  // が Immer draft proxy のまま emit payload に残り、produce finalize 後に revoked-proxy crash する。
  const replacedChar: SceneCharacter = toPlainDeep({ ...targetChar, uid: `${targetUid}::disguise-replaced` });

  // 元 cardId を デッキ下へ (refactor 1a 2026-06-12: mutate 層経由に統一。挙動は push と同一)
  mutate.deck.toBottom(state, p, [fromCardId]);
  // uid 維持で cardId 入替
  mutate.char.disguiseInto(state, targetUid, cardId);
  // 手札から disguise カードを削除
  mutate.hand.remove(state, p, [cardId]);

  // disguise:into emit (spec: { uid, fromCardId, newCardId })
  // engine拡張 wave#2 cluster5 (2026-06-14): 変装する p の相手 (= other) が「相手のキャラの【変装時】は
  // 発動しない」aura (B04034) を展開している場合、disguise:into を emit せず【変装時】trigger を抑止する
  // (rules/23 §変装時 / 公式 qAndA「変装自体は可能だが変装時能力は不発動」)。変装 swap (deck.toBottom/
  // disguiseInto/hand.remove) は emit より前に完了済 → 変装は成立し、変装時 ability のみ silenced。
  // other = aura 所有者側 = 変装する p の相手 (自分が aura を持つ自分変装は other 側に無い → 変装時 発動)。
  // 不在時は通常 emit (no-op、既存挙動不変)。
  const disguiseOther: Player = p === 'self' ? 'opp' : 'self';
  if (!readChar.restrictsOpponent(state, disguiseOther, 'disguiseTrigger')) {
    // engine additive wave-18 (2026-07-03): payload に player、source に contact bindings を付与。
    // 白鳥任三郎 (B04075/PR029) の「相手が【変装】を使用したとき」= matcherCondition triggerPlayerIs で
    // side 判定するため payload.player 必須 (cutin:used は既に持つ)。source.bindings.contact は observer
    // effect の inContact pick ($contact 参加者) 解決用。既存 disguise:into consumer (selfOnly の【変装時】系
    // B02038/B02044 等) は player/bindings を読まない → 挙動不変 (baseline smoke 不変)。
    // W3 (r51): payload に replacedChar (入替え元 snapshot) を追加。既存 consumer は未読 → 挙動不変。
    event.emit(
      state,
      'disguise:into',
      { uid: targetUid, fromCardId, newCardId: cardId, player: p, replacedChar },
      { player: p, uid: targetUid, bindings: buildContactBindings(ax, p) },
    );
  }
  // rules/23: 元キャラのデッキ下移動は「リムーブ扱いではない」→ leave:to-deck Hook を発火 (抑止対象外、常に発火)
  event.emit(state, 'leave:to-deck', { cardId: fromCardId }, { player: p });
  // engine mega-wave W3 (2026-07-03, r10): 被置換側 (退場した元キャラ) の自己反応 hook (B03052
  // 「〚カード名［ベルモット］〛が【変装】によってこのキャラと入れ替わったとき」)。無条件 emit —
  // B04034 の disguiseTrigger aura は【変装時】アイコン (disguise:into) のみを抑止し、被置換側の
  // 無アイコン反応には及ばない (B04034 印字「相手のキャラの【変装時】は発動しない」)。
  // source.cardId = fromCardId (退場カード) — listener は virtual location で当該 def を走査する
  // (退場カードは既にデッキ下 = in-play scan 不可、handleLeaveToRemoveSelf と同構造)。
  event.emit(
    state,
    'disguise:replaced',
    { uid: targetUid, fromCardId, newCardId: cardId, player: p },
    { player: p, uid: targetUid, cardId: fromCardId },
  );

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
    // cluster15 (2026-06-16): aUid (= winner = attacker) を removal-observer 用 byUid として渡す。
    // rules/08: contact 被除去は常に bUid、除去者は aUid。
    // W6 step10 (row9): leave:intercept (B01092/B01039) が成立した場合 prevented=true —
    // defender は現場を離れていない (kept-in-scene) or 手札へ redirect。contact:judge の
    // winner/loser 導出は defenderRemoved を見るため、ここで反転を反映する。
    const rr = mutate.scene.removeToRemove(state, bUid, 'contact-ap', aUid);
    defenderRemoved = !rr.prevented;
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


export const contact = {
  canCutIn,
  cutIn,
  canDisguise,
  disguise,
  pass,
  judge,
  computeOrder,
};
