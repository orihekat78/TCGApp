// useActionsPanelFlow/cost.ts — Phase 3d 分割 (cost-builder / label helpers, body 無改変移送, 2026-06-22)
import type { Cost, Effect, EffectCtx, GameState } from '@/engine/types';
import { resolveDynNumber } from '@/engine/dyn/eval.js';
import { findDeclareNameSpec } from '@/engine/effect/declared-name-domain.js';


/**
 * BUG-108: choice effect option を人間可読ラベルに変換 (ChoicePicker 表示用)。
 * D11012 a1: charModifyLP(delta:1)→「LP＋1」/ charModifyAP(delta:2000)→「AP＋2000」。
 * 未知 verb は verb 名 fallback (modal が無効になるより表示できる方を優先)。
 */
export function choiceOptionLabel(opt: Effect): string {
  if (opt.kind !== 'atom') return opt.kind;
  const args = (opt.args ?? {}) as { delta?: unknown; n?: unknown };
  const delta = typeof args.delta === 'number' ? args.delta : null;
  const sign = delta !== null && delta >= 0 ? `＋${delta}` : delta !== null ? `${delta}` : '';
  switch (opt.verb) {
    case 'charModifyLP': return `LP${sign}`;
    case 'charModifyAP': return `AP${sign}`;
    // B05097「上から5枚までリムーブする（枚数を決めてからリムーブ）」= mill n 択一。n が number のときのみラベル化。
    case 'mill':         return typeof args.n === 'number' ? `デッキ上 ${args.n} 枚をリムーブ` : String(opt.verb);
    default:             return String(opt.verb);
  }
}

/**
 * Phase 8.8c: cost を人間可読なテキストに変換 (confirm modal body 表示用)。
 */
// mega-wave W5 (2026-07-03, r37): resolve (state+ctx) を渡すと removeDeckTop の {dyn} n を実数表示。
// optional param = 既存呼出は無変更で後方互換。未渡し時は汎用フォールバック文言 (誤数値を出さない安全側)。
export function costToText(cost: Cost, resolve?: { state: GameState; ctx: EffectCtx }): string {
  switch (cost.kind) {
    case 'sleepSelf':         return 'このキャラをスリープ';
    case 'sleepChar':         return 'キャラ 1 枚をスリープ';
    case 'stunChar':          return 'キャラ 1 枚をスタン'; // engine additive wave (2026-06-24)
    case 'removeFromHand':    return `手札 ${cost.n} 枚をリムーブ`;
    case 'revealFromHand': // engine additive wave (2026-06-28)。n:{min,max} は attribution mini-wave (2026-07-10, B08068 好きな枚数)
      if (typeof cost.n === 'number') return `手札から ${cost.n} 枚を公開`;
      return cost.n.min === 0 ? `手札から好きな枚数を公開` : `手札から ${cost.n.min}〜${cost.n.max} 枚を公開`;
    case 'revealHandToDeckTop': return `手札から ${cost.n} 枚を公開してデッキの上へ`; // engine mega-wave W1 (2026-07-03)
    case 'removeFromScene':   return `現場 ${cost.n} 枚をリムーブ`;
    case 'removeDeckTop': {
      if (typeof cost.n === 'number') return `デッキ上 ${cost.n} 枚をリムーブ`;
      // {dyn} n (B04088「相手の現場のキャラ1枚につき2枚」): resolve があれば実数、無ければ汎用文言。
      if (resolve) return `デッキ上 ${resolveDynNumber(cost.n, resolve.state, resolve.ctx)} 枚をリムーブ`;
      return 'デッキ上のカードをリムーブ (枚数は盤面で決まる)';
    }
    case 'removeDeckAll':     return 'デッキのカードをすべてリムーブ'; // engine A3 wave (2026-07-11, B09107)
    case 'discardEvidence':   return `証拠 ${cost.n} 枚をリムーブ`;
    case 'selfLpDeltaTurn':   return `ターン終了時までこのキャラをLP${cost.delta}`; // M2後半 (2026-07-10, B06003)
    case 'removeFromHandDownTo': return `手札が ${cost.n} 枚になるまでリムーブ`; // M2後半 (2026-07-10, B08047)
    case 'selfToDeckBottom':  return 'このキャラをデッキの下へ';
    case 'sceneToDeckBottom': return `現場のキャラ ${cost.n} 枚をデッキの下へ`; // Task D E2
    case 'removeAreaToDeckBottom': return `リムーブエリアの ${cost.n} 枚をデッキの下へ`; // cluster4 (2026-06-14)
    case 'partnerAreaRemove': return `パートナーエリアのカード ${cost.n} 枚をリムーブ`; // engine defer-unlock mini-wave (2026-07-09, B07039)
    case 'removeSetCard':     return cost.anyFace ? `セットされているカードを ${cost.n} 枚リムーブ` : `裏向きセットされたカードを ${cost.n} 枚リムーブ`; // engine additive wave (2026-06-24) / anyFace 夜間W0 (B05052)
    case 'sceneStackUnderSelf': return `現場のキャラ ${cost.n} 枚をこのキャラの下に重ねる`; // engine mega-wave W4 r6 (B09048)
    case 'handStackUnder':    return '手札のカード1枚を公開して現場のキャラの下に重ねる'; // engine mega-wave W4 r7 (B08006)
    case 'removeStackedCards': return `Remove ${cost.n} cards stacked under this character`;
    case 'pay':               return cost.items.map(i => costToText(i, resolve)).join(' + ');
    case 'choice':            return cost.items.map(i => costToText(i, resolve)).join(' / ');
    case 'fileFrom':          return `FILE から ${cost.n} 枚`;
    case 'flipFaceUpEvidence':
      // 2026-05-30 user_request: max が Infinity (上限なし) のとき "Infinity" 表示を回避。
      return Number.isFinite(cost.n.max)
        ? `証拠 ${cost.n.min}〜${cost.n.max} 枚を表向きに`
        : `証拠 ${cost.n.min} 枚以上を表向きに`;
    case 'custom':            return '(独自コスト)';
    // refactor 2b: case 追加漏れの compile-time 検出 (noImplicitReturns 無効のため明示 guard)。到達不能。
    case 'selfToRemove':      return 'このカードをリムーブエリアに移す';
    case 'selfToPartnerArea': return 'このカードをパートナーエリアに移す';
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

type RemoveStackedCardsCost = Extract<Cost, { kind: 'removeStackedCards' }>;
type RemoveFromHandCost = Extract<Cost, { kind: 'removeFromHand' }>;
export function findRemoveStackedCardsCost(cost: Cost | undefined): RemoveStackedCardsCost | null {
  if (!cost) return null;
  if (cost.kind === 'removeStackedCards') return cost;
  if (cost.kind === 'pay' || cost.kind === 'choice') {
    for (const item of cost.items) {
      const found = findRemoveStackedCardsCost(item);
      if (found) return found;
    }
  }
  return null;
}

/** Return the remove-from-hand item on the already selected cost-choice path. */
export function findRemoveFromHandCost(
  cost: Cost | undefined,
  choicePath?: ChoicePath,
): RemoveFromHandCost | null {
  const choices = normalizedChoicePath(choicePath);
  let cursor = 0;
  const visit = (node: Cost): RemoveFromHandCost | null => {
    if (node.kind === 'removeFromHand') return node;
    if (node.kind === 'pay') {
      for (const item of node.items) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (node.kind !== 'choice') return null;
    const selected = choices?.[cursor++];
    return selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < node.items.length
      ? visit(node.items[selected]!)
      : null;
  };
  return cost ? visit(cost) : null;
}

type RemoveSetCardCost = Extract<Cost, { kind: 'removeSetCard' }>;
type CharacterStateCost = Extract<Cost, { kind: 'sleepChar' | 'stunChar' }>;
type ChoiceCost = Extract<Cost, { kind: 'choice' }>;
type ChoicePath = readonly number[] | number | undefined;

function normalizedChoicePath(path: ChoicePath): readonly number[] | undefined {
  return typeof path === 'number' ? [path] : path;
}

/** Return the sleep/stun item on the already selected cost-choice path. */
export function findCharacterStateCost(
  cost: Cost | undefined,
  choicePath?: ChoicePath,
): CharacterStateCost | null {
  const choices = normalizedChoicePath(choicePath);
  let cursor = 0;
  const visit = (node: Cost): CharacterStateCost | null => {
    if (node.kind === 'sleepChar' || node.kind === 'stunChar') return node;
    if (node.kind === 'pay') {
      for (const item of node.items) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (node.kind !== 'choice') return null;
    const selected = choices?.[cursor++];
    return selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < node.items.length
      ? visit(node.items[selected]!)
      : null;
  };
  return cost ? visit(cost) : null;
}

/** Return the next unresolved choice on the exact engine payment path. */
export function findChoiceCostAtPath(cost: Cost | undefined, path: ChoicePath): ChoiceCost | null {
  const choices = normalizedChoicePath(path) ?? [];
  let cursor = 0;
  const visit = (node: Cost): ChoiceCost | null => {
    if (node.kind === 'pay') {
      for (const item of node.items) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (node.kind !== 'choice') return null;
    const selected = choices[cursor++];
    if (selected === undefined) return node;
    return Number.isInteger(selected) && selected >= 0 && selected < node.items.length
      ? visit(node.items[selected]!)
      : null;
  };
  return cost ? visit(cost) : null;
}

/** Enumerate complete engine-order choice paths extending a selected prefix. */
export function completeCostChoicePaths(cost: Cost | undefined, prefix: readonly number[]): number[][] {
  if (!cost) return [];
  type State = { path: number[]; cursor: number };
  const visit = (node: Cost, states: State[]): State[] => {
    if (node.kind === 'pay') return node.items.reduce((current, item) => visit(item, current), states);
    if (node.kind !== 'choice') return states;
    return states.flatMap((state) => {
      const requested = prefix[state.cursor];
      const indices = requested === undefined ? node.items.map((_item, index) => index) : [requested];
      return indices.flatMap((index) => Number.isInteger(index) && index >= 0 && index < node.items.length
        ? visit(node.items[index]!, [{ path: [...state.path, index], cursor: state.cursor + 1 }])
        : []);
    });
  };
  return visit(cost, [{ path: [], cursor: 0 }]).map((state) => state.path);
}

/** choice branch 決定後の実支払経路から removeSetCard を探す。 */
export function findRemoveSetCardCost(
  cost: Cost | undefined,
  choicePath?: ChoicePath,
): RemoveSetCardCost | null {
  const choices = normalizedChoicePath(choicePath);
  let cursor = 0;
  const visit = (node: Cost): RemoveSetCardCost | null => {
    if (node.kind === 'removeSetCard') return node;
    if (node.kind === 'pay') {
      for (const item of node.items) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (node.kind !== 'choice') return null;
    const selected = choices?.[cursor++];
    return selected !== undefined && Number.isInteger(selected) && selected >= 0 && selected < node.items.length
      ? visit(node.items[selected]!)
      : null;
  };
  return cost ? visit(cost) : null;
}

/**
 * 夜間 W0 (2026-07-11, B09027): cost の中から choice (「AかBをリムーブする」択一コスト) を探す。
 * engine cost.pay は ctx.dyn.costChoice (readChosenIndex) 未供給時 first-payable auto-select に
 * 落ちるため、human 経路は dispatch 前に branch index を選んで costParams.costChoice へ積む。
 * pay (複合) ネストにも備え再帰 (findFlipFaceUpCost と同姿勢)。choice の入れ子は現カード非存在。
 */
export function findChoiceCost(cost: Cost | undefined): ChoiceCost | null {
  return findChoiceCostAtPath(cost, []);
}

/**
 * CARD PHASE step12 batch2 (2026-07-04): effect ツリーから declareName atom (「カード名を1つ指定し」
 * B09108/B09003/PR105) を探す。runDeclaredAbilityFlow が dispatch **前** に DeclareCardNameModal で
 * 宣言名を集め costParams.declaredName へ積むための検出器 (atom は効果解決中に ctx.dyn を読むのみで
 * pause しない = 事前供給が唯一のチャネル、engine W6 step1 の設計)。
 * optional = args.optional === true (「してもよい」句、modal に skip を出す)。カードは高々 1 atom 前提
 * (現 consumer 全 3 枚) — 最初の 1 件を返す。
 */
export function findDeclareNameAtom(
  effect: Effect | undefined,
): ReturnType<typeof findDeclareNameSpec> {
  return findDeclareNameSpec(effect);
}

/**
 * EffectCtx を能力 cost.pay / canPay 用に構築。
 */
export function makeAbilityCtx(opts: {
  player: Player;
  uid: string;
  cardId: string;
  abilityId: string;
  area: 'scene' | 'partner-area' | 'case' | 'hand' | 'evidence' | 'file';
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

