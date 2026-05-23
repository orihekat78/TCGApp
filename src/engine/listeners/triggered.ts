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
  'action:declare',
  'action:guarded',
  'contact:start',
  'case:to-resolved',
  'phase:end:start',
] as const;

type TriggeredHook = (typeof TRIGGERED_HOOKS)[number];

type CardLocation = {
  player: Player;
  uid: string;
  cardId: string;
  area: 'scene' | 'partner-area' | 'case' | 'hand';
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
  if (s === 'on-evidence') return false; // 証拠 card scan は別経路 (hirameki listener)
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
      event.queue(
        state,
        resolvedEffect,
        { player: card.player, uid: card.uid, cardId: card.cardId },
        hookName,
        payload,
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
    event.on(hook, (state, payload, source) => {
      handleHook(hook, state, payload, source);
    });
  }
}
