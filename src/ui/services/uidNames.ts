// UID → 表示名解決ユーティリティ (Round 2 で新設)
//
// 役割: engine の uid (例: 'partner:self' / scene character の uid) を
//   人間可読なカード名 (rules/19 §複数名カード の primary name) に変換する。
//
// 背景 (Round 2 修正):
//   ConfirmModal の body 等で raw uid (例: "partner:self で推理します。") が直接
//   表示されていた。useActionsPanelFlow.ts の 5 箇所
//   (reasoning / partnerAbility / declaredAbility / action / handUse) で同種の
//   問題があったため、共通ヘルパに集約して再発を構造的に防ぐ。
//
// 利用先:
//   - useActionsPanelFlow.ts (各 ConfirmModal body)
//   - 将来追加される picker/modal の display label にも適用可能

import type { GameState } from '@/engine/types/game-state.js';
import { def as readDef } from '@/engine/read/def.js';

/**
 * uid → 表示名 (CardDef.names[0]) を取得する。
 *
 * - 'partner:self' / 'partner:opp' → state.players[player].partner.cardId 経由で名前取得
 * - scene character uid → state.players[*].scene の uid 一致で cardId 取得
 * - 未解決 (def 未登録 / scene に存在しない) → uid を fallback として返す
 *
 * @example
 *   uidToDisplayName(state, 'partner:self') // → '江戸川コナン'
 *   uidToDisplayName(state, 'scene-3') // → '吉田歩美'
 *   uidToDisplayName(state, 'unknown-uid') // → 'unknown-uid' (fallback)
 */
export function uidToDisplayName(state: GameState, uid: string): string {
  // partner uid pattern (rules/03 §パートナーエリア)
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const player = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[player].partner.cardId;
    if (cardId) {
      const d = readDef.card(cardId);
      if (d && d.names.length > 0) return d.names[0];
    }
    // partner 未配置 (= cardId 空) の場合は uid を fallback
    return uid;
  }

  // M3 PA batch (2026-07-10, rules/18): PA 常駐 MR sentinel ('partnerMR:self'/'partnerMR:opp')。
  if (uid === 'partnerMR:self' || uid === 'partnerMR:opp') {
    const player = uid === 'partnerMR:self' ? 'self' : 'opp';
    const cardId = state.players[player].partnerAreaMR?.cardId;
    if (cardId) {
      const d = readDef.card(cardId);
      if (d && d.names.length > 0) return d.names[0];
      return cardId;
    }
    return uid;
  }

  // 2026-05-30 user_request: 事件カードの宣言能力 source uid ('case:self'/'case:opp')。
  // 旧実装は未対応で raw "case:self" が confirm body に表示されていた。
  if (uid === 'case:self' || uid === 'case:opp') {
    const player = uid === 'case:self' ? 'self' : 'opp';
    const cardId = state.players[player].case.cardId;
    if (cardId) {
      const d = readDef.card(cardId);
      if (d && d.names.length > 0) return d.names[0];
    }
    return uid;
  }

  // scene character uid: 両プレイヤーの scene から探索
  const handSource = /^hand:(self|opp):(\d+)$/.exec(uid);
  if (handSource) {
    const player = handSource[1] as 'self' | 'opp';
    const cardId = state.players[player].hand[Number(handSource[2])];
    if (cardId) return cardIdToDisplayName(cardId);
    return uid;
  }

  const areaSource = /^(evidence|file):(self|opp):(\d+)$/.exec(uid);
  if (areaSource) {
    const [, area, playerText, indexText] = areaSource;
    const player = playerText as 'self' | 'opp';
    const index = Number(indexText);
    const cardId = area === 'evidence'
      ? state.players[player].evidence[index]?.faceUp
        ? state.players[player].evidence[index]!.cardId
        : null
      : state.players[player].file[index]?.type === 'card-back' && state.players[player].file[index]!.faceUp === true
        ? state.players[player].file[index]!.cardId
        : null;
    if (cardId) {
      const d = readDef.card(cardId);
      if (d && d.names.length > 0) return d.names[0];
      return cardId;
    }
    return uid;
  }

  for (const player of ['self', 'opp'] as const) {
    const c = state.players[player].scene.find((sc) => sc.uid === uid);
    if (c) {
      const d = readDef.card(c.cardId);
      if (d && d.names.length > 0) return d.names[0];
      // def 登録されていない場合は cardId を fallback (uid より情報多い)
      return c.cardId;
    }
  }

  // 未解決
  return uid;
}

/**
 * cardId → 表示名 (CardDef.names[0])。手札カード等の cardId 表示に使う。
 *
 * uidToDisplayName と分けている理由: 手札の cardId は scene にないため uid 探索が無駄。
 * cardId 直接 lookup で済む高速版。
 */
export function cardIdToDisplayName(cardId: string): string {
  const d = readDef.card(cardId);
  if (d && d.names.length > 0) return d.names[0];
  return cardId;
}

export type PublicEffectSourceRef = {
  uid?: string;
  cardId?: string;
  setCardId?: string;
  setCardInstanceId?: string;
};

export type EffectSourceDisplayContext = {
  gameState?: GameState | null;
  siblingSources?: readonly PublicEffectSourceRef[];
};

function sameOfficialPrinting(leftId: string, rightId: string): boolean {
  const left = readDef.card(leftId);
  const right = readDef.card(rightId);
  if (!left || !right) return false;
  return left.no.split('/')[0] === right.no.split('/')[0]
    && left.names[0] === right.names[0];
}

function printingVariantLabel(cardId: string): string | undefined {
  const isParallel = cardId.endsWith('P');
  const counterpartId = isParallel ? cardId.slice(0, -1) : `${cardId}P`;
  if (!sameOfficialPrinting(cardId, counterpartId)) return undefined;
  return isParallel ? 'パラレル版' : '通常版';
}

function setCardOccurrenceIds(
  source: PublicEffectSourceRef,
  context: EffectSourceDisplayContext,
): string[] {
  if (!source.setCardId || !source.setCardInstanceId) return [];
  const refs: PublicEffectSourceRef[] = [...(context.siblingSources ?? [])];
  const state = context.gameState;
  if (state) {
    for (const player of ['self', 'opp'] as const) {
      const host = state.players[player].scene.find(card => card.uid === source.uid);
      if (host) {
        refs.push(...host.setCards.map(entry => ({
          setCardId: entry.cardId,
          setCardInstanceId: entry.instanceId,
        })));
      }
    }
    refs.push(...state.pendingEffects
      .filter(entry => entry.state === 'pending' || entry.state === 'resolving')
      .map(entry => entry.source));
  }
  refs.push(source);
  return [...new Set(refs
    .filter(ref => ref.setCardId === source.setCardId && typeof ref.setCardInstanceId === 'string')
    .map(ref => ref.setCardInstanceId!))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

/** Public source label for host-owned abilities granted by one physical set card. */
export function effectSourceDisplayName(
  source: PublicEffectSourceRef,
  context: EffectSourceDisplayContext = {},
): string {
  const displayCardId = source.setCardId ?? source.cardId;
  if (!displayCardId) return '効果';
  const name = cardIdToDisplayName(displayCardId);
  if (!source.setCardId || !source.setCardInstanceId) return name;

  const details: string[] = [];
  const variant = printingVariantLabel(source.setCardId);
  if (variant) details.push(variant);
  const occurrences = setCardOccurrenceIds(source, context);
  if (occurrences.length >= 2) {
    const index = occurrences.indexOf(source.setCardInstanceId);
    if (index >= 0) details.push(`${index + 1}枚目`);
  }
  return details.length > 0 ? `${name}（${details.join('・')}）` : name;
}

/** Gives repeated public cards an assistive-technology-only ordinal, never an internal id. */
export function publicCardOccurrenceLabel(cardIds: readonly string[], cardId: string, index: number): string | undefined {
  if (cardIds.filter((id) => id === cardId).length < 2) return undefined;
  return `${cardIds.slice(0, index + 1).filter((id) => id === cardId).length}枚目`;
}

/**
 * cardId (内部 engine ID, 例: "D08022") → 公式印刷番号 (例: "0091")。
 *
 * Round 2 改修: ユーザは内部 ID ("D08022") を見ても直感的にカード画像と紐付けられない。
 * 公式印刷番号 (CardDef.no の先頭セグメント) を表示することで、画像下部の "D-08/0091"
 * 表記と視覚的に対応する。
 *
 * 仕様:
 *   - CardDef.no は "0091/D08022" / "P001/D08001" 形式 (印刷番号 / 内部 ID)
 *   - 先頭セグメントが公式印刷番号
 *   - 該当 def なし or no 未設定の場合は cardId をそのまま返す
 */
export function cardIdToPrintedNumber(cardId: string): string {
  const d = readDef.card(cardId);
  if (d && d.no) {
    const seg = d.no.split('/')[0];
    if (seg) return seg;
  }
  return cardId;
}
