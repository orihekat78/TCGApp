// Round 4b: triggered ability の汎用 listener
//
// rules: 15-abilities-effects.md §条件発動, 17-icons.md §【登場時】等
// spec: .claude/specs/engine-api-card-abilities.md, engine-api-events.md
//
// 役割:
//   - 7 種類の hook (enter / effect:declared / action:declare / action:guarded /
//     contact:start / case:to-resolved / phase:end:start) を listener 登録
//   - 発火時に scene / partner-area / case-area / hand 上の全カードを走査
//   - 各カードの triggered ability で hook が一致するものを抽出
//   - scope / selfOnly / matcher / condition でフィルタし、合格分の effect を
//     pendingEffects へ queue
//
// 設計上の注意:
//   - Round 1-3 で hirameki / misread の 2 hook しか listener なく、enter 等の
//     triggered ability が全件 noop になっていた (BUG-005 / BUG-007) を解消
//   - 既存 hirameki / misread listener は icon ability 専用パスで残存、本 listener は
//     type='triggered' (条件発動) のみを対象とする
//   - 'effect:declared' hook では payload.cardId を見て on-hand のカード自身を判定
//     (event card 自身が「使われた」とき発動する eventRemoveByAP 等の pattern)
//   - selfOnly: scene/partner では source.uid が一致、hand では payload.cardId が一致

import { event } from '../event/registry.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js'; // BUG-096: triggered ability の limit enforcement
import { flag } from '../mutate/flag.js';            // BUG-096: declaredUseCount 流用
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from '../effect/resolve-picks.js';
import { _setDeferredEntryPickResolver } from '../resolve/stack.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type { GameState, AbilityDef, AbilityScope, Effect, EffectStackEntry } from '../types/index.js';
// 2026-05-27 Option C: ヒラメキは triggered hook='evidence:remove-by-action' + optional:true
// として本 listener で処理。検出時は pendingHirameki side-channel に push して fire/skip を UI に委譲。
import { pushPendingHirameki } from './hirameki.js';

// user_request 20260522_01 #6/#2: human player side の globalThis 側チャネル
// (hirameki / misread と同じ pattern)。UI 側 (App.tsx 等) が GameSetupModal で
// 「対戦開始」(spectatorMode=false) のとき 'self' を set、観戦モード/null は
// human 無し。triggered.ts は本 flag を見て auto-pick を skip する。
declare global {
  // eslint-disable-next-line no-var
  var __humanPlayerSide: 'self' | 'opp' | null | undefined;
}

function getHumanPlayerSide(): 'self' | 'opp' | null {
  return (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
}

export function _setHumanPlayerSide(side: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
}

type Player = 'self' | 'opp';

// refactor 2b (2026-06-12): export 化 — scripts/taskA-validate-specs.cjs HOOKS との同期を
// tests/engine/sync-taskA-whitelists.test.ts が機械検証するため。
export const TRIGGERED_HOOKS = [
  'enter',
  'effect:declared',
  'action:pre-target', // D11007 v2 Phase 3: attacker 選択時、target 列挙前
  'action:declare',
  'action:guarded',
  'contact:start',
  'case:to-resolved',
  'phase:end:start',
  // engine-extension #1: 現場リムーブ時 (rules/17 §リムーブ方法は問わない)。離場カード自身は
  // collectCardsInPlay に出ないため handleLeaveToRemoveSelf (virtual location) を併用、
  // 在場カードの「キャラがリムーブされたとき」反応は通常 in-play scan (handleHook)。
  'leave:to-remove',
  // 2026-05-27 Option C: ヒラメキ統合。payload.ev.cardId の def から
  // trigger.hook='evidence:remove-by-action' の ability を探す (in-play scan 経路と別)。
  'evidence:remove-by-action',
  // engine-extension (2026-06-06 タスクC): 推理反応 (rules/11)。doReasoning が emit する
  // reasoning:end (source={player, uid}=推理したキャラ) を card-triggerable 化。推理後 (証拠加算後) に
  // 発火。推理キャラは scene に sleep で残るため collectCardsInPlay に出る → 特別 handler 不要、
  // 通常 in-play scan (handleHook) で処理。selfOnly=「このキャラが推理したとき」(source.uid 一致)。
  'reasoning:end',
  // engine-extension (2026-06-06 タスクC): 変装時 (rules/09 §変装, 23-qa-disguise-cutin.md)。
  // flow.contact.disguise が emit する disguise:into (source={player, uid}=変装で入れ替わったキャラ。
  // uid は維持され cardId のみ変装カードに差替わる) を card-triggerable 化。変装後のキャラは scene に
  // 残り、cardId は変装カードのものに変わるため collectCardsInPlay は変装カード def を走査する →
  // 特別 handler 不要、通常 in-play scan (handleHook) で 【変装時】ability を発火。
  // selfOnly=「(変装した) このキャラが…」(source.uid=変装キャラ uid 一致)。rules/09: 変装は「登場」では
  // ないため enter hook は発火せず、disguise:into のみ発火する (登場時能力は別 hook で不発)。
  'disguise:into',
  // Task D E3 (2026-06-12): 「FILEエリアにあるカードを手札に加えたとき」(B05050) を card-triggerable 化。
  // emit 箇所: next-hint.ts:74 (既存) + filePopToHand (BUG-128 修正で追加)。payload={player, popped}。
  // キャラ uid を持たない hook のため matcherCondition は triggerPlayerIs を使う (triggerCharMatches 不適合)。
  'file:pop',
  // engine拡張 wave#2 cluster3 (2026-06-13): 「このキャラのアクション終了時」(PR086/B03073/B05108) を
  // card-triggerable 化。emit は既存 (state-machine.ts completed/aborted、source={player,uid}=actor)。
  // 公式 qAndA「アクション終了時に現場にいないキャラの能力は発動しない」は in-play scan
  // (collectCardsInPlay) + selfOnly で自然成立 (離場 actor は走査対象外、rules/22)。
  'action:end',
  // engine拡張 wave#2 cluster3 (2026-06-13): 「〜のアクション[事件]によって証拠を得たとき」
  // (B08012/B01067/D04007) を card-triggerable 化。emit は flow/action-case.ts gainSelfEvidence のみ
  // (rules/10 手順3 = 実獲得時のみ。推理/効果/refresh 由来では emit しない — この排他性が
  // 「アクション[事件]によって」の語義を構造的に保証する。pin: wave2-cluster3 test)。
  'evidence:gain',
  // engine拡張 wave#2 cluster9 (2026-06-15): 「(裏向き)セットカードが現場から離れたとき」(rules/16)。
  // emit 元 = scene.ts removeToRemove/toDeck/toHand (host splice 前、per-entry) + char.ts removeOneSetCard。
  // 離場するのは set card (ability を持たない) で、listener は in-play の B07034/B02020。
  // host が listener 自身 (B07034 self-leave Q&A) の場合も emit-before-splice で collectCardsInPlay に残る
  // → 特別 handler 不要、通常 in-play scan (handleHook) で処理。side 判定は triggerPlayerIs (file:pop 同様)。
  'setcard:leave',
] as const;

type TriggeredHook = (typeof TRIGGERED_HOOKS)[number];

type CardLocation = {
  player: Player;
  uid: string;
  cardId: string;
  // 2026-05-27 Option C: 'evidence' を追加。handleEvidenceRemovedHook が virtual な
  // 「リムーブされた証拠」を CardLocation として組み立てて handleHook の共通処理 (effect queue) を再利用する。
  area: 'scene' | 'partner-area' | 'case' | 'hand' | 'evidence';
};

function collectCardsInPlay(state: GameState): CardLocation[] {
  const result: CardLocation[] = [];
  for (const p of ['self', 'opp'] as const) {
    const ps = state.players[p];
    // scene キャラ
    for (const c of ps.scene) {
      result.push({ player: p, uid: c.uid, cardId: c.cardId, area: 'scene' });
    }
    // partner card
    if (ps.partner.cardId) {
      result.push({ player: p, uid: `partner:${p}`, cardId: ps.partner.cardId, area: 'partner-area' });
    }
    // case card (rules/06: 事件カード)
    if (ps.case.cardId) {
      result.push({ player: p, uid: `case:${p}`, cardId: ps.case.cardId, area: 'case' });
    }
    // MR partner-area (rules/18, engine/mr-partner-area-core 2026-06-23): PA 常駐 MR を別 uid
    // `partnerMR:p` + area 'partner-area' で登録 (real partner の `partner:p` と別文字列 = double-fire 防止)。
    // scope on-partner-area / always の triggered・declared ability がここから拾われる。slot の uid は
    // 既に `partnerMR:p` sentinel に書換済 (mutate/scene.placeMrInPA) なので selfOnly source.uid 照合と整合。
    if (ps.partnerAreaMR) {
      result.push({ player: p, uid: `partnerMR:${p}`, cardId: ps.partnerAreaMR.cardId, area: 'partner-area' });
    }
    // hand card (event card の on-hand ability 用)
    for (const cardId of ps.hand) {
      result.push({ player: p, uid: `hand:${p}:${cardId}`, cardId, area: 'hand' });
    }
  }
  return result;
}

function scopeAllowsArea(scope: AbilityScope | undefined, area: CardLocation['area']): boolean {
  // scope 未指定は 'on-scene' default (rules/15)
  const s = scope ?? 'on-scene';
  if (s === 'always') return true;
  if (s === 'on-scene') return area === 'scene';
  // on-partner-area: パートナーエリア OR 現場 (MR でも両方で動く)
  if (s === 'on-partner-area') return area === 'partner-area' || area === 'scene';
  if (s === 'on-hand') return area === 'hand';
  // 2026-05-27 Option C: on-evidence scope を許可。area='evidence' は
  // handleEvidenceRemovedHook の VIRTUAL CardLocation 経由でのみ渡る (collectCardsInPlay
  // は通常 evidence を返さない)。これで scope 整合性 check が通る。
  if (s === 'on-evidence') return area === 'evidence';
  return false;
}

function selfOnlyMatches(
  card: CardLocation,
  payload: unknown,
  source: unknown,
): boolean {
  const sourceUid = (source as { uid?: string } | undefined)?.uid;
  // on-hand のカード (event card 自身の使用検知) は payload.cardId + source.player で一致確認。
  // Round 4i-fix (BUG-032): player 比較を追加。両プレイヤー手札に同 cardId があると
  // 誤発動していた gap を塞ぐ。handUseCard は source.player を emit 時に詰めるので
  // ここで照合できる (src/engine/flow/main/hand-use-card.ts)。
  if (card.area === 'hand') {
    const payloadCardId = (payload as { cardId?: string } | undefined)?.cardId;
    const sourcePlayer = (source as { player?: string } | undefined)?.player;
    return payloadCardId === card.cardId && sourcePlayer === card.player;
  }
  // scene/partner/case は source.uid で一致確認
  return sourceUid === card.uid;
}

// BUG-132 GAP-2 (2026-06-12): effect:declared の emit 1 回 = 1 batch の連番カウンタ。
// 同一 emit で queue される全 entry (自効果 + 第三者反応) に同じ番号を付与し、
// stack.next() の pairwise gate で「自効果 → 反応」順 (rules/15 §未解決 + B08020 公式Q&A
// 「使用したイベントの効果を先に解決します」) を保証する。
let declaredBatchSeq = 0;

function handleHook(
  hookName: TriggeredHook,
  state: GameState,
  payload: unknown,
  source: unknown,
): void {
  const declaredBatch = hookName === 'effect:declared' ? ++declaredBatchSeq : undefined;
  for (const card of collectCardsInPlay(state)) {
    const def = readDef.card(card.cardId);
    if (!def) continue;
    // Task D E4 (2026-06-12): granted triggered ability (charGrantAbility) の合算走査。
    // scene のキャラのみ turnEffects.grantedAbilities を持ちうる。granted 配列が無ければ
    // 追加コストほぼゼロ (def.abilities そのまま)。limit は granted id で declaredUseCount が機能。
    const grantedRaw = card.area === 'scene'
      ? state.players[card.player].scene.find(c => c.uid === card.uid)?.turnEffects?.['grantedAbilities']
      : undefined;
    const abilityList = Array.isArray(grantedRaw) && grantedRaw.length > 0
      ? [...(def.abilities as AbilityDef[]), ...(grantedRaw as AbilityDef[])]
      : (def.abilities as AbilityDef[]);
    for (const ability of abilityList) {
      if (ability.type !== 'triggered') continue;
      const trig = ability.trigger;
      // multi-hook (2026-06-06 タスクC): trig.hook OR trig.hooks のいずれかが一致で発火。
      // 共有【ターンN】は limit が ability.id 単位のため自動成立 (下の limit check)。
      if (!trig || (trig.hook !== hookName && !(trig.hooks?.includes(hookName) ?? false))) continue;
      // 【カットイン】(effect:declared + optional) はコンタクト中の cutin 起動経由
      // (flow.contact.cutIn が emit する payload.abilityId==='cutin') でのみ発火する。
      // handUseCard / next-hint のキャラ召喚・イベント使用 emit (payload.kind set / abilityId なし) では
      // 発火させない — さもないと召喚毎に noop の charModifyAP($contact.byUid) entry が pendingEffects に
      // 残留し続け、効果スタック counter が毎ターン増加 + 古い resolved entry が UI を汚す
      // (CPU per-move 可視化で顕在化したバグ)。rules/09 §カットイン, rules/22。
      if (
        hookName === 'effect:declared'
        && trig.optional === true
        && (payload as { abilityId?: unknown } | undefined)?.abilityId !== 'cutin'
      ) {
        continue;
      }
      // scope check
      if (!scopeAllowsArea(ability.scope, card.area)) continue;
      // selfOnly check
      if (trig.selfOnly && !selfOnlyMatches(card, payload, source)) continue;
      // matcher check (カード側で custom 判定)
      if (trig.matcher && !trig.matcher(payload, state)) continue;
      // D11007 v2 (Phase 2): matcherCondition (declarative 版 matcher)
      // payload を ctx.triggerPayload に詰めて evalCond に渡す
      if (trig.matcherCondition) {
        const ctxMc = {
          source: {
            cardId: card.cardId,
            uid: card.uid,
            abilityId: ability.id,
            player: card.player,
            area: card.area,
          },
          bindings: {},
          triggerPayload: payload,
        };
        if (!evalCond(state, trig.matcherCondition, ctxMc)) continue;
      }
      // Round 4i-fix: ability.condition の 6 stage gate (BUG-033)
      // partnerColor / caseTrait 等の condition が未達なら queue しない (rules/17 §条件アイコン)
      if (ability.condition) {
        const ctx = {
          source: {
            cardId: card.cardId,
            uid: card.uid,
            abilityId: ability.id,
            player: card.player,
            area: card.area,
          },
          bindings: {},
          triggerPayload: payload,
        };
        if (!evalCond(state, ability.condition, ctx)) continue;
      }
      // effect が無いと queue しても無意味
      if (!ability.effect) continue;
      // BUG-096: triggered ability の limit:{kind:'turn',n} (【ターン①/②】) を enforcement。
      // declared フロー (declared-ability.ts:82-84) と同じ declaredUseCount を流用
      // (SceneCharacter.declaredUseCount、resetTurnFlags がターン境界で reset、rules/17)。
      if (ability.limit?.kind === 'turn') {
        if (readChar.declaredUseCount(state, card.uid, ability.id) >= ability.limit.n) continue;
      }
      // Phase 7-2 (BUG-035 fix): effect 内の $pick atom を候補から substitute してから queue
      // recursive utility が atom / choice / sequence / conditional / optional 等を walk
      // Phase 7-3: chooseAtomTarget callback で verb 別ヒューリスティック選択 (敵 highest AP 等)
      const resolveCtx = {
        source: {
          cardId: card.cardId,
          uid: card.uid,
          abilityId: ability.id,
          player: card.player,
          area: card.area,
        },
        bindings: {},
        // 2026-06-06 タスクC: optional surface 時に $trigger.<field> 用 payload を引き継ぐ
        // (B03038 の $trigger.gained = reasoning:end payload.gained)。
        triggerPayload: payload,
      };
      // Phase 7-3: listener callback 内で instantiate (module top では circular import 発生)。
      // misread.ts:110 と同じパターン。allocation cost は 1 ability/frame で実害なし。
      const aiPolicy = new HeuristicPolicy();
      // user_request 20260522_01 #6/#2 + BUG-054 + BUG-065-followup:
      // human player owned effect は humanChooser=true で resolveEffectPicks に
      // 渡し、$pick 検出時に side-channel `__pendingEffectPickSide` を set。
      //
      // BUG-065-followup: 旧実装は side-channel set 時に effect 全体の queue を
      // skip していたが、sequence の途中で pick が出る effect (例: D08015 a1 =
      // sequence([draw, choice([discard with pick])])) では pre-pick step
      // (draw) も失われていた。pattern A 時代は effect 全体が pick atom 1 つ
      // だったため問題にならなかった。
      //
      // 現実装: effect 全体を常に queue する。pick 未解決の atom は
      // atom-handlers の safety net (例: discard:skip-unresolved-pick) で no-op
      // 扱い。後で UI が modal でユーザー選択 → effectPickResolve dispatch で
      // 解決済み atom が単体で queue されて実行される。
      const humanSide = getHumanPlayerSide();
      const isHumanEffect = humanSide !== null && card.player === humanSide;
      // BUG-132 GAP-2: 第三者反応 (own = trig.selfOnly===true 以外) は pick/dyn を queue 時に
      // 確定せず raw のまま queue し、stack.runOne() の遅延 substitute (下の
      // resolveDeferredEntryPicks) で解決時盤面の候補を参照する (rules/15 §解決時参照、
      // B07016/B08020 a2「（イベントを解決してからキャラを選ぶ）」)。selfOnly entry
      // (イベント自効果 / カットイン自効果 / scene rider) は従来通り queue 時解決。
      const isDeclaredReaction = hookName === 'effect:declared' && trig.selfOnly !== true;
      const resolvedEffect = isDeclaredReaction
        ? ability.effect
        : resolveEffectPicks(state, ability.effect, resolveCtx, {
            chooseAtomTarget: isHumanEffect
              ? undefined
              : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
            byPlayer: card.player,
            humanChooser: isHumanEffect,
            source: { cardId: card.cardId, abilityId: ability.id },
          });
      // queue (side-channel set されていても skip しない、pre-pick step 実行のため)
      // 2026-05-27 (Option C follow-up): emit source.bindings (例: cutin の contact bindings)
      // を event.queue 経由で entry に永続化、effect 実行時に $contact.byUid 等が解決可能に。
      const sourceBindings = (source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings;
      event.queue(
        state,
        resolvedEffect,
        { player: card.player, uid: card.uid, cardId: card.cardId },
        hookName,
        payload,
        sourceBindings,
        // BUG-132 GAP-2: effect:declared のみ batch 連番 + 反応マーカーを entry に付与
        declaredBatch !== undefined
          ? {
              declaredBatch,
              ...(isDeclaredReaction ? { declaredReaction: { abilityId: ability.id } } : {}),
            }
          : undefined,
      );
      // BUG-096: 発火を記録 (limit:{turn} のカウント。limit 無しは no-op)
      if (ability.limit?.kind === 'turn') {
        flag.incrDeclaredUseCount(state, card.uid, ability.id);
      }
    }
  }
}

// BUG-132 GAP-2: declaredReaction entry の遅延 pick substitute (stack.runOne から呼ばれる)。
// handleHook の queue 時 resolveEffectPicks と同じ contract を、解決時盤面に対して実行する。
// stack コアに AI import を持ち込まないため、listener 層から関数注入する (敵対レビュー反映)。
function resolveDeferredEntryPicks(state: GameState, entry: EffectStackEntry): Effect {
  const abilityId = entry.declaredReaction?.abilityId ?? '';
  const resolveCtx = {
    source: {
      cardId: entry.source.cardId ?? '',
      uid: entry.source.uid ?? '',
      abilityId,
      player: entry.source.player,
      // entryToCtx (stack.ts) と同じ近似。pick 解決に area は実質関与しない
      area: 'scene' as const,
    },
    bindings: {},
    triggerPayload: entry.triggeredBy.payload,
  };
  const humanSide = getHumanPlayerSide();
  const isHumanEffect = humanSide !== null && entry.source.player === humanSide;
  // handleHook と同じ lazy instantiate (module top では circular import 発生)
  const aiPolicy = new HeuristicPolicy();
  return resolveEffectPicks(state, entry.effect, resolveCtx, {
    chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
    byPlayer: entry.source.player,
    humanChooser: isHumanEffect,
    source: { cardId: entry.source.cardId ?? '', abilityId },
  });
}

let _registered = false;

export function _resetTriggeredRegistered(): void {
  _registered = false;
}

export function registerTriggeredListener(): void {
  if (_registered) return;
  _registered = true;
  // BUG-132 GAP-2: 遅延 pick resolver を stack へ注入 (登録は冪等)
  _setDeferredEntryPickResolver(resolveDeferredEntryPicks);
  for (const hook of TRIGGERED_HOOKS) {
    if (hook === 'evidence:remove-by-action') {
      // 2026-05-27 Option C: ヒラメキ統合経路。in-play scan ではなく payload の cardId から
      // 直接 def を引いて ability を探す (evidence area の card は collectCardsInPlay に出ない)。
      event.on(hook, (state, payload, source) => {
        handleEvidenceRemovedHook(state, payload, source);
      });
      continue;
    }
    if (hook === 'leave:to-remove') {
      // engine-extension #1: 現場リムーブ時 (rules/17)。
      //  - 離場したカード自身の【現場リムーブ時】: scene から消えた後なので source から
      //    virtual location を組み立てて処理 (handleLeaveToRemoveSelf)
      //  - 在場カードの「キャラがリムーブされたとき」反応: 通常 in-play scan (handleHook)
      event.on(hook, (state, payload, source) => {
        handleLeaveToRemoveSelf(state, payload, source);
        handleHook('leave:to-remove', state, payload, source);
      });
      continue;
    }
    event.on(hook, (state, payload, source) => {
      handleHook(hook, state, payload, source);
    });
  }
}

/**
 * 2026-05-27 Option C: ヒラメキ用 hook。
 * payload = { player, ev: { cardId } } (player はリムーブされた側 = ヒラメキ発動権利者)。
 * - in-play scan ではなく payload.ev.cardId から CardDef を取得
 * - virtual CardLocation を組み立てて scope/matcher/condition チェック
 * - trigger.optional=true なら pendingHirameki に push (UI が fire/skip)
 * - trigger.optional=false なら従来の triggered と同じく強制発動 (effect queue)
 */
function handleEvidenceRemovedHook(state: GameState, payload: unknown, source: unknown): void {
  const p = payload as { player?: 'self' | 'opp'; ev?: { cardId?: string } } | undefined;
  if (!p || !p.player || !p.ev || !p.ev.cardId) return;
  // B06049 cluster8 (2026-06-15): アクション[事件] を行った側が「相手の【ヒラメキ】は発動しない」を
  // セットしている場合 (turnState[証拠を失う側].hiramekiSuppressed)、optional/forced 両経路の
  // ヒラメキ発火をここで抑止する (action-scoped、action-end で清掃)。rules/10。
  if (state.turnState[p.player]?.hiramekiSuppressed) return;
  const def = readDef.card(p.ev.cardId);
  if (!def) return;
  const card: CardLocation = {
    player: p.player,
    uid: `evidence:${p.player}`,
    cardId: p.ev.cardId,
    area: 'evidence',
  };
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'evidence:remove-by-action') continue;
    if (!scopeAllowsArea(ability.scope, card.area)) continue;
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    const baseCtx = {
      source: {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        player: card.player,
        area: card.area,
      },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    if (trig.optional) {
      // ヒラメキ semantics: fire/skip 選択を UI に委譲
      // (旧 hirameki.ts listener と同等の動作)
      pushPendingHirameki({
        player: card.player,
        cardId: card.cardId,
        abilityId: ability.id,
      });
      return; // 1 イベントで複数 optional は想定せず、最初の 1 件のみ
    }

    // 強制発動 (rules/15 §必須効果) — 通常 triggered と同じ経路
    const humanSide = getHumanPlayerSide();
    const isHumanEffect = humanSide !== null && card.player === humanSide;
    const aiPolicy = new HeuristicPolicy();
    const resolvedEffect = resolveEffectPicks(state, ability.effect, baseCtx, {
      chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
      byPlayer: card.player,
      humanChooser: isHumanEffect,
      source: { cardId: card.cardId, abilityId: ability.id },
    });
    // ヒラメキ用に source.bindings も伝達 (今後 $evidence.* 等を使うカードを想定)
    const sourceBindings = (source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings;
    event.queue(
      state,
      resolvedEffect,
      { player: card.player, uid: card.uid, cardId: card.cardId },
      'evidence:remove-by-action',
      payload,
      sourceBindings,
    );
  }
}

/**
 * engine-extension #1: 離場したキャラ自身の【現場リムーブ時】用 handler (rules/17)。
 * source = { player, uid, cardId } (リムーブされたキャラ), payload = { uid, cause }。
 * 離場後は collectCardsInPlay に出ないため source から virtual CardLocation を組み立て、
 * その def の trigger.hook='leave:to-remove' ability を scope/selfOnly/matcher/condition で
 * フィルタし effect を queue する (通常 triggered と同経路)。在場カードの反応は handleHook 側。
 */
function handleLeaveToRemoveSelf(state: GameState, payload: unknown, source: unknown): void {
  const s = source as { player?: Player; uid?: string; cardId?: string } | undefined;
  if (!s || !s.player || !s.uid || !s.cardId) return;
  const def = readDef.card(s.cardId);
  if (!def) return;
  const card: CardLocation = {
    player: s.player,
    uid: s.uid,
    cardId: s.cardId,
    area: 'scene', // 現場にいた → on-scene scope を通す (rules/17)
  };
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'leave:to-remove') continue;
    if (!scopeAllowsArea(ability.scope, card.area)) continue;
    if (trig.selfOnly && !selfOnlyMatches(card, payload, source)) continue;
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    const baseCtx = {
      source: {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        player: card.player,
        area: card.area,
      },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    const humanSide = getHumanPlayerSide();
    const isHumanEffect = humanSide !== null && card.player === humanSide;
    const aiPolicy = new HeuristicPolicy();
    const resolvedEffect = resolveEffectPicks(state, ability.effect, baseCtx, {
      chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
      byPlayer: card.player,
      humanChooser: isHumanEffect,
      source: { cardId: card.cardId, abilityId: ability.id },
    });
    const sourceBindings = (source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings;
    event.queue(
      state,
      resolvedEffect,
      { player: card.player, uid: card.uid, cardId: card.cardId },
      'leave:to-remove',
      payload,
      sourceBindings,
    );
  }
}
