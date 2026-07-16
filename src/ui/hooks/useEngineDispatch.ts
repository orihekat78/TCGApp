// Phase 8 Task 8.1: UI → engine action ディスパッチ基盤
//
// rules: 05-turn-phases.md (メインフェイズ), 11-reasoning.md, 12-next-hint.md,
//        21-declared-ability-cost.md
//
// 設計:
//   - 骨格 (engine) は変更しない。本ファイルは UI 層の seam として
//     engine.flow.* (canX + 実行関数) を呼び分け、結果を Zustand store に反映する。
//   - engine actions は in-place mutator (void 戻り) のため、Immer の `produce` で
//     wrap して Zustand に新参照を渡す。これにより構造的共有 + change detection が両立。
//   - 各 action 種別ごとに canX 判定を hook 層でも前段ガードし、UI で
//     friendly な DispatchResult を返す (engine の throw は engine-error として包む)。

import { produce } from 'immer';
import * as flow from '@/engine/flow/index.js';
import { mutate } from '@/engine/mutate/index.js';
import { runAllUntilEmpty } from '@/engine/resolve/index.js';
import { applyChooseInterceptResponse, applyDeckReorderAndContinuation, applyPickAndContinuation, applyPickSkipAndContinuation, applyChoiceAndContinuation, applyOptionalAndContinuation, applyRepeatOptionalAndContinuation, applyRpsAndContinuation, applySetCardChoiceAndContinuation, applySetCardReplacement } from '@/engine/effect/apply-pick.js';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks.js';
import { useGameStateStore } from '@/ui/state/store.js';
import type { GameState } from '@/engine/types/game-state.js';
import type { EffectCtx } from '@/engine/types';
import { resolveActionAgainstChar, resolveActionAgainstCase } from '@/ai/action-resolution.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import { event as engineEvent } from '@/engine/event/index.js';
import { def as readDef } from '@/engine/read/def.js';
// Round 4j-fix (BUG-034): `@/engine` 経由で取得し vite dev mode の module duplication 回避
import { _drainPendingHirameki, _drainPendingMisread, _peekPendingHirameki, _markPendingHiramekiGainDeferred } from '@/engine';
import { _drainPendingEffectPickSide, _peekPendingEffectPickSide, _drainPendingEffectChoiceSide, _drainPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { _drainPendingChooseInterceptSide, _drainPendingEffectRepeatOptionalSide, _drainPendingRpsSide, _drainPendingSetCardChoiceSide, _drainPendingSetCardReplacementSide } from '@/engine/effect/pending-state.js';
import { _drainPendingDeckRevealSide, _drainPendingDeckReorderSide, _drainPendingDeckPlaceSide, _drainPendingContactStartAxId } from '@/engine/effect/atom-handlers';
import { isAllowed } from './useEngineDispatch/can-check.js';
import { _resumeDeferredReasoning } from '@/engine/flow/main/reasoning.js';
import { _resolveMisreadPicks } from '@/engine/listeners/misread.js';
import type { EngineAction, DispatchResult, Player } from './useEngineDispatch/types.js';
// Phase 3d: public 型 (ContactChoice/EngineAction/DispatchResult) は types.ts を barrel 再 export し importer 不変。
export type { ContactChoice, EngineAction, DispatchResult } from './useEngineDispatch/types.js';

/**
 * Phase 8 完全クローズ Commit 2: actionDeclareChar/Case 直後に
 * `flow.action.declare()` が返した ActionContext.id を runEngineAction から
 * dispatchEngineAction へ伝える側チャネル (produce 境界を越えるため必要)。
 * 各 dispatch 開始時に null リセット → declare 時にセット → produce 完了後に
 * dispatchEngineAction が store.setActiveActionId へ転送して null に戻す。
 */
let _justDeclaredAxId: string | null = null;

// BUG-109: resolveCardIdFromPickUid + pick build/continuation 実行は engine の
// apply-pick.ts (applyPickAndContinuation) へ移設し human/AI で共有 (重複排除)。


// ---- engine 呼出 (draft 上で in-place mutation) ----

function runEngineAction(draft: GameState, action: EngineAction): void {
  switch (action.type) {
    case 'reasoning':
      flow.doReasoning(draft, action.uid);
      return;
    case 'handUseCard':
      flow.handUseCard(draft, action.player, action.cardId);
      return;
    case 'handUseCardSwitch':
      // rules/20 §スイッチ: engine.flow.handUseCard の 5 番目引数 switchRemoveUid を渡す
      flow.handUseCard(draft, action.player, action.cardId, undefined, action.removeUid);
      return;
    case 'nextHint':
      flow.runNextHint(draft, action.player, action.optionalCardId);
      return;
    case 'partnerAbility':
      // Phase 2c (BUG-116 構造解消): cost+ctx 構築 + pay は engine 側 helper に一元化
      // (旧: action.cost && action.ctx が両方渡されたときのみ pay → 渡し忘れで silent skip)。
      flow.activatePartnerAbility(draft, action.player, action.abilId, action.costParams);
      return;
    case 'declaredAbility':
      // BUG-085 の costPaid/dyn 伝播は activateDeclaredAbility 内で維持される。
      flow.activateDeclaredAbility(draft, action.uid, action.abilId, action.costParams);
      return;
    case 'assist':
      // flow.assist 未提供のため mutate を直叩き (src/ai/policy.ts:117 と同じ)
      mutate.partner.assist(draft, action.player);
      return;
    case 'solveCase':
      // flow.solveCase 未提供のため mutate を直叩き (src/ai/policy.ts:126 と同じ)
      mutate.partner.solveCase(draft, action.player);
      return;
    case 'actionAgainstChar': {
      // Phase 8.7c: ガード判定を HeuristicPolicy に委譲。共通ヘルパで policy.applyMove と
      // 同一シーケンスを共有 (将来カットイン/変装追加時もここを 1 箇所変更で OK)。
      resolveActionAgainstChar(draft, action.byUid, action.targetUid, new HeuristicPolicy());
      return;
    }
    case 'actionAgainstCase':
      // BUG-144 follow-up: この bundled 経路は **hirameki demo** (App.tsx: opp→self の case アクションで
      // evidence 除去→相手[=self]の【ヒラメキ】発火) と e2e 専用。ここで防御側を auto-guard すると evidence が
      // 除去されず demo / e2e が壊れる (8 hirameki spec 回帰) ため passGuard 固定のまま据え置く。
      // 実ゲームの防御ガード窓は別経路で対応済: ①人間/CPU の case アクションは per-step
      // (useActionsPanelFlow → actionDeclareCase) + useContactFlowDriver が guard-window を解決
      // (opp 防御側は HeuristicPolicy、self は GuardPickerModal)。②AI-vs-AI gameplay は policy.applyMove
      // (resolveActionAgainstCase に defenderPolicy を渡す) で解決 — BUG-144 本体はそちら。
      resolveActionAgainstCase(draft, action.byUid, action.targetPlayer);
      return;
    // Phase 8 完全クローズ Commit 2: per-step action dispatch
    case 'actionDeclareChar': {
      const ax = flow.action.declare(draft, action.byUid, { kind: 'char', uid: action.targetUid });
      _justDeclaredAxId = ax.id;
      return;
    }
    case 'actionDeclareCase': {
      const ax = flow.action.declare(draft, action.byUid, { kind: 'case', player: action.targetPlayer });
      _justDeclaredAxId = ax.id;
      return;
    }
    case 'actionGuard': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      if (action.guarderUid === null) {
        flow.action.passGuard(draft, ax);
      } else {
        flow.action.tryGuard(draft, ax, action.guarderUid);
      }
      return;
    }
    case 'actionContact': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      // first/second の actedフラグも更新 (advance() の redo 判定用)
      const actorUid =
        action.player === ax.byPlayer ? ax.byUid : (ax.guardUid ?? (ax.target.kind === 'char' ? ax.target.uid : ''));
      const isFirst = ax.firstUid === actorUid;
      if (action.choice.kind === 'cutin') {
        flow.contact.cutIn(draft, ax, action.player, action.choice.cardId);
        if (isFirst) ax.firstActed = true; else ax.secondActed = true;
      } else if (action.choice.kind === 'disguise') {
        flow.contact.disguise(draft, ax, action.player, action.choice.cardId);
        if (isFirst) ax.firstActed = true; else ax.secondActed = true;
      } else {
        flow.contact.pass(draft, ax, action.player);
        if (isFirst) ax.firstActed = false; else ax.secondActed = false;
      }
      return;
    }
    case 'actionAdvance': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      flow.action.advance(draft, ax);
      return;
    }
    case 'actionJudge': {
      const ax = flow.action._getContext(action.actionId);
      if (!ax) return;
      // user_request 20260522_01 #8 fix: case target でも guard 成立した場合は
      // 証拠変動なし — contact AP 判定で攻撃キャラ or ガードキャラのリムーブ
      // のみ行う (rules/07 + rules/10: 証拠操作は「ガードされなかった場合」のみ)。
      if (ax.target.kind === 'case' && !ax.guardUid) {
        // rules/10: 相手証拠リムーブ + 自証拠獲得 (unguarded のみ)
        flow.actionCase.removeOpponentEvidenceTop(draft, ax);
        // mega-wave W6 step7 (2026-07-04, row70): 直前の emit でヒラメキが queue された場合のみ
        // gain を defer する (fire/skip 決定後に hiramekiResolve が実行)。「相手はこのアクションに
        // よって証拠を得られない」ヒラメキ (B02088/B03126) が fire された場合に、既に走った gain を
        // 巻き戻せないため — Q&A: fire なら依存 trigger (evidence:gain) ごと不発が要件。
        // ヒラメキ無しの fast path は従来通り即時 gain (挙動不変)。
        if (_peekPendingHirameki()) {
          _markPendingHiramekiGainDeferred();
        } else {
          flow.actionCase.gainSelfEvidence(draft, ax);
        }
      } else {
        // char target OR case target + guard 成立 → contact AP 判定
        flow.action.snapshotAP(draft, ax);
        const result = flow.contact.judge(draft, ax);
        if (result.deferred && result.pendingLeaveIntercept) {
          useGameStateStore.getState().setPendingLeaveIntercept({ ...result.pendingLeaveIntercept, actionId: ax.id });
        }
      }
      return;
    }
    case 'leaveInterceptResolve': {
      const pending = useGameStateStore.getState().pendingLeaveIntercept;
      if (!pending) return;
      const ax = flow.action._getContext(pending.actionId);
      if (!ax?.apSnapshot) return;
      mutate.scene.resolveLeaveIntercept(draft, pending.targetUid, 'contact-ap', ax.apSnapshot.aUid, undefined, pending.interceptorUid, action.accept);
      flow.contact.judge(draft, ax);
      return;
    }
    case 'hiramekiResolve': {
      const pending = useGameStateStore.getState().pendingHirameki;
      if (!pending) return;
      if (action.choice === 'fire') {
        // ability の effect を pendingEffects に queue → runAllUntilEmpty で解決
        const def = readDef.card(pending.cardId);
        const ability = def?.abilities.find(
          (a: unknown) => a !== null && typeof a === 'object' && (a as { id?: string }).id === pending.abilityId,
        ) as { effect?: unknown } | undefined;
        if (ability?.effect) {
          // 2026-05-29 user_request: ヒラメキ発動をフロントログ + トーストに明示。
          // RecentActionToast は log 末尾を拾うため、この 1 行で「【ヒラメキ】発動」演出も出る。
          mutate.log.append(draft, {
            ts: Date.now(),
            player: pending.player,
            turn: draft.turn.number,
            action: 'hirameki:fire',
            target: pending.cardId,
          });
          // Phase 7-1 + 7-2 (BUG-035): hirameki effect 内の $pick atom を recursive utility で
          // substitute。Phase 7-1 の局所版 resolveHiramekiPick を resolveEffectPicks に retrofit。
          // Phase 7-3: chooseAtomTarget callback で verb 別ヒューリスティック選択
          // (D11009 sceneSetState stun → 敵 active 最高 AP 等)。
          // Human/AI 共通で適用 — UI 側 modal が出るときはこの dispatch 経路を通らないため実害なし。
          const ctx: EffectCtx = {
            // Human Pattern-A picks pause during this pre-walk, before the queued entry can
            // restore its source metadata. Keep the resolving-card lifecycle on the shared
            // continuation ctx so exact-exhaustion refresh still excludes this hirameki.
            source: { player: pending.player, cardId: pending.cardId, area: 'evidence', resolutionKind: 'hirameki' },
            bindings: pending.occurrence ? { occurrence: [{ kind: 'card' as const, cardId: pending.occurrence.cardId, area: 'remove', player: pending.occurrence.player, index: pending.occurrence.removeIndex }] } : {},
            // wave-11: pick 解決段でも $trigger.<field> を参照可能に (queue payload と同内容。
            // atom 実行時は entryToCtx の triggerPayload が使われるため両段で一致させる)
            triggerPayload: { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid, occurrence: pending.occurrence },
          };
          const aiPolicy = new HeuristicPolicy();
          // night-wC (2026-07-11, B06032/B09081): ヒラメキ所有者が human のとき humanChooser:true を渡し、
          // effect 内 top-level optional (「手札を1枚リムーブしてもよい。そうした場合〜」) を
          // pendingEffectOptional として surface する (EffectOptionalModalHost + optionalResolve が resume)。
          // 従来は humanChooser 不在で optional が常に AI-skip → 再生/スタン効果が無音 collapse していた
          // (declared-ability.ts の isHumanEffect パターンと対称)。owner が AI (or spectator=null) は従来どおり
          // heuristic 自動解決 (byte 不変)。
          const hiramekiHumanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
          const isHumanHirameki = hiramekiHumanSide !== null && pending.player === hiramekiHumanSide;
          const resolved = resolveEffectPicks(draft, ability.effect as never, ctx, {
            chooseAtomTarget: isHumanHirameki ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
            byPlayer: pending.player,
            humanChooser: isHumanHirameki,
            source: { cardId: pending.cardId, abilityId: pending.abilityId },
          });
          // engine wave-11 (2026-07-02): byUid = pendingHirameki.actorUid を trigger payload に
          // 復元 — 効果内 '$trigger.byUid' (「アクション中のキャラ」= アクション[事件] actor、公式Q&A B05111)
          // が atom 実行時 (entryToCtx の triggerPayload) に解決される。
          engineEvent.queue(
            draft,
            resolved as never,
            { player: pending.player, cardId: pending.cardId, resolutionKind: 'hirameki' },
            'evidence:remove-by-action',
            { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid, occurrence: pending.occurrence },
            ctx.bindings,
          );
        }
      }
      // mega-wave W6 step7 (2026-07-04, row70): actionJudge が defer した gain をここで実行。
      // fire の場合は queue 済のヒラメキ効果を先に解決する (runAllUntilEmpty) —
      // setEvidenceGainSuppress が gain より先に着地しないと抑止が効かない。
      // gainDeferred guard は load-bearing: bundled 経路 (actionAgainstCase → eager gain) 由来の
      // pendingHirameki では立たない → double-gain しない (row70 risks(2))。
      if ((pending as { gainDeferred?: boolean }).gainDeferred && pending.actorUid) {
        runAllUntilEmpty(draft);
        const gainSide: Player = pending.player === 'self' ? 'opp' : 'self';
        flow.actionCase.gainSelfEvidence(draft, { byPlayer: gainSide, byUid: pending.actorUid });
      }
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'misreadResolve': {
      const pending = useGameStateStore.getState().pendingMisread;
      if (!pending) return;
      _resolveMisreadPicks(draft, pending, action.picks);
      _resumeDeferredReasoning(draft, pending.reasoningUid, pending.reasoningPlayer);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'setEffectOrder': {
      // entry を直接 mutate (isAllowed で entry 存在 + owner 一致は確認済)
      const entry = draft.pendingEffects.find((e) => e.id === action.entryId);
      if (entry) entry.ownerChosenOrder = action.order;
      return;
    }
    case 'effectPickResolve': {
      // user_request 20260522_01 #2/#6 BUG-054 + BUG-065:
      // pendingEffectPick の atomArgs を pattern により置換して queue + run
      //   Pattern A (uid='$pick'): uid → picked、target → drop
      //   Pattern B (uid 不在):    target → [cardId of picked candidate]
      const pending = useGameStateStore.getState().pendingEffectPick;
      if (!pending) return;
      if (action.pickedUid === null) {
        if (pending.atomVerb === 'stackedCardPick' && pending.nMin > 0) {
          throw new Error('stackedCardPick: below-minimum selection');
        }
        // BUG-132 GAP-1: skipResolvesAtom 付き pending (deckRevealUntil chooseMatch) の decline は
        // 「0枚選択」を atom 解決として実行し、remainder (デッキ下移動等の必須 step) を続行する
        // (rules/15 「〜まで」=0枚可)。破棄してしまうと全 reveal がデッキ上に残る。
        if (pending.skipResolvesAtom === true) {
          applyPickSkipAndContinuation(draft, pending);
          return;
        }
        // BUG-111 #2 (2026-06-16) / family (nest, 2026-06-22): continuation があれば head の kind で gate しつつ
        //   実行する (applyPickSkipAndContinuation 内で分岐)。
        //   - sequence-origin head: 末尾 step (mandatory) を実行 (rules/15 sequence の各 step は独立。
        //     「〜してもよい」は「〜する」を gate しない) + outer。
        //   - chain-origin head: head.remainder は「そうした場合」gate で drop (rules/25) するが、外側 (outer)
        //     sequence の remainder (例 B06033 sceneEnter) は実行する (nest)。outer 無しの standalone chain は no-op。
        //   declined head atom は再実行しない (runDeclinedAtom=false): declined 0-pick=何もしない、head bind は
        //   unbound で後続 conditional が not-matched で正しく skip。choice/optional の末尾は runEffect 経路では
        //   human surface しない既知 gap (B09056 DEFER 根拠)。
        if ((pending as { continuation?: unknown }).continuation) {
          applyPickSkipAndContinuation(draft, pending, false);
          return;
        }
        // continuation 無しの任意効果 → 純粋 skip。
        // BUG-111: continuation は pending 本体に同梱されるため pending 破棄で対の continuation も drop。
        // クリアは produce 後の post-dispatch drain で行う (return のみ)
        return;
      }
      // BUG-109: resolved atom の build (Pattern A/B) + continuation (BUG-107 の保存 ctx 共有) は
      // engine 共通 helper applyPickAndContinuation に集約 (AI drain drainAiEffectPicks と同実体)。
      // resolveCardIdFromPickUid の state は draft (produce 内最新) を渡す。
      applyPickAndContinuation(
        draft,
        pending,
        action.pickedUid,
        'pickedUids' in action ? action.pickedUids : undefined,
        'switchRemoveUid' in action ? action.switchRemoveUid : undefined,
        'switchRemoveUids' in action ? action.switchRemoveUids : undefined,
      );
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'choiceResolve': {
      // BUG-121: pendingEffectChoice を choiceIndex で解決。元 effect を readDef から復元し
      // choiceIndex 付きで再 walk → 選択 option 内の $pick (option2 sceneToHand 等) は
      // __pendingEffectPickQueue へ再 push され既存 effectPickResolve 経路で連鎖消化される。
      const pendingC = useGameStateStore.getState().pendingEffectChoice;
      if (!pendingC) return;
      applyChoiceAndContinuation(draft, pendingC, action.choiceIndex);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'optionalResolve': {
      // 2026-06-06 タスクC: pendingEffectOptional を run(boolean) で解決。run=true なら内部 effect を
      // 再 walk して実行 (内部 $pick は __pendingEffectPickQueue へ再 push)、run=false なら skip。
      const pendingO = useGameStateStore.getState().pendingEffectOptional;
      if (!pendingO) return;
      applyOptionalAndContinuation(draft, pendingO, action.run);
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'rpsResolve': {
      const pending = useGameStateStore.getState().pendingRps;
      if (!pending) return;
      applyRpsAndContinuation(draft, pending, action.hand);
      return;
    }
    case 'setCardChoiceResolve': {
      const pending = useGameStateStore.getState().pendingSetCardChoice;
      if (!pending) return;
      applySetCardChoiceAndContinuation(draft, pending, action.instanceId);
      return;
    }
    case 'setCardReplacementResolve': {
      const pending = useGameStateStore.getState().pendingSetCardReplacement;
      if (!pending) return;
      applySetCardReplacement(draft, pending, action.targetUid);
      return;
    }
    case 'chooseInterceptResolve': {
      const pending = useGameStateStore.getState().pendingChooseIntercept;
      if (!pending) return;
      applyChooseInterceptResponse(draft, pending, action.discardIndex);
      return;
    }
    case 'repeatOptionalResolve': {
      const pending = useGameStateStore.getState().pendingEffectRepeatOptional;
      if (!pending) return;
      applyRepeatOptionalAndContinuation(draft, pending, action.run);
      return;
    }
    case 'deckReorderResolve': {
      const pendingR = useGameStateStore.getState().pendingDeckReorder;
      if (!pendingR) return;
      applyDeckReorderAndContinuation(draft, pendingR, action.order);
      return;
    }
    case 'deckPlaceResolve': {
      // mini-wave #5 P2: deckPlaceSplitBound (B05047「見た各カードを上か下へ」) の human 振り分け適用。
      // pending.cardIds はまだ deck 元位置に居る (atom は await のみ)。top∪bottom が pending.cardIds と
      // multiset 一致することを検証してから splice → mutate.deck.toTop/toBottom を各 1 回 bulk 適用
      // (「好きな順番で」= 各バケツ内の相対順も human 指定、bulk API なので順序保持)。不一致なら何もしない。
      const pendingP = useGameStateStore.getState().pendingDeckPlace;
      if (!pendingP) return;
      const deckP = draft.players[pendingP.player].deck;
      const combined = [...action.top, ...action.bottom];
      const tallyP = (xs: string[]): Map<string, number> => {
        const m = new Map<string, number>();
        for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
        return m;
      };
      if (combined.length !== pendingP.cardIds.length) return;
      const te = tallyP(pendingP.cardIds);
      const tc = tallyP(combined);
      if (te.size !== tc.size) return;
      for (const [k, v] of te) if (tc.get(k) !== v) return;
      // 検証 OK → deck から対象を splice (deckToBottomBound と同じ窓侵食防御: 実在分のみ) して振り分け
      const splicedP: string[] = [];
      for (const id of pendingP.cardIds) {
        const idx = deckP.indexOf(id);
        if (idx !== -1) { deckP.splice(idx, 1); splicedP.push(id); }
      }
      const inSpliced = tallyP(splicedP);
      const takeIf = (ids: string[]): string[] => ids.filter(id => {
        const c = inSpliced.get(id) ?? 0;
        if (c <= 0) return false;
        inSpliced.set(id, c - 1);
        return true;
      });
      mutate.deck.toTop(draft, pendingP.player, takeIf(action.top));
      mutate.deck.toBottom(draft, pendingP.player, takeIf(action.bottom));
      // クリアは produce 後に dispatchEngineAction が行う
      return;
    }
    case 'endTurn': {
      // Round 2 修正: 旧実装は endTurn のみで、次プレイヤーの startTurn を呼ばなかった。
      // 結果 (a) opp.turn 開始時に auto-phase 走らず、(b) opp.endTurn 後 self.turn でも
      // 同様 — 後攻 Human の auto-phase 欠落 + phase が 'end' のまま固定 → ターン終了
      // button 永続 disabled の root cause だった。次プレイヤーまで進めて phase='main'
      // に遷移させ、両プレイヤー対称な turn boundary を保証する。
      // (smoke harness src/ai/match.ts L106-112 と同等の遷移パターン)
      const nextPlayer: Player = action.player === 'self' ? 'opp' : 'self';
      flow.endTurn(draft, action.player);
      runAllUntilEmpty(draft);
      if (draft.gameResult) return;
      mutate.flag.resetTurnFlags(draft, nextPlayer);
      draft.turn.isFirstPlayerFirstTurn = false;
      flow.startTurn(draft, nextPlayer);
      runAllUntilEmpty(draft);
      return;
    }
    // refactor 3e: EngineAction の case 追加漏れを compile-time 検出 (noImplicitReturns 不在ゆえ
    // member 脱落が silent fall-through する)。24 個の discriminant tag を全網羅で現状到達不能。
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return;
    }
  }
}

// ---- public API ----

/**
 * BUG-090: dispatchEngineAction 以外で human(self) の effect を runAllUntilEmpty で
 * 解決する経路 (ターンドライバ等) 向けに、engine 側 globalThis 側チャネルへ積まれた
 * pending pick / hirameki / misread / deckReveal を Zustand store に転送する。
 *
 * 背景: human の auto-phase (driveOppTurn の flow.startTurn(self)+runAllUntilEmpty) で
 *   事件編→解決編 になり case card a1 (case:to-resolved → discard) が発火すると、
 *   discard pick が __pendingEffectPickQueue に積まれる。dispatchEngineAction は produce 後に
 *   各 side-channel を drain → store.set しているが、ターンドライバ側ではこの転送が無く
 *   pick が取り残されて EffectPickerModal が出ない (= 「何も起きない」) バグだった。
 *
 * dispatchEngineAction の post-produce 同期と異なり action 種別が無いため、
 * 「新規 pending があれば先頭を set」(非 null のみ) の共通動作のみ行う。
 * effectPickResolve 等の「queue 空なら null クリア」特殊処理は dispatchEngineAction 専用。
 */
export function surfacePendingSideChannels(): void {
  const store = useGameStateStore.getState();
  if (store.pendingHirameki === null) {
    const hiramekiSide = _drainPendingHirameki();
    if (hiramekiSide) store.setPendingHirameki(hiramekiSide);
  }
  if (store.pendingMisread === null) {
    const misreadSide = _drainPendingMisread();
    if (misreadSide) store.setPendingMisread(misreadSide);
  }
  // FIFO 先頭は、現在表示中の decision が決着するまで消費しない。
  // opp pending も順番を保って次の driver tick へ渡し、human pending を上書きしない。
  if (store.pendingEffectPick === null && _peekPendingEffectPickSide() !== null) {
    const effectPickSide = _drainPendingEffectPickSide();
    if (effectPickSide) store.setPendingEffectPick(effectPickSide);
  }
  // BUG-121: auto-phase enter 由来 choice の取り残し防止 (useOppTurnDriver 経路)
  if (store.pendingEffectChoice === null) {
    const effectChoiceSide = _drainPendingEffectChoiceSide();
    if (effectChoiceSide) store.setPendingEffectChoice(effectChoiceSide);
  }
  // 2026-06-06 タスクC: optional 決定の取り残し防止 (choice と同様)
  if (store.pendingEffectOptional === null) {
    const effectOptionalSide = _drainPendingEffectOptionalSide();
    if (effectOptionalSide) store.setPendingEffectOptional(effectOptionalSide);
  }
  if (store.pendingRps === null) {
    const rpsSide = _drainPendingRpsSide();
    if (rpsSide) store.setPendingRps(rpsSide);
  }
  if (store.pendingSetCardChoice === null) {
    const setCardChoiceSide = _drainPendingSetCardChoiceSide();
    if (setCardChoiceSide) store.setPendingSetCardChoice(setCardChoiceSide);
  }
  if (store.pendingSetCardReplacement === null) {
    const setCardReplacementSide = _drainPendingSetCardReplacementSide();
    if (setCardReplacementSide) store.setPendingSetCardReplacement(setCardReplacementSide);
  }
  if (store.pendingChooseIntercept === null) {
    const chooseInterceptSide = _drainPendingChooseInterceptSide();
    if (chooseInterceptSide) store.setPendingChooseIntercept(chooseInterceptSide);
  }
  if (store.pendingEffectRepeatOptional === null) {
    const repeatOptionalSide = _drainPendingEffectRepeatOptionalSide();
    if (repeatOptionalSide) store.setPendingEffectRepeatOptional(repeatOptionalSide);
  }
  if (store.pendingDeckReveal === null) {
    const deckRevealSide = _drainPendingDeckRevealSide();
    if (deckRevealSide) store.setPendingDeckReveal(deckRevealSide);
  }
  // BUG-136: deckToBottomBound 順序選択の取り残し防止 (auto-phase / ターンドライバ経路)
  if (store.pendingDeckReorder === null) {
    const deckReorderSide = _drainPendingDeckReorderSide();
    if (deckReorderSide) store.setPendingDeckReorder(deckReorderSide);
  }
  // mini-wave #5 P2: deckPlaceSplitBound 振り分けの取り残し防止 (同経路)
  if (store.pendingDeckPlace === null) {
    const deckPlaceSide = _drainPendingDeckPlaceSide();
    if (deckPlaceSide) store.setPendingDeckPlace(deckPlaceSide);
  }
}

/**
 * Pure dispatcher. React の外からも (テスト等) 呼べる。
 *
 *   const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
 *   if (!result.ok) showError(result.reason);
 *
 * - gameState === null  → { ok:false, reason:'no-state' }
 * - canX === false       → { ok:false, reason:'not-allowed' }
 * - engine が throw      → { ok:false, reason:'engine-error', detail }
 * - 成功時                → store の gameState を Immer 経由で新参照に更新し { ok:true }
 */
export function dispatchEngineAction(action: EngineAction): DispatchResult {
  const store = useGameStateStore.getState();
  const current = store.gameState;
  if (current === null) return { ok: false, reason: 'no-state' };
  if (!isAllowed(current, action)) return { ok: false, reason: 'not-allowed' };

  _justDeclaredAxId = null;
  try {
    store.dispatch((state) =>
      produce(state, (draft) => {
        runEngineAction(draft, action);
        // Phase 5 listener が pendingEffects に積んだ effect を解決する。
        // AI orchestrator (src/ai/policy.ts) と同じ運用パターン。
        runAllUntilEmpty(draft);
      }),
    );
    // Commit 2: declareChar/Case 直後は ActionContext.id を store.activeActionId にセット
    if (_justDeclaredAxId) {
      store.setActiveActionId(_justDeclaredAxId);
      _justDeclaredAxId = null;
    }
    // mega-wave W6 step9 (row65): 効果内 startContact が生成した ax を driver に渡す。
    // _justDeclaredAxId と違い「どの EngineAction type から呼ばれたか」を問わない汎用 drain
    // (宣言能力起動・カットイン解決・chain 内 startContact も同じ穴を通る) — effect 内から
    // 新規 ActionContext が生まれる唯一の合流点。useContactFlowDriver は activeActionId →
    // _getContext → phase 汎用処理なので無改造で 'action-1' 以降を駆動できる。
    const contactStartAxId = _drainPendingContactStartAxId();
    if (contactStartAxId) {
      store.setActiveActionId(contactStartAxId);
    }
    // Commit 3a: evidence:remove-by-action listener が側チャネルにセットしていれば
    // Zustand pendingHirameki に転送。
    const hiramekiSide = _drainPendingHirameki();
    if (hiramekiSide) {
      store.setPendingHirameki(hiramekiSide);
    }
    // hiramekiResolve dispatch 後は pendingHirameki をクリア
    if (action.type === 'hiramekiResolve') {
      store.setPendingHirameki(null);
    }
    // Commit 3b: reasoning:before-add listener が human defender ケースで側チャネル set した分
    const misreadSide = _drainPendingMisread();
    if (misreadSide) {
      store.setPendingMisread(misreadSide);
    }
    if (action.type === 'misreadResolve') {
      store.setPendingMisread(null);
    }
    // user_request 20260522_01 #2/#6 BUG-054: human player による effect 対象選択
    // BUG-078 fix: queue 化対応。effectPickResolve 時は「次の pending を drain して set」
    // (queue が空なら null)。他 action では「新規 pending があれば先頭を set」。
    const effectPickSide = _drainPendingEffectPickSide();
    if (action.type === 'effectPickResolve') {
      // resolve で current pending を消化したので次の queue 先頭を反映 (or 空なら null)
      store.setPendingEffectPick(effectPickSide);
    } else if (effectPickSide) {
      store.setPendingEffectPick(effectPickSide);
    }
    // BUG-121: human 複数 option choice の side-channel drain (effectPickSide と同 clear セマンティクス)
    const effectChoiceSide = _drainPendingEffectChoiceSide();
    if (action.type === 'choiceResolve') {
      // resolve で current pending choice を消化 → 次の choice (通常 null) を反映
      store.setPendingEffectChoice(effectChoiceSide);
    } else if (effectChoiceSide) {
      store.setPendingEffectChoice(effectChoiceSide);
    }
    // 2026-06-06 タスクC: optional 決定の side-channel drain (choice と同 clear セマンティクス)
    const effectOptionalSide = _drainPendingEffectOptionalSide();
    if (action.type === 'optionalResolve') {
      // resolve で current pending optional を消化 → 次 (通常 null) を反映
      store.setPendingEffectOptional(effectOptionalSide);
    } else if (effectOptionalSide) {
      store.setPendingEffectOptional(effectOptionalSide);
    }
    const rpsSide = _drainPendingRpsSide();
    if (action.type === 'rpsResolve') {
      store.setPendingRps(rpsSide);
    } else if (rpsSide) {
      store.setPendingRps(rpsSide);
    }
    const setCardChoiceSide = _drainPendingSetCardChoiceSide();
    if (action.type === 'setCardChoiceResolve') {
      store.setPendingSetCardChoice(setCardChoiceSide);
    } else if (setCardChoiceSide) {
      store.setPendingSetCardChoice(setCardChoiceSide);
    }
    const setCardReplacementSide = _drainPendingSetCardReplacementSide();
    if (action.type === 'setCardReplacementResolve') {
      store.setPendingSetCardReplacement(setCardReplacementSide);
    } else if (setCardReplacementSide) {
      store.setPendingSetCardReplacement(setCardReplacementSide);
    }
    const chooseInterceptSide = _drainPendingChooseInterceptSide();
    if (action.type === 'chooseInterceptResolve') {
      store.setPendingChooseIntercept(chooseInterceptSide);
    } else if (chooseInterceptSide) {
      store.setPendingChooseIntercept(chooseInterceptSide);
    }
    if (action.type === 'leaveInterceptResolve') {
      store.setPendingLeaveIntercept(null);
    }
    const repeatOptionalSide = _drainPendingEffectRepeatOptionalSide();
    if (action.type === 'repeatOptionalResolve') {
      store.setPendingEffectRepeatOptional(repeatOptionalSide);
    } else if (repeatOptionalSide) {
      store.setPendingEffectRepeatOptional(repeatOptionalSide);
    }
    // user_request 20260522_01 #12 BUG-061: deckRevealUntil 演出側チャネル drain
    const deckRevealSide = _drainPendingDeckRevealSide();
    if (deckRevealSide) {
      store.setPendingDeckReveal(deckRevealSide);
    }
    // BUG-136: deckToBottomBound 順序選択チャネル drain。deckReorderResolve は解決で消化 → 次 (通常 null)。
    const deckReorderSide = _drainPendingDeckReorderSide();
    if (action.type === 'deckReorderResolve') {
      store.setPendingDeckReorder(deckReorderSide);
    } else if (deckReorderSide) {
      store.setPendingDeckReorder(deckReorderSide);
    }
    // mini-wave #5 P2: deckPlaceSplitBound 振り分けチャネル drain (deckReorder と同 clear セマンティクス)。
    const deckPlaceSide = _drainPendingDeckPlaceSide();
    if (action.type === 'deckPlaceResolve') {
      store.setPendingDeckPlace(deckPlaceSide);
    } else if (deckPlaceSide) {
      store.setPendingDeckPlace(deckPlaceSide);
    }
    return { ok: true };
  } catch (e) {
    _justDeclaredAxId = null;
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: 'engine-error', detail };
  }
}

/**
 * React hook 形ラッパ。UI component から
 *   const { dispatch } = useEngineDispatch();
 * で利用する。`dispatchEngineAction` は module-level の安定参照なので
 * useCallback は不要。
 */
export function useEngineDispatch(): { dispatch: typeof dispatchEngineAction } {
  return { dispatch: dispatchEngineAction };
}
