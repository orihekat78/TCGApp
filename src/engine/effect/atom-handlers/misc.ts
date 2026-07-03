// engine.effect.atom-handlers/misc — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { resolvePlayer } from './_shared.js';
import type { Player } from './_shared.js';
import type { GameState, EffectCtx, LogEntry } from '../../types/index.js';

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

export function atomStartContact(s: GameState, _a: Record<string, unknown>, ctx: EffectCtx): void {
      const entry: LogEntry = {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'startContact:placeholder',
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
