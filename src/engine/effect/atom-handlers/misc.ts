// engine.effect.atom-handlers/misc — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { action as flowAction } from '../../flow/action/state-machine.js'; // W6 step9 (row65): startContact 本実装 (effect→flow 初辺、循環なし)
import { resolvePlayer, resolveBindRef, _setPendingContactStartAxId } from './_shared.js';
import type { Player } from './_shared.js';
import type { GameState, EffectCtx, LogEntry, Effect, Condition } from '../../types/index.js';

export function atomPartnerAssist(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const paP = resolvePlayer(a.player, ctx);
      mutate.partner.assist(s, paP);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAssist' });
      return;
    }

export function atomPartnerSetState(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const psP = resolvePlayer(a.player, ctx);
      const psState = a.state as 'active' | 'sleep' | 'stun';
      // S1 wave (2026-07-11, B09105): requireActive (opt-in) — 「自分のパートナーをスリープさせ〜
      // してもよい。そうした場合〜」で、パートナーが既にアクティブでない場合は実行不成立 =
      // 後続 chain step を gate (公式Q&A B09105: パートナーがスリープ状態だと「すべて実行できない」
      // ため以降の効果を解決できない)。既存 consumer は未宣言 → byte 互換。
      if ((a as { requireActive?: boolean }).requireActive === true && s.players[psP].partner.state !== 'active') {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: psP, turn: s.turn.number, action: 'effect:partnerSetState', result: 'not-active-gate' });
        return;
      }
      mutate.partner.setState(s, psP, psState);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: psP, turn: s.turn.number, action: 'effect:partnerSetState', result: psState });
      return;
    }

export function atomPartnerSolveCase(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const scP = resolvePlayer(a.player, ctx);
      mutate.partner.solveCase(s, scP);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: scP, turn: s.turn.number, action: 'effect:partnerSolveCase' });
      return;
    }

export function atomOpponentLoses(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine E3 (2026-07-02): 「相手はゲームに敗北する」alt-lose 勝利ルート (P10/P53 family)。
      // winner = 効果所有者 (args.player、既定 self)。deck-out 系と同じ first-writer guard:
      // 既に gameResult があれば no-op (先着の決着を上書きしない、rules/15 即時解決)。
      const olP = resolvePlayer(a.player, ctx);
      if (s.gameResult === undefined) {
        mutate.gameResult.set(s, olP, 'alt-lose');
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: olP, turn: s.turn.number, action: 'effect:opponentLoses' });
      return;
    }

export function atomCaseToResolved(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const p = resolvePlayer(a.player, ctx);
      // BUG-089: case:to-resolved hook emit は mutate.case.toResolved に集約
      // (assist / FILE>=7 自動移行を含む全移行経路で発火させるため)。ここでの二重 emit は不要。
      mutate.case.toResolved(s, p);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:caseToResolved' });
      return;
    }

export function atomStartContact(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // mega-wave W6 step9 (2026-07-04, row65): 本実装 (旧 placeholder log stub)。
      //   B06020 佐々木小次郎 a2 / B06042 (付与宣言能力)「相手の現場にいるキャラを1枚まで選び、
      //   このキャラとのコンタクトを発生させる（このキャラがアクションした側のキャラになる）」。
      //   「このキャラ」= ability owner = ctx.source.uid (args 不要)。a.targetUid は pick chain の
      //   bind 参照 ('$target.uid' 等) or literal uid。
      // 0枚選択 (rules/15「1枚まで」) = bind 未解決 ($ 前置のまま返る) → no-op。
      //   対象不在/actor 不在 → startFromEffect が null → no-op (fail-closed)。
      // import 経路: effect/ → flow/ の辺は本 atom が初 (逆辺は flow/contact → effect/pending-state
      //   leaf のみ。直接循環なし — tsc/vitest で検証済)。
      // rules: 07/08 (コンタクト処理) / 22 (Q&A アクションではない) / 15 (0枚選択)
      const scByUid = ctx.source.uid;
      if (!scByUid) return;
      const scTarget = resolveBindRef(a.targetUid, ctx);
      if (typeof scTarget !== 'string' || scTarget.startsWith('$')) return; // 0枚選択 / 未解決 bind
      const scAx = flowAction.startFromEffect(s, scByUid, scTarget);
      if (!scAx) return;
      _setPendingContactStartAxId(scAx.id);
      const entry: LogEntry = {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'effect:startContact',
        target: scTarget,
        result: scAx.id,
      };
      mutate.log.append(s, entry);
      return;
    }

export function atomEndActionEarly(s: GameState, _a: Record<string, unknown>, ctx: EffectCtx): void {
      const entry: LogEntry = {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'endActionEarly:placeholder',
      };
      mutate.log.append(s, entry);
      return;
    }

export function atomSetEventUseBan(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // cluster6 (2026-06-14) B09034/B09034P「このターン中、自分はイベントを使用できない。
      //   （能力や効果によっても使用できない）」。turnState[p].eventUseBanned=true をセットする
      //   turn-scoped flag verb。player 省略時は所有者 (resolvePlayer 規約: 'self'=ctx.source.player)。
      // ゲート: hand-use-card.ts handUseGateCommon / next-hint.ts (いずれも d.kind==='event' のみ)。
      //   turn:start の mutate.flag.resetTurnFlags が false に戻す。
      // 公式 Q&A (rules/25): 【カットイン】【ヒラメキ】は本制限を受けない → contact.ts / hirameki は touch しない。
      //   「イベントを使用する」効果 verb = useEventFromHand (mega-wave W6 step3) — atom 側が
      //   turnState.eventUseBanned を防御的に再ゲートする (core.ts atomUseEventFromHand 冒頭)。
      // rules: 25 (公式 Q&A) / 12 (ネクストヒント) / 06 (イベント使い切り)
      const seubP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[seubP].eventUseBanned = true;
      mutate.log.append(s, { ts: Date.now(), player: seubP, turn: s.turn.number, action: 'effect:setEventUseBan' });
      return;
    }

export function atomSetShippuWaive(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // mega-wave W6 step4 (2026-07-04, B09090/P16) 「このターン中、次に自分の現場に登場したキャラは
      //   【疾風】の条件を無視できる。（2番目以降に登場しても発動する）」。turnState[p].shippuWaiveArmed=true
      //   をセットする turn-scoped flag verb (setNextHintBan mirror)。player 省略時は所有者。
      // 消費: listeners/triggered.ts handleHook の enter 前処理 (次登場 1 体、疾風有無不問 = 公式Q&A)。
      // 清掃: resetTurnFlags backstop + endTurn 両プレイヤー primary。
      // rules: 13/17 (疾風 = enter + enterOrderEquals) / 15 (「〜できる」)
      const sswP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[sswP].shippuWaiveArmed = true;
      mutate.log.append(s, { ts: Date.now(), player: sswP, turn: s.turn.number, action: 'effect:setShippuWaive' });
      return;
    }

export function atomSetNextHintBan(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // wave use-restrict (2026-06-30) B06104/P・B09019/P・B09105/P「このターン中、自分はネクストヒントできない」。
      //   turnState[p].nextHintBanned=true をセットする turn-scoped flag verb。player 省略時は所有者
      //   (resolvePlayer 規約: 'self'=ctx.source.player)。setEventUseBan を mirror。
      // ゲート: next-hint.ts canStartNextHint がネクストヒント全体 (step1 FILE→手札 含む) を不可にする。
      //   turn:start の mutate.flag.resetTurnFlags が false に戻す。手札の使用 (rules/05 01.) は別行動ゆえ阻害しない。
      // rules: 12 (ネクストヒント) / 15 (「〜できない」継続制限) / 05 (メインフェイズ行動)
      const snhbP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[snhbP].nextHintBanned = true;
      mutate.log.append(s, { ts: Date.now(), player: snhbP, turn: s.turn.number, action: 'effect:setNextHintBan' });
      return;
    }

export function atomSetUseEnterBanCardName(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const p = resolvePlayer(a.player ?? 'self', ctx);
  const name = a.cardName;
  if (typeof name !== 'string' || name === '') return;
  const names = s.turnState[p].useEnterBannedCardNames ?? (s.turnState[p].useEnterBannedCardNames = []);
  if (!names.includes(name)) names.push(name);
  mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:setUseEnterBanCardName', target: name });
}

export function atomSetCutinBan(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine additive wave-10 (2026-07-02) B07002 江戸川コナン a2「このターン中、相手は【カットイン】と
      //   【変装】を使用できない」の cutin 側。turnState[p].cutinBanned=true をセットする turn-scoped
      //   flag verb (setNextHintBan mirror)。B07002 は player:'opp' で呼ぶ (source 所有者から見た相手)。
      // ゲート: flow/contact.ts canCutIn。side-level flag ゆえ発動キャラ離場後も有効 (公式 Q&A B07002)。
      //   清掃: turn:start の mutate.flag.resetTurnFlags。
      // rules: 09 (カットイン) / 15 (「〜できない」継続制限) / 25 (公式 Q&A)
      const scbP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[scbP].cutinBanned = true;
      mutate.log.append(s, { ts: Date.now(), player: scbP, turn: s.turn.number, action: 'effect:setCutinBan' });
      return;
    }

export function atomSetActionCutinBanFilter(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine A3 wave (2026-07-11) B05007 妃英理 a2「このターン中、自分の現場にいる〚特徴［毛利探偵事務所］〛の
      //   キャラがアクションしたとき、アクション終了時まで相手は【カットイン】を使用できない」を arm する。
      //   turnState[p].actionCutinBanOppFilter = a.filter (armer 側 slot、既定 self)。
      //   canCutIn が現行アクションの actor (ax.byUid/byPlayer) を本 filter と live 照合して相手 cutin を封じる。
      //   清掃: turn:start の resetTurnFlags。setCutinBan (全面 ban) の filter 付き action-scoped 版。
      // rules: 07 (アクション) / 09 (カットイン) / 15 (継続制限) / 22・25 (公式 Q&A 発動タイミング)
      const acbP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[acbP].actionCutinBanOppFilter = (a.filter ?? {}) as GameState['turnState']['self']['actionCutinBanOppFilter'];
      mutate.log.append(s, { ts: Date.now(), player: acbP, turn: s.turn.number, action: 'effect:setActionCutinBanFilter' });
      return;
    }

export function atomSetDisguiseBan(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine additive wave-10 (2026-07-02) B07002 a2 の変装側。turnState[p].disguiseBanned=true。
      // ゲート: flow/contact.ts canDisguise。他は atomSetCutinBan と同一 (mirror)。
      // rules: 09 (変装) / 15 / 25
      const sdbP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[sdbP].disguiseBanned = true;
      mutate.log.append(s, { ts: Date.now(), player: sdbP, turn: s.turn.number, action: 'effect:setDisguiseBan' });
      return;
    }

export function atomSetHiramekiSuppress(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // cluster8 (2026-06-15) B06049 a2「このキャラがアクション[事件]したとき、アクション終了時まで
      //   相手の【ヒラメキ】は発動しない」。turnState[p].hiramekiSuppressed=true をセットする
      //   action-scoped flag verb。a2 は player:'opp' で呼ぶ (source=B06049 所有者 → 相手 = 証拠を失う側)。
      // ゲート: listeners/triggered.ts handleEvidenceRemovedHook が payload.player の本フラグを見て抑止。
      //   清掃: state-machine.ts contact-end→action-end で両プレイヤー分 false (主)、turn:start backstop。
      // rules: 10 (アクション[事件]/ヒラメキ) / 13 (キーワード) / 22 (アクション宣言時に発動)
      const shsP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[shsP].hiramekiSuppressed = true;
      mutate.log.append(s, { ts: Date.now(), player: shsP, turn: s.turn.number, action: 'effect:setHiramekiSuppress' });
      return;
    }

export function atomSetEvidenceGainSuppress(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // mega-wave W6 step7 (2026-07-04, row70) B02088/B03126 ヒラメキ「相手はこのアクションによって
      //   証拠を得られない」。turnState[p].evidenceGainSuppressed=true をセットする単発 flag verb
      //   (setHiramekiSuppress mirror)。カードは player:'opp' で呼ぶ (source=証拠を失った側 → 相手 =
      //   アクション[事件] actor 側)。
      // ゲート: flow/action-case.ts gainSelfEvidence が consume-on-read で単発消費 — 獲得も
      //   evidence:gain emit も行わない (依存 trigger 不発、公式Q&A)。清掃: resetTurnFlags backstop のみ
      //   (action-end はセット前に同期発火済ゆえ清掃サイトにならない — game-state.ts doc 参照)。
      // rules: 10 (アクション[事件]/ヒラメキ) / 14 (refresh とは独立) / 25 (公式 Q&A)
      const segP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[segP].evidenceGainSuppressed = true;
      mutate.log.append(s, { ts: Date.now(), player: segP, turn: s.turn.number, action: 'effect:setEvidenceGainSuppress' });
      return;
    }

// mega-wave W6 step8 (row75) 用の module-level id counter (event/registry.ts nextEntryId と同 posture)
let _reservedIdCounter = 0;

export function atomReserveEffect(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // mega-wave W6 step8 (2026-07-04, row75): 離場後予約。args.effect (nested Effect JSON) を
      //   GameState.reservedEffects へ積むだけの pure append (即時解決しない — setCutinBan 同 posture)。
      //   コストで源カードが盤面を離れる「ターン終了時〜」(B08069) /「このターン中、次に〜したとき」
      //   (B01058) が、in-play scan (triggered.ts) に依存せず後段発火できるようにする。
      // 発火: listeners/reserved-effects.ts (single-fire、armedTurn 同ターン限り)。
      //   失効: flow/turn.ts endTurn (next-match 未消費分)。
      // rules: 15 (未解決効果) / 21 (コストで自身離場) / 25 (同時発動)
      const reHook = a.hook as string | undefined;
      const reMode = a.mode as 'turn-end' | 'next-match' | undefined;
      const reEffect = a.effect as Effect | undefined;
      if (!reHook || (reMode !== 'turn-end' && reMode !== 'next-match') || !reEffect) return; // fail-closed
      if (!s.reservedEffects) s.reservedEffects = []; // 旧 state 防御 (W6 step6 turnEffects init と同型)
      _reservedIdCounter += 1;
      const reP = ctx.source.player as Player;
      s.reservedEffects.push({
        id: `re_${_reservedIdCounter}`,
        trigger: {
          hook: reHook,
          mode: reMode,
          player: reP,
          armedTurn: s.turn.number,
          ...(a.condition !== undefined ? { condition: a.condition as Condition } : {}),
        },
        effect: reEffect,
        source: {
          player: reP,
          ...(ctx.source.uid !== undefined ? { uid: ctx.source.uid } : {}),
          ...(ctx.source.cardId !== undefined ? { cardId: ctx.source.cardId } : {}),
        },
      });
      mutate.log.append(s, { ts: Date.now(), player: reP, turn: s.turn.number, action: 'effect:reserveEffect', target: reHook });
      return;
    }

export function atomLog(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const entry: LogEntry = {
        ts: (a.ts as number | undefined) ?? Date.now(),
        player: a.player !== undefined ? resolvePlayer(a.player, ctx) : (ctx.source.player as Player),
        turn: (a.turn as number | undefined) ?? s.turn.number,
        action: (a.action as string | undefined) ?? 'log',
        target: a.target as string | undefined,
        result: a.result as string | undefined,
      };
      mutate.log.append(s, entry);
      return;
    }

export function atomExpandActionTargets(s: GameState, _a: Record<string, unknown>, ctx: EffectCtx): void {
      // refactor 1b (2026-06-12): 旧実装は __pendingActionExpansion side-channel に push して
      // いたが消費者ゼロの dead code だった (Task D E4 grounding で grep 確認)。実際の対象拡張は
      // target-expander.ts applyPreTargetExpansion が **カード def の本 atom の args を静的 walk**
      // して読む (D11007/B01028/B05071) ため、verb 自体は declarative marker として必要。
      // handler は log のみの no-op とする (付与版は turnEffects.actionTargetsActive — Task D E4)。
      mutate.log.append(s, {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'effect:expandActionTargets',
        target: ctx.source.uid ?? '',
      });
      return;
    }

export function atomDeclareName(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine mega-wave W6 step1 (2026-07-04, rows 49/53/999 統合): プレイヤーが任意カード名を宣言し
      // ctx.declaredNames[a.bind] へ書く (「カード名を1つ指定し」)。供給チャネルは ctx.dyn.declaredName
      // (costChoice/choiceIndex と同じ dyn 経路、UI = AbilityCostParams.declaredName → costParamsToDyn)。
      // 未供給/空白のみ = 空文字 fallback + warn log (BUG-116 cost-not-paid warning と同型) —
      // 消費側 (boundNameMatchesDeclared / $declared.*.sceneNameCount) が false/0 に落ちるだけで throw しない
      // (AI 未対応・smoke 経路の defensive 契約)。状態変化なし (zone/char 不変)。
      const bindKey = a.bind as string;
      const raw = ctx.dyn?.['declaredName'];
      const name = typeof raw === 'string' ? raw.trim() : '';
      if (name === '') {
        mutate.log.append(s, {
          ts: Date.now(), player: ctx.source.player, turn: s.turn.number,
          action: 'effect:declareName:unsupplied', target: bindKey,
        });
      } else {
        mutate.log.append(s, {
          ts: Date.now(), player: ctx.source.player, turn: s.turn.number,
          action: 'effect:declareName', target: bindKey, result: name,
        });
      }
      (ctx.declaredNames ??= {})[bindKey] = name;
      return;
    }
