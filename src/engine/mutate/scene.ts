// engine.mutate.scene — 現場操作プリミティブ
// rules: 03-field-areas.md, 09-cutin-disguise.md, 16-card-set.md, 20-color-and-switch.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import { stackedCardCount, type AbilityDef, type GameState, type SceneCharacter, type RemoveResult } from '@/engine/types';
import { event } from '../event/index.js';
import { effectiveTriggeredAuraAbilities } from '../read/triggered-aura.js';
import { def } from '../read/def.js'; // MR partner-area (rules/18): isMR 判定 (def → types のみ依存、循環なし)
import { sceneCap } from '../read/scene-cap.js'; // engine E3 P11 (2026-07-02): 現場登場上限 (既定5、case override 可)
import { consultLeaveIntercept } from '../effect/consult-leave-intercept.js'; // W6 step10 (row9): pre-splice consult (純関数 leaf、循環なし)
import { char as charMutator } from './char.js';
import { log as logMutator } from './log.js';
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';

type Player = 'self' | 'opp';
type CharState = 'active' | 'sleep' | 'stun';
type RemoveCause = 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow';
type LeaveInterceptDecision = {
  interceptorUid: string;
  accept: boolean;
  /** Engine-owned resume marker: the B01092 cost already completed. */
  interceptorCostPaid?: boolean;
};
type DeferredSceneRemove = {
  uid: string;
  cause: RemoveCause;
  byUid?: string;
  byPlayer?: Player;
  leaveInterceptDecision?: LeaveInterceptDecision;
};
type RemoveOpts = {
  noMrRedirect?: boolean;
  byPlayer?: Player;
  triggeredAuraAbilities?: AbilityDef[];
  leaveInterceptDecision?: LeaveInterceptDecision;
  skipSetCardReplacementInstanceIds?: string[];
  afterSceneRemove?: DeferredSceneRemove;
};

function addToRemove(s: GameState, player: Player, ids: readonly string[]): void {
  if (ids.length === 0) return;
  s.players[player].remove.push(...ids);
  advanceIndexedZoneEpoch(s, player, 'remove');
}

function moveStackedCardsToRemove(s: GameState, player: Player, char: SceneCharacter): number {
  if (Array.isArray(char.stackedCards)) {
    addToRemove(s, player, char.stackedCards.map(entry => entry.cardId));
    return char.stackedCards.length;
  }
  addToRemove(s, player, Array.from({ length: char.stackedCards }, () => 'back-card'));
  return char.stackedCards;
}

function stackCardUnder(host: SceneCharacter, cardId: string, instanceId: string): void {
  const legacyCount = stackedCardCount(host.stackedCards);
  const legacyEntries = Array.isArray(host.stackedCards)
    ? host.stackedCards
    : Array.from({ length: legacyCount }, (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${host.uid}:${i}` }));
  host.stackedCards = [...legacyEntries, { cardId, instanceId }];
}

export interface EnterOpts {
  active?: boolean;   // false で sleep 状態で登場 (デフォルト: true)
  named?: boolean;    // 名乗り状態 (デフォルト: false)
  viaEffect?: boolean; // 効果による登場 (デフォルト: false)
}

/** 現場を問わず uid でキャラを探す */
function findChar(s: GameState, uid: string): { char: SceneCharacter; player: Player } | null {
  for (const p of ['self', 'opp'] as const) {
    const c = s.players[p].scene.find(c => c.uid === uid);
    if (c) return { char: c, player: p };
  }
  return null;
}

/**
 * MR能力① (rules/18:14-23, engine/mr-partner-area-core 2026-06-23): 相手ターン中に現場を離れる
 * MR キャラを partnerAreaMR slot へ移す。**owner ≠ turn.player のときのみ** (相手ターン中)。
 * 離脱方法不問 (リムーブ/移動/効果)。「代わりに」ではない → leave トリガは発火する設計のため、
 * 呼出元は scene splice + (該当する)各 area への push + emit を済ませた **後** に本判定を呼ぶ。
 *
 * 未解決 #1 (要公式Q&A) の暫定保守解: 【現場リムーブ時】hook を先に解決 (char は一旦 destination に
 * 在席) → その後 PA へ移す (rules/18 「離れた先のエリアへ一度置かれてから即座に」)。refresh 二重計上を
 * 防ぐため、呼出元は redirect=true のとき destination から当該 cardId を取り除く (removeToRemove は
 * push→emit→pop、他 verb は push 自体を skip)。
 */
function shouldRedirectMrToPA(s: GameState, char: SceneCharacter, owner: Player): boolean {
  return s.turn.player !== owner && def.isMR(char.cardId);
}

/**
 * char (scene から splice 済) を owner の partnerAreaMR slot に据える。
 * - rules/16: set/重ねカードは現場離脱時にリムーブ済 (呼出元が remove へ push 済) → slot char では空に。
 * - state(active/sleep/stun) は snapshot 引き継ぎ。名乗りは PA では無意味のため解除。
 * - uid を sentinel `partnerMR:<owner>` へ書換 (collectCardsInPlay / read.scene.byUid / findCardOnBoard 解決用)。
 *   MR能力②により MR は player 毎 ≤1 のため slot 衝突は構造的に発生しない (発生時は新キャラで上書き)。
 */
function placeMrInPA(s: GameState, char: SceneCharacter, owner: Player): void {
  char.setCards = [];
  char.stackedCards = 0;
  char.isNamed = false;
  char.uid = `partnerMR:${owner}`;
  s.players[owner].partnerAreaMR = char;
}

/**
 * Declared-cost-only move to the owner's PA MR slot.
 * This is not MR ability ①: it preserves the original uid and emits no scene-leave hook.
 */
function selfToPartnerArea(s: GameState, owner: Player, uid: string, cardId: string): boolean {
  if (s.players[owner].partnerAreaMR) return false;
  const index = s.players[owner].scene.findIndex(char => char.uid === uid);
  if (index < 0) return false;
  const char = s.players[owner].scene[index]!;
  if (char.cardId !== cardId || !def.isMR(char.cardId)) return false;
  charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
  addToRemove(s, owner, char.setCards.map(entry => entry.cardId));
  moveStackedCardsToRemove(s, owner, char);
  char.setCards = [];
  char.stackedCards = 0;
  char.isNamed = false;
  s.players[owner].scene.splice(index, 1);
  s.players[owner].partnerAreaMR = char;
  return true;
}

/**
 * MR能力② (rules/18:25-33, engine/mr-partner-area-core 2026-06-23): 自分の現場に MR が登場する場合、
 * 登場プレイヤー p の既存 MR (現場 or パートナーエリア) をリムーブする。同名不問。
 * - 現場 MR は removeToRemove(cause='effect', noMrRedirect) で除去 → 【現場リムーブ時】発火 +
 *   「能力によるリムーブ」(rules/18②) として remove へ (相手ターン中でも PA へ redirect しない)。
 * - PA 常駐 MR (partnerAreaMR slot) は slot→remove へ移す。現場離脱ではないため【現場リムーブ時】hook は
 *   発火しない (未解決 #2 暫定保守解)。
 * - enter() / switchEnter() 双方の冒頭で呼ぶ。MR②で既に除去済なら 2 度目は no-op (idempotent)。
 * - 非 MR 登場では何もしない (回帰0: MR rarity カードは現 0 枚)。
 * @returns 現場の MR を除去して **現場に空きを作ったか** (switchEnter の victim 除去判断用)。
 *   PA slot のみ除去 / 非 MR / 何も除去せず = false。
 */
function applyMrEntryRemoval(s: GameState, p: Player, enteringCardId: string): boolean {
  if (!def.isMR(enteringCardId)) return false;
  // 現場の既存 MR (MR②不変条件で ≤1 だが、防御的に全件)
  const mrUids = s.players[p].scene.filter(c => def.isMR(c.cardId)).map(c => c.uid);
  for (const uid of mrUids) {
    removeToRemove(s, uid, 'effect', undefined, { noMrRedirect: true });
  }
  // パートナーエリア常駐 MR
  const slot = s.players[p].partnerAreaMR;
  if (slot) {
    addToRemove(s, p, [slot.cardId]);
    s.players[p].partnerAreaMR = null;
  }
  return mrUids.length > 0; // 現場 MR を除去 = 現場に空きが生まれた
}

/** UID 生成カウンタ管理 (GameState に直接持たない — state 外のモジュールローカル) */
function maxPersistedUidSequence(value: unknown, seen = new WeakSet<object>()): number {
  if (typeof value === 'string') {
    const match = /#(\d+)$/.exec(value);
    return match ? Number(match[1]) : 0;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  let max = 0;
  for (const entry of Object.values(value)) {
    max = Math.max(max, maxPersistedUidSequence(entry, seen));
  }
  return max;
}

function generateUid(state: GameState, cardId: string): string {
  let seq = state.sceneUidSeq ?? maxPersistedUidSequence(state);
  for (const player of ['self', 'opp'] as const) {
    const characters = [
      ...state.players[player].scene,
      ...(state.players[player].partnerAreaMR ? [state.players[player].partnerAreaMR] : []),
    ];
    for (const character of characters) {
      const match = /#(\d+)$/.exec(character.uid);
      if (match) seq = Math.max(seq, Number(match[1]));
    }
  }
  state.sceneUidSeq = seq + 1;
  return `${cardId}#${state.sceneUidSeq}`;
}

/** UID カウンタのリセット (テスト用) */
export function _resetUidCounter(): void {
  // no-op: UID allocation is GameState-owned.
}

/**
 * キャラを現場に登場させる (rules/03, 20)
 * 5枚超過は例外 throw
 */
function enter(s: GameState, p: Player, cardId: string, opts: EnterOpts): SceneCharacter {
  // MR能力② (rules/18): MR 登場時は fullness 判定の前に既存 MR を除去 (空きが生まれ得る)。
  // 非 MR / 既除去なら no-op。
  applyMrEntryRemoval(s, p, cardId);
  if (s.players[p].scene.length >= sceneCap(s, p)) {
    throw new Error(`scene full: cannot enter ${cardId} for ${p} (scene has ${s.players[p].scene.length} chars, cap ${sceneCap(s, p)})`);
  }

  const currentCount = s.players[p].scene.length;
  // rules/17 §【疾風 N】用: ターン境界でリセットされる「このターンの登場番目」を increment
  const prevTurnEnter = s.turnState[p].enterCountThisTurn ?? 0;
  s.turnState[p].enterCountThisTurn = prevTurnEnter + 1;
  const char: SceneCharacter = {
    cardId,
    uid: generateUid(s, cardId),
    state: opts.active === false || def.card(cardId)?.entersSleep === true ? 'sleep' : 'active',
    isNamed: opts.named ?? false,
    enterOrder: currentCount + 1,
    enterOrderThisTurn: prevTurnEnter + 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };

  s.players[p].scene.push(char);
  return char;
}

/**
 * スイッチ登場: 既存キャラを cause='switch' でリムーブして新キャラ登場 (rules/20)
 */
function switchEnter(
  s: GameState,
  p: Player,
  cardId: string,
  removeUid: string,
  opts: EnterOpts,
): SceneCharacter {
  // MR能力② × switch 順序 (rules/18②/20, 未解決 #4 暫定保守解): MR 登場なら先に既存 MR を除去する。
  // 現場 MR を除去して空きが生まれた場合のみ switch は不要 (rules/20: switch は満杯時のみ) → victim 除去を
  // skip して over-removal を防ぐ。非 MR / PA-slot のみ除去 / 既存 MR 無し = freedSceneSlot=false →
  // 従来どおり victim を無条件除去 (回帰0: 非 MR の switchEnter は完全に旧挙動)。
  const freedSceneSlot = applyMrEntryRemoval(s, p, cardId);
  if (!freedSceneSlot) {
    // 現場の MR 除去で空きが生まれなかった → switch victim を除去 (5枚制限をバイパスするため先に除去)
    removeToRemove(s, removeUid, 'switch');
  }
  // ⚠ engine E3 P11 latent (2026-07-02、敵対 review): victim 除去は length を 1 減らすため、
  // length===cap の通常 switch では enter() の cap gate を必ず下回る。だが **条件付き** sceneCapOverride が
  // cap を現 scene 数より下へ落とした状態 (length > cap) で switch すると、除去後 length===cap のまま enter()
  // が throw しうる。現状 unreachable (全 override カードは無条件 cap ゆえ scene が cap を超えない / card 凍結中)。
  // 条件付き cap の consumer 出荷時に「switch は net-neutral ゆえ cap throw を bypass」guard を追加すること
  // (over-cap 時の裁定は公式未定 → 実カード + 裁定確定後に解決)。DEFERRED-INDEX / e3-altwin-decomposition 参照。
  // 新キャラ登場 (enter() 内の applyMrEntryRemoval は idempotent = ここでは no-op)
  return enter(s, p, cardId, opts);
}

/**
 * engine拡張 wave#2 cluster9 (2026-06-15): 離場するキャラの (裏向き/表向き)セットカード 1枚ごとに
 * setcard:leave を emit する (rules/16 セット解除 = set card が現場から離れる)。per-occurrence
 * (「1枚...離れるたび」公式Q&A)。
 * ⚠ host を scene から splice する **前** に呼ぶこと。host が listener 自身 (B07034 a1 の self-leave、
 *   公式Q&A「このキャラ自身が現場を離れた場合も発動」) のとき、collectCardsInPlay に host が残っている
 *   必要がある。emit-after-splice にすると self-leave 反応が無音で壊れる + limit-increment が
 *   off-board fallback に逃げる (cluster9 design-review FIX-1)。set card 自体は ability を持たないため
 *   virtual-location handler (leave:to-remove の handleLeaveToRemoveSelf 相当) は不要。
 * 既存カードは未購読 = additive (回帰0)。listener: src/engine/listeners/triggered.ts
 */
// W6 step10 (row9): leave:intercept 成立の log note (UI RecentActionToast / LogPanel 用)
function mutate_logInterceptNote(s: GameState, player: Player, dest: 'hand' | 'kept-in-scene', uid: string): void {
  logMutator.append(s, {
    ts: Date.now(),
    player,
    turn: s.turn.number,
    action: 'leave-intercept',
    target: uid,
    result: dest,
  });
}

function emitSetCardLeave(
  s: GameState,
  char: SceneCharacter,
  player: Player,
  entry: SceneCharacter['setCards'][number],
  cause: string,
): void {
  event.emit(
    s,
    'setcard:leave',
    {
      player,
      hostUid: char.uid,
      hostCardId: char.cardId,
      setCardId: entry.cardId,
      setCardInstanceId: entry.instanceId,
      faceUp: entry.faceUp,
      cause,
    },
    { player, uid: char.uid, cardId: char.cardId, setCardId: entry.cardId, setCardInstanceId: entry.instanceId },
  );
}

function emitSetCardLeaves(s: GameState, char: SceneCharacter, player: Player, cause: string): void {
  for (const entry of char.setCards) emitSetCardLeave(s, char, player, entry, cause);
}

/**
 * キャラをリムーブエリアへ移動 (rules/03, 16)
 * setCards → リムーブ、stackedCards → 保持中の実カードIDでリムーブ（旧count形式だけ互換用back-card）
 */
function removeToRemove(
  s: GameState,
  uid: string,
  cause: RemoveCause,
  byUid?: string,
  // MR partner-area (rules/18②): noMrRedirect=true で MR能力① の PA redirect を抑止する
  // (MR能力② による既存 MR 除去は「能力によるリムーブ」= remove へ残す。未解決 #2)。既存 caller は
  // 未指定 → redirect 有効 (相手ターン中の通常リムーブは PA へ。回帰0: MR rarity カードは現 0 枚)。
  // W6 step10 (row9): byPlayer = cause='effect' の効果 source 側 (atom-handlers/scene.ts が
  // ctx.source.player を渡す)。leave:intercept の「相手の能力や効果」帰属判定に使う。
  // 未指定 (legacy caller: turn.ts removeOnTurnEnd / MR②/switch 内部) は fail-closed = intercept なし。
  opts?: RemoveOpts,
): RemoveResult {
  const found = findChar(s, uid);
  if (!found) {
    return {
      removed: { uid, cardId: '' },
      setCardsRemoved: [],
      stackedCardsRemoved: 0,
      triggeredHooks: [],
    };
  }

  // Leave-trigger snapshots must carry stable physical set-card provenance.
  // Invalid uids remain an atomic no-op for legacy states.
  charMutator.ensureSetCardInstanceIds(s);
  const { char, player } = found;
  // rules/17 §【現場リムーブ時】 emit 用に離場カードの識別子を splice 前に捕捉
  const leavingUid = char.uid;
  const leavingCardId = char.cardId;
  const deferSetCardReplacement = (
    leaveInterceptDecision = opts?.leaveInterceptDecision,
  ): boolean => charMutator.deferSetCardReplacementForHostLeave(s, uid, {
    kind: 'scene-remove',
    cause,
    byUid,
    byPlayer: opts?.byPlayer,
    ...(leaveInterceptDecision ? { leaveInterceptDecision } : {}),
    ...(opts?.afterSceneRemove ? { afterSceneRemove: opts.afterSceneRemove } : {}),
  }, opts?.skipSetCardReplacementInstanceIds ?? []);

  // mega-wave W6 step10 (2026-07-04, row9): pre-splice leave:intercept consult (B01092/B01039)。
  // 「相手の能力や効果、コンタクトによって現場から離れるとき、代わりに〜」— splice 前に判定し、
  // 成立時は leave:to-remove emit も MR-PA redirect も**通らない** (B01092P Q&A「現場から離れる
  // 行為そのものを行わなかったことにする」— 相互排他は early return で構造保証)。
  // consult は純関数 (mutation はここで一元適用)。cost/switch/misplay-overflow は帰属外 (gate 内)。
  if (cause === 'contact-ap' || cause === 'effect') {
    const intercept = opts?.leaveInterceptDecision?.accept
      ? { kind: 'hand' as const, interceptorUid: opts.leaveInterceptDecision.interceptorUid }
      : opts?.leaveInterceptDecision
        ? null
        : consultLeaveIntercept(s, char, player, cause, byUid, opts?.byPlayer);
    if (intercept && intercept.kind === 'pending') {
      return {
        removed: { uid: '', cardId: '' },
        setCardsRemoved: [],
        stackedCardsRemoved: 0,
        triggeredHooks: [],
        deferred: true,
        pendingLeaveIntercept: { player, targetUid: uid, interceptorUid: intercept.interceptorUid },
      };
    }
    if (intercept && intercept.kind === 'kept-in-scene') {
      // B01039: rider set-card をコストとしてリムーブ (faceUp 先頭一致順)、キャラは現場に残る
      const kConsumed: string[] = [];
      for (const consumed of intercept.consumedSetCards) {
        const ki = char.setCards.findIndex(e => (
          e.cardId === consumed.cardId
          && e.instanceId === consumed.setCardInstanceId
          && e.faceUp
        ));
        if (ki === -1) continue;
        const entry = char.setCards.splice(ki, 1)[0];
        if (!entry) continue;
        addToRemove(s, player, [entry.cardId]);
        emitSetCardLeave(s, char, player, entry, cause);
        kConsumed.push(entry.cardId);
      }
      mutate_logInterceptNote(s, player, 'kept-in-scene', leavingUid);
      return {
        removed: { uid: '', cardId: '' },
        setCardsRemoved: kConsumed,
        stackedCardsRemoved: 0,
        triggeredHooks: [],
        prevented: true,
        redirectedTo: 'kept-in-scene',
      };
    }
    if (intercept && intercept.kind === 'hand') {
      // B01092: interceptor 自身をコストでリムーブ。対象キャラの B02052
      // 差し替え選択より先に確定させる。guardian にB02052があれば、その解決後に
      // この対象の離場を再開するまで host 側のB02052を作らない。
      const paidDecision: LeaveInterceptDecision = {
        interceptorUid: intercept.interceptorUid,
        accept: true,
        interceptorCostPaid: true,
      };
      if (!opts?.leaveInterceptDecision?.interceptorCostPaid) {
        const guardianResult = removeToRemove(s, intercept.interceptorUid, 'cost', undefined, {
          afterSceneRemove: {
            uid,
            cause,
            ...(byUid ? { byUid } : {}),
            ...(opts?.byPlayer ? { byPlayer: opts.byPlayer } : {}),
            leaveInterceptDecision: paidDecision,
          },
        });
        if (guardianResult.deferred) {
          return {
            removed: { uid: '', cardId: '' },
            setCardsRemoved: [],
            stackedCardsRemoved: 0,
            triggeredHooks: [],
            deferred: true,
          };
        }
        // Do not infer payment from a later absent-guardian no-op. A stale or
        // prevented cost leaves the intercepted host in the scene and ends it.
        if (guardianResult.prevented || guardianResult.removed.cardId === '') {
          return {
            removed: { uid: '', cardId: '' },
            setCardsRemoved: [],
            stackedCardsRemoved: 0,
            triggeredHooks: [],
            prevented: true,
          };
        }
      }
      if (deferSetCardReplacement(paidDecision)) {
        return {
          removed: { uid: '', cardId: '' },
          setCardsRemoved: [],
          stackedCardsRemoved: 0,
          triggeredHooks: [],
          deferred: true,
        };
      }
      // 対象キャラ: set/stacked は remove へ (rules/16 — redirect されるのはキャラ本体のみ)、本体は手札へ
      charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
      const hSetCardsRemoved: string[] = char.setCards.map(e => e.cardId);
      addToRemove(s, player, hSetCardsRemoved);
      emitSetCardLeaves(s, char, player, cause); // set-card 自身は正規に離れる (row9 risks(a))
      const hStacked = moveStackedCardsToRemove(s, player, char);
      // hand.push は splice 成功時のみ (混成 review opus NIT: interceptor cost 除去の
      // 【現場リムーブ時】cascade が対象 char を先に除去した病的ケースで phantom 手札を作らない)
      const hIdx = s.players[player].scene.findIndex(c => c.uid === uid);
      if (hIdx !== -1) {
        s.players[player].scene.splice(hIdx, 1);
        s.players[player].hand.push(char.cardId);
      }
      mutate_logInterceptNote(s, player, 'hand', leavingUid);
      return {
        removed: { uid: leavingUid, cardId: leavingCardId },
        setCardsRemoved: hSetCardsRemoved,
        stackedCardsRemoved: hStacked,
        triggeredHooks: [],
        prevented: true,
        redirectedTo: 'hand',
      };
    }
  }

  if (deferSetCardReplacement()) {
    return { removed: { uid: '', cardId: '' }, setCardsRemoved: [], stackedCardsRemoved: 0, triggeredHooks: [], deferred: true };
  }

  // setCards のカードをリムーブエリアへ (rules/16 セット解除: リムーブ時表向きに)
  charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
  const setCardsRemoved: string[] = char.setCards.map(e => e.cardId);
  addToRemove(s, player, setCardsRemoved);

  // engine拡張 wave#2 cluster9: set card 離場 → setcard:leave emit (host splice 前)。
  // rules/30: 現場6枚超過の修正処置 (misplay-overflow) はリムーブ発動能力 不発動 → 除外
  // (leave:to-remove と同一 posture)。
  if (cause !== 'misplay-overflow') {
    emitSetCardLeaves(s, char, player, cause);
  }

  // stackedCards は保持中の実カードIDでリムーブ（旧count形式だけback-card）
  const stackedCardsRemoved = moveStackedCardsToRemove(s, player, char);

  // キャラ本体をリムーブエリアへ
  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  addToRemove(s, player, [char.cardId]);

  if (cause === 'contact-ap' && byUid) {
    const attacker = findChar(s, byUid);
    if (attacker && attacker.player !== player) {
      attacker.char.turnEffects.removedOpponentByContactThisTurn = true;
    }
  }

  // rules/17 §【現場リムーブ時】(リムーブ方法は問わない) → leave:to-remove Hook 発火。
  // rules/30: 現場6枚超過の修正処置 (misplay-overflow) はリムーブ発動能力 不発動 → 除外。
  // 既存カードは未購読のため additive (回帰0)。listener: src/engine/listeners/triggered.ts
  if (cause !== 'misplay-overflow') {
    event.emit(
      s,
      'leave:to-remove',
      // cluster15 (2026-06-16): removal-observer (反撃カード一族) 用 attribution を additive 追加。
      // side = 除去キャラ所属 player (splice 前既取得)、byUid = 除去者 (contact judge が aUid を渡す、
      // 他 caller は undefined)。既存 consumer は全て selfOnly で source.uid 照合のため新フィールド無視 = 回帰0。
      // removedChar (2026-06-23): 離場キャラ snapshot (splice 前の char ref)。removedCharMatches.removedFilter が
      // 色/特徴/レベル/状態を判定する用 (rules/17/19)。matchOneFilter は char.turnEffects から effective level を読む
      // ため splice 後も同期 eval 中は修正後レベルが正しい。既存 consumer は本フィールドを無視 = 回帰0。
      // byPlayer (attribution mini-wave 2026-07-10): 効果 owner (atom-handlers/scene.ts:338 が
      // ctx.source.player を渡す既存 opts を emit に配線)。removedCharMatches.byPlayer
      // (「自分の能力や効果によってリムーブされたとき」) の帰属判定用。legacy caller
      // (turn-end/MR②/switch/cost) は未指定 = undefined → byPlayer gate は fail-closed。
      // cardId (S1 wave 2026-07-11, B05101): 離場キャラの cardId — 「このキャラをリムーブエリアから
      // 登場させて」(self-revival) が $trigger.cardId で remove 内の自カードを特定する用。
      // 既存 consumer は本フィールドを無視 = 回帰0 (additive)。
      {
        uid: leavingUid, cause, side: player, byUid, removedChar: char,
        byPlayer: opts?.byPlayer, cardId: leavingCardId,
        triggeredAuraAbilities: opts?.triggeredAuraAbilities,
      },
      { player, uid: leavingUid, cardId: leavingCardId },
    );
  }

  // MR能力① (rules/18): 相手ターン中の離脱なら PA へ。leave:to-remove emit 後 (暫定 #1)。
  // char.cardId は L158 で remove 末尾に push 済 + emit 中に remove へ追加 push は無い → pop で正確に除去
  // (refresh 二重計上防止)。MR能力②による除去 (cause='effect' + opts.noMrRedirect) は本 redirect を抑止
  // (rules/18② 「能力によるリムーブ」= remove へ残す。未解決 #2)。
  const redirectedToPartner = !opts?.noMrRedirect && shouldRedirectMrToPA(s, char, player);
  if (redirectedToPartner) {
    s.players[player].remove.pop();
    advanceIndexedZoneEpoch(s, player, 'remove');
    placeMrInPA(s, char, player);
  }

  return {
    removed: { uid: leavingUid, cardId: leavingCardId },
    setCardsRemoved,
    stackedCardsRemoved,
    triggeredHooks: [],
    ...(redirectedToPartner ? { redirectedToPartner: true } : {}),
  };
}

/** Apply a human leave-intercept response without consulting the optional window again. */
function resolveLeaveIntercept(
  s: GameState,
  targetUid: string,
  cause: RemoveCause,
  byUid: string | undefined,
  byPlayer: Player | undefined,
  interceptorUid: string,
  accept: boolean,
): RemoveResult {
  return removeToRemove(s, targetUid, cause, byUid, {
    byPlayer,
    leaveInterceptDecision: { interceptorUid, accept },
  });
}

/** Remove one simultaneous group with triggered auras fixed at batch start. */
function removeToRemoveBatch(
  s: GameState,
  uids: string[],
  cause: RemoveCause,
  byUid?: string,
  opts?: Omit<RemoveOpts, 'triggeredAuraAbilities'>,
): RemoveResult[] {
  const uniqueUids = [...new Set(uids)];
  // A simultaneous group cannot preserve a resumable human B02052 choice.
  // Admit or reject before aura collection or any zone mutation, never leave a
  // half-applied batch behind a single global pending prompt.
  if (uniqueUids.some((uid) => charMutator.wouldDeferSetCardReplacementForHostLeave(s, uid))) {
    throw new Error('unsupported-human-deferred-batch');
  }
  const auraByUid = new Map<string, AbilityDef[]>();
  for (const uid of uniqueUids) {
    const found = findChar(s, uid);
    if (!found) continue;
    auraByUid.set(uid, effectiveTriggeredAuraAbilities(s, {
      player: found.player,
      uid: found.char.uid,
      cardId: found.char.cardId,
      char: found.char,
    }));
  }
  const results: RemoveResult[] = [];
  for (const uid of uniqueUids) {
    results.push(removeToRemove(s, uid, cause, byUid, {
      ...opts,
      triggeredAuraAbilities: auraByUid.get(uid),
    }));
  }
  return results;
}

/**
 * 変装で元キャラをデッキの下へ移動 (rules/09)
 * リムーブではないため「現場リムーブ時」効果は発動しない (rules/23)
 */
function toDeckBottom(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  // MR能力① (rules/18, 防御的): 相手ターン中なら deck 下ではなく PA へ (離脱方法不問)。
  // ⚠ scene.toDeckBottom の実呼出元は cost/pay.ts:137 selfToDeckBottom (宣言コスト) のみ。コストは自ターンに
  //   支払うため MR① gate (turn.player≠owner) は実発火しない dead/defensive 経路。変装の元キャラは
  //   contact.ts が mutate.deck.toBottom を直呼 (本関数を通らない、rules/23 リムーブでない と整合)。
  if (shouldRedirectMrToPA(s, char, player)) {
    // 本関数は通常 set/stack を新キャラへ引継ぐ (変装) が、MR① は新キャラ無しで現場離脱 → rules/16 で remove へ。
    charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
    addToRemove(s, player, char.setCards.map(e => e.cardId));
    moveStackedCardsToRemove(s, player, char);
    placeMrInPA(s, char, player);
    return;
  }
  // デッキの下へ
  s.players[player].deck.push(char.cardId);
  advanceIndexedZoneEpoch(s, player, 'deck');
}

/**
 * 現場から所有者のデッキへ移す (Task D E2, 2026-06-12)
 * rules/16: 現場を離れるとき set/stacked はリムーブ (toHand と同一処理)。
 * rules/09・23: デッキ移動はリムーブではないため leave:to-remove は emit しない。
 * - 変装専用の toDeckBottom (rules/16 処理なし・set/stacked は新キャラへ引継ぎ) とは別物。
 * - 所有者のデッキ (char の所属プレイヤー) に入る。effect 発動側ではない点に注意。
 */
function toDeck(s: GameState, uid: string, pos: 'bottom' | 'top' = 'bottom'): boolean {
  const found = findChar(s, uid);
  if (!found) return false;

  const { char, player } = found;
  if (charMutator.deferSetCardReplacementForHostLeave(s, uid, { kind: 'scene-to-deck', pos })) return false;
  // rules/16 setCards / stackedCards は離場時にリムーブされる
  charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
  if (char.setCards.length > 0) {
    addToRemove(s, player, char.setCards.map(e => e.cardId));
  }
  moveStackedCardsToRemove(s, player, char);

  // engine拡張 wave#2 cluster9: set card 離場 → setcard:leave emit (host splice 前)。
  // デッキ移動自体は leave:to-remove ではないが、set card は rules/16 でリムーブされる = 現場から離れる。
  emitSetCardLeaves(s, char, player, 'leave:to-deck');

  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  // MR能力① (rules/18): 相手ターン中なら deck ではなく PA へ (離脱方法不問)。
  // set/stack は冒頭で remove へ push 済 (rules/16) → ここでは placeMrInPA が slot 側を空にするのみ (二重 push しない)。
  if (shouldRedirectMrToPA(s, char, player)) {
    placeMrInPA(s, char, player);
    return true;
  }
  if (pos === 'top') {
    s.players[player].deck.unshift(char.cardId);
  } else {
    s.players[player].deck.push(char.cardId);
  }
  advanceIndexedZoneEpoch(s, player, 'deck');
  return true;
}

/**
 * 現場から所有者の手札へ戻す (rules/16: 現場を離れるとき set/stacked はリムーブ)
 * engine-extension #4 (2026-06-05): char→hand bounce verb の primitive.
 * - リムーブではないため leave:to-remove は emit しない (rules/17 と整合)
 * - 所有者の手札 (char の所属プレイヤー) に cardId を push。effect 発動側ではない点に注意。
 */
function toHand(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  if (charMutator.deferSetCardReplacementForHostLeave(s, uid, { kind: 'scene-to-hand' })) return;
  // rules/16 setCards / stackedCards は離場時にリムーブされる
  charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
  if (char.setCards.length > 0) {
    addToRemove(s, player, char.setCards.map(e => e.cardId));
  }
  moveStackedCardsToRemove(s, player, char);

  // engine拡張 wave#2 cluster9: set card 離場 → setcard:leave emit (host splice 前)。
  emitSetCardLeaves(s, char, player, 'leave:to-hand');

  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  // MR能力① (rules/18): 相手ターン中なら手札ではなく PA へ (離脱方法不問)。
  if (shouldRedirectMrToPA(s, char, player)) {
    placeMrInPA(s, char, player);
    return;
  }
  // キャラ本体は所有者の手札へ
  s.players[player].hand.push(char.cardId);
}

/**
 * 現場から **所有者の** 証拠へ移す (engine mega-wave W1 2026-07-03, P38)。
 * 「相手はそのカードを表向きのまま証拠として得る」(B03084)。toHand/toDeck の isolated clone。
 * - リムーブではないため leave:to-remove は emit しない (rules/17 と整合)
 * - set/stacked は離場時リムーブ (rules/16)
 * - MR能力① redirect は toHand/toDeck と parity (rules/18: 相手ターン中の離場は PA へ、証拠化されない)
 * - 証拠は push = 末尾 = 1番上 (mutate/evidence.removeTop と整合、公式Q&A B03084「1番上に置かれます」)
 */
function toEvidence(s: GameState, uid: string, faceUp: boolean, sourceCardId?: string): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  if (charMutator.deferSetCardReplacementForHostLeave(s, uid, { kind: 'scene-to-evidence', faceUp, sourceCardId })) return;
  // rules/16 setCards / stackedCards は離場時にリムーブされる
  charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
  if (char.setCards.length > 0) {
    addToRemove(s, player, char.setCards.map(e => e.cardId));
  }
  moveStackedCardsToRemove(s, player, char);

  // set card 離場 → setcard:leave emit (host splice 前、toHand/toDeck と同流儀)
  emitSetCardLeaves(s, char, player, 'leave:to-evidence');

  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  // MR能力① (rules/18): 相手ターン中なら証拠ではなく PA へ (離脱方法不問)
  if (shouldRedirectMrToPA(s, char, player)) {
    placeMrInPA(s, char, player);
    return;
  }
  // キャラ本体は所有者の証拠へ (表裏はカードテキスト指定)
  s.players[player].evidence.push({
    cardId: char.cardId,
    faceUp,
    origin: { turn: s.turn.number, via: 'effect', ...(sourceCardId ? { sourceCardId } : {}) },
  });
  advanceIndexedZoneEpoch(s, player, 'evidence');
}

/**
 * キャラの状態を直接設定 (rules/03)
 * ⚠ active を渡したとき、現在 stun なら sleep に変換 (スタン特殊挙動)
 * ⚠ stun 状態で sleep/stun を渡してもスタンのまま
 */
function setState(s: GameState, uid: string, st: CharState, cause?: string): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  const prev = char.state;

  // スタン状態の特殊挙動 (rules/03)
  if (char.state === 'stun') {
    if (st === 'active') {
      // スタン状態でアクティブにする効果を受けた → スリープになる
      char.state = 'sleep';
      // ⚠ これは stun→sleep 遷移であり「アクティブ状態のキャラがスリープになった」ではない
      // (rules/03: スタンは元アクティブではない) → state:change (active→sleep) は emit しない。
    }
    // sleep/stun を渡してもスタンのまま (何もしない)
    return;
  }

  char.state = st;

  // engine additive A2 (2026-07-11, B03008 阿笠博士): active→sleep 遷移の汎用 state:change emit。
  // 「アクティブ状態の〚特徴［少年探偵団］〛のキャラがスリープ状態になったとき」(推理/アクション/
  // ガード/宣言コスト/効果いずれのスリープ化も網羅、公式Q&A) を card-triggerable 化する唯一の
  // chokepoint。**状態が実際に変わった時 (prev==='active' && st==='sleep') のみ** emit するため
  // オートフェイズの再アクティブ化 (→active) や sleep→sleep の再設定では発火しない = hot-path 静穏。
  // 既存カードは 'state:change' を未購読 → handleHook が一致 ability 0 = pendingEffects 不変 (回帰0)。
  // payload {player,uid,from,to,cause}: 消費側は triggerCharMatches{payloadKey:'uid'} で char を、
  // side/trait を filter で判定 (from==='active' は本 gate で構造保証済のため card 側 from 判定不要)。
  if (prev === 'active' && st === 'sleep') {
    event.emit(
      s,
      'state:change',
      { player, uid, from: prev, to: st, cause },
      { player, uid, cardId: char.cardId },
    );
  }
}

/**
 * tryActivate: setState('active') と同等だが意味として明示
 * スタン状態では sleep に変換 (rules/03)
 */
function tryActivate(s: GameState, uid: string): void {
  setState(s, uid, 'active');
}

/** 名乗り状態を解除する (ターン跨ぎで自動呼出し) */
function clearNamed(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.isNamed = false;
}

/**
 * 現場キャラを別の現場キャラの下に「重ねる」(engine mega-wave W4 r5/r6, 2026-07-03)。
 * rules/16: 重なっているカードは情報を持たない (枚数のみ) / 現場キャラ数に数えない。
 * - リムーブではない → leave:to-remove は emit しない (rules/17【現場リムーブ時】不発動、
 *   rules/23 の「デッキ下移動はリムーブでない」類推 + B06008/B06005 Q&A)。
 * - 自身の set/stacked は離場時リムーブ (rules/16、toHand/toDeck 同型 cascade)。
 * - **MR① redirect は行わない** — 公式Q&A (B09048):「現場にいるMRのキャラを重ねることは
 *   できますか？ → はい。…重なっているカードは情報を持たないので、MR能力は有効ではありません」
 *   = PA 移動なしでそのまま重なる (toHand/toDeck の redirect parity をあえて外す唯一の離場 verb)。
 * - host 側は stackedCards += 1。host 不在 (解決前に離場) は no-op fizzle (rules/15)。
 */
function toStack(s: GameState, uid: string, hostUid: string): boolean {
  if (uid === hostUid) return false; // 自己対象縮退 (防御、B06008 filter cardNameNot が通常排除)
  const found = findChar(s, uid);
  if (!found) return false;
  const hostFound = findChar(s, hostUid);
  if (!hostFound) return false;
  const { char, player } = found;
  if (charMutator.deferSetCardReplacementForHostLeave(s, uid, { kind: 'scene-to-stack', hostUid })) return false;
  // rules/16 setCards / stackedCards は離場時にリムーブされる
  charMutator.replaceEligibleSetCardsBeforeHostLeaves(s, uid);
  if (char.setCards.length > 0) {
    addToRemove(s, player, char.setCards.map(e => e.cardId));
  }
  moveStackedCardsToRemove(s, player, char);
  emitSetCardLeaves(s, char, player, 'leave:to-stack');
  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  stackCardUnder(hostFound.char, char.cardId, `stack:${char.uid}`);
  return true;
}

export const scene = {
  enter,
  switchEnter,
  removeToRemove,
  resolveLeaveIntercept,
  removeToRemoveBatch,
  toHand,
  toDeck,
  toDeckBottom,
  toEvidence,
  toStack,
  selfToPartnerArea,
  setState,
  tryActivate,
  clearNamed,
};
