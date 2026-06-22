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
      //   「イベントを使用する」効果 verb は engine に未実装 (どのカードも生成しない) → ゲート不要。
      // rules: 25 (公式 Q&A) / 12 (ネクストヒント) / 06 (イベント使い切り)
      const seubP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[seubP].eventUseBanned = true;
      mutate.log.append(s, { ts: Date.now(), player: seubP, turn: s.turn.number, action: 'effect:setEventUseBan' });
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
