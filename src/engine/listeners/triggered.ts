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
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from '../effect/resolve-picks.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type { GameState, AbilityDef, AbilityScope } from '../types/index.js';
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

const TRIGGERED_HOOKS = [
  'enter',
  'effect:declared',
  'action:pre-target', // D11007 v2 Phase 3: attacker 選択時、target 列挙前
  'action:declare',
  'action:guarded',
  'contact:start',
  'case:to-resolved',
  'phase:end:start',
  // 2026-05-27 Option C: ヒラメキ統合。payload.ev.cardId の def から
  // trigger.hook='evidence:remove-by-action' の ability を探す (in-play scan 経路と別)。
  'evidence:remove-by-action',
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

function handleHook(
  hookName: TriggeredHook,
  state: GameState,
  payload: unknown,
  source: unknown,
): void {
  for (const card of collectCardsInPlay(state)) {
    const def = readDef.card(card.cardId);
    if (!def) continue;
    for (const ability of def.abilities as AbilityDef[]) {
      if (ability.type !== 'triggered') continue;
      const trig = ability.trigger;
      if (!trig || trig.hook !== hookName) continue;
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
      const resolvedEffect = resolveEffectPicks(state, ability.effect, resolveCtx, {
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
      );
    }
  }
}

let _registered = false;

export function _resetTriggeredRegistered(): void {
  _registered = false;
}

export function registerTriggeredListener(): void {
  if (_registered) return;
  _registered = true;
  for (const hook of TRIGGERED_HOOKS) {
    if (hook === 'evidence:remove-by-action') {
      // 2026-05-27 Option C: ヒラメキ統合経路。in-play scan ではなく payload の cardId から
      // 直接 def を引いて ability を探す (evidence area の card は collectCardsInPlay に出ない)。
      event.on(hook, (state, payload, source) => {
        handleEvidenceRemovedHook(state, payload, source);
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
