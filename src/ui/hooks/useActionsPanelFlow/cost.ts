// useActionsPanelFlow/cost.ts — Phase 3d 分割 (cost-builder / label helpers, body 無改変移送, 2026-06-22)
import type { Cost, Effect, EffectCtx } from '@/engine/types';


/**
 * BUG-108: choice effect option を人間可読ラベルに変換 (ChoicePicker 表示用)。
 * D11012 a1: charModifyLP(delta:1)→「LP＋1」/ charModifyAP(delta:2000)→「AP＋2000」。
 * 未知 verb は verb 名 fallback (modal が無効になるより表示できる方を優先)。
 */
export function choiceOptionLabel(opt: Effect): string {
  if (opt.kind !== 'atom') return opt.kind;
  const args = (opt.args ?? {}) as { delta?: unknown };
  const delta = typeof args.delta === 'number' ? args.delta : null;
  const sign = delta !== null && delta >= 0 ? `＋${delta}` : delta !== null ? `${delta}` : '';
  switch (opt.verb) {
    case 'charModifyLP': return `LP${sign}`;
    case 'charModifyAP': return `AP${sign}`;
    default:             return String(opt.verb);
  }
}

/**
 * Phase 8.8c: cost を人間可読なテキストに変換 (confirm modal body 表示用)。
 */
export function costToText(cost: Cost): string {
  switch (cost.kind) {
    case 'sleepSelf':         return 'このキャラをスリープ';
    case 'sleepChar':         return 'キャラ 1 枚をスリープ';
    case 'stunChar':          return 'キャラ 1 枚をスタン'; // engine additive wave (2026-06-24)
    case 'removeFromHand':    return `手札 ${cost.n} 枚をリムーブ`;
    case 'revealFromHand':    return `手札から ${cost.n} 枚を公開`; // engine additive wave (2026-06-28)
    case 'revealHandToDeckTop': return `手札から ${cost.n} 枚を公開してデッキの上へ`; // engine mega-wave W1 (2026-07-03)
    case 'removeFromScene':   return `現場 ${cost.n} 枚をリムーブ`;
    case 'removeDeckTop':     return `デッキ上 ${cost.n} 枚をリムーブ`;
    case 'discardEvidence':   return `証拠 ${cost.n} 枚をリムーブ`;
    case 'selfToDeckBottom':  return 'このキャラをデッキの下へ';
    case 'sceneToDeckBottom': return `現場のキャラ ${cost.n} 枚をデッキの下へ`; // Task D E2
    case 'removeAreaToDeckBottom': return `リムーブエリアの ${cost.n} 枚をデッキの下へ`; // cluster4 (2026-06-14)
    case 'removeSetCard':     return `裏向きセットされたカードを ${cost.n} 枚リムーブ`; // engine additive wave (2026-06-24)
    case 'pay':               return cost.items.map(costToText).join(' + ');
    case 'choice':            return cost.items.map(costToText).join(' / ');
    case 'fileFrom':          return `FILE から ${cost.n} 枚`;
    case 'flipFaceUpEvidence':
      // 2026-05-30 user_request: max が Infinity (上限なし) のとき "Infinity" 表示を回避。
      return Number.isFinite(cost.n.max)
        ? `証拠 ${cost.n.min}〜${cost.n.max} 枚を表向きに`
        : `証拠 ${cost.n.min} 枚以上を表向きに`;
    case 'custom':            return '(独自コスト)';
    // refactor 2b: case 追加漏れの compile-time 検出 (noImplicitReturns 無効のため明示 guard)。到達不能。
    default: {
      const _exhaustive: never = cost;
      void _exhaustive;
      return '';
    }
  }
}

/**
 * 2026-05-30 BUG-085: cost の中から flipFaceUpEvidence (〚裏向きの証拠を表向きに〛)
 * を探す。pay (複合) / choice (択一) でネストしていても再帰で最初の 1 件を返す。
 * 現状のカード (D08026 / D11021 / D08005) は top-level だが、将来のネストにも備える。
 */
type FlipFaceUpCost = Extract<Cost, { kind: 'flipFaceUpEvidence' }>;
export function findFlipFaceUpCost(cost: Cost | undefined): FlipFaceUpCost | null {
  if (!cost) return null;
  if (cost.kind === 'flipFaceUpEvidence') return cost;
  if (cost.kind === 'pay' || cost.kind === 'choice') {
    for (const item of cost.items) {
      const found = findFlipFaceUpCost(item);
      if (found) return found;
    }
  }
  return null;
}

/**
 * EffectCtx を能力 cost.pay / canPay 用に構築。
 */
export function makeAbilityCtx(opts: {
  player: Player;
  uid: string;
  cardId: string;
  abilityId: string;
  area: 'scene' | 'partner-area' | 'case';
}): EffectCtx {
  return {
    source: {
      cardId: opts.cardId,
      uid: opts.uid,
      abilityId: opts.abilityId,
      player: opts.player,
      area: opts.area,
    },
    bindings: {},
  };
}

export type Player = 'self' | 'opp';

