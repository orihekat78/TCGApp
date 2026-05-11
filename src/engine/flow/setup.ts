// engine.flow.setup — ゲーム開始フロー (init / 先攻決定 / 開始手札 / マリガン / 公開 / Game Start)
// spec: .claude/specs/engine-api-flow-setup.md
// rules: 02-deck-construction.md (40枚・最大3枚), 04-game-setup.md (マリガン), 01-victory-conditions.md (先攻7/後攻6)
//
// 注意 (骨格凍結):
//   - partner.init / case.init は engine.mutate に追加 (foundational engine extension)
//   - PlayerState.mulliganUsed フィールドを追加 (engine infrastructure)
//   - これらはカード効果のための骨格修正ではなく、Phase 4 ゲームフロー駆動のための基礎追加
//
// 注意 (RNG):
//   - decideFirstPlayer の 'random' は engine.rng があれば使用するが、
//     現状 engine.rng はモジュール (createRng) として独立し、グローバル singleton はない。
//     Math.random で実装し、再現性が必要な場合は外部から seed 制御する設計を Phase 5 で導入予定。
//     TODO: 再現性確保のため engine.rng singleton 化検討。

import type { GameState, CardId, CardDef } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { def as readDef } from '../read/def.js';

type Player = 'self' | 'opp';

export type Deck = {
  partnerId: string;
  caseId: string;
  mainCards: CardId[]; // 40 cards (rules/02)
};

export type DeckPair = {
  self: Deck;
  opp: Deck;
};

const OPENING_HAND_SIZE = 5;
const MAIN_DECK_SIZE = 40;
const MAX_SAME_ID = 3;

/**
 * デッキ構築の検証 (rules/02)
 *   - main 40枚 (== MAIN_DECK_SIZE)
 *   - 同IDカード ≤ 3枚
 *   - partnerId / caseId が指定されている
 */
function validateDeck(deck: Deck, side: Player): void {
  if (!deck.partnerId) {
    throw new Error(`setup.init: ${side} partnerId missing`);
  }
  if (!deck.caseId) {
    throw new Error(`setup.init: ${side} caseId missing`);
  }
  if (deck.mainCards.length !== MAIN_DECK_SIZE) {
    throw new Error(
      `setup.init: ${side} main deck size must be ${MAIN_DECK_SIZE} (got ${deck.mainCards.length}) — rules/02`,
    );
  }
  // 同IDカード制限 (rules/02)
  const counts = new Map<string, number>();
  for (const id of deck.mainCards) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    if (n > MAX_SAME_ID) {
      throw new Error(
        `setup.init: ${side} contains ${n} copies of "${id}" — max ${MAX_SAME_ID} (rules/02)`,
      );
    }
  }
}

/**
 * 安全に colors を取得する (CardDef が未登録なら空配列)
 */
function colorsFor(cardId: string): string[] {
  const d: CardDef | undefined = readDef.card(cardId);
  return d?.colors ?? [];
}

/**
 * setup.init — 両プレイヤーのデッキ・パートナー・事件を裏向きで配置する。
 *
 * - パートナー: partner-area, active で配置 (まだ表向きにしない: reveal で公開)
 * - 事件: 事件エリアに status='事件編' で配置 (colors は CardDef から取得)
 * - main deck: mainCards をそのまま deck に格納 (シャッフルは Math.random で実施)
 *
 * 例外:
 *   - mainCards.length !== 40
 *   - 同IDカード > 3
 *   - partnerId / caseId が未指定
 */
export function init(state: GameState, decks: DeckPair): void {
  validateDeck(decks.self, 'self');
  validateDeck(decks.opp, 'opp');

  for (const p of ['self', 'opp'] as const) {
    const d = decks[p];
    // パートナー / 事件 / デッキ
    mutate.partner.init(state, p, d.partnerId);
    mutate.case.init(state, p, d.caseId, colorsFor(d.caseId));
    state.players[p].deck = [...d.mainCards];
    mutate.deck.shuffle(state, p);
  }
}

/**
 * setup.decideFirstPlayer — 先攻プレイヤーを決定する。
 *
 * - method='random': Math.random で 'self' か 'opp' を選択
 * - method='manual': chosen を採用 (chosen 必須)
 *
 * 副作用:
 *   - state.turn.player = first
 *   - state.turn.number = 1
 *   - state.turn.phase = 'auto'
 *   - state.turn.isFirstPlayerFirstTurn = true
 *   - requiredEvidence: 先攻=7, 後攻=6 (rules/01)
 */
export function decideFirstPlayer(
  state: GameState,
  method: 'random' | 'manual',
  chosen?: Player,
): Player {
  let first: Player;
  if (method === 'random') {
    first = Math.random() < 0.5 ? 'self' : 'opp';
  } else {
    if (!chosen) {
      throw new Error('setup.decideFirstPlayer: chosen required when method=manual');
    }
    first = chosen;
  }
  const second: Player = first === 'self' ? 'opp' : 'self';

  state.turn.player = first;
  state.turn.number = 1;
  state.turn.phase = 'auto';
  state.turn.isFirstPlayerFirstTurn = true;

  state.players[first].case.requiredEvidence = 7;
  state.players[second].case.requiredEvidence = 6;

  return first;
}

/**
 * setup.dealOpeningHand — デッキから 5枚ドローして手札にする (rules/04)
 * 戻り値: ドローしたカード ID
 */
export function dealOpeningHand(state: GameState, p: Player): CardId[] {
  // mutate.deck.draw 自体が手札に push してくれる
  return mutate.deck.draw(state, p, OPENING_HAND_SIZE);
}

/**
 * setup.canMulligan — 1ゲーム1回のみマリガン可 (rules/04)
 */
export function canMulligan(state: GameState, p: Player): boolean {
  return state.players[p].mulliganUsed !== true;
}

/**
 * setup.mulligan — 手札を指定枚数戻して引き直す (rules/04)
 *
 * - ids を手札からデッキ下へ戻す
 * - デッキシャッフル
 * - 同枚数を引き直す
 * - mulliganUsed=true
 *
 * idsToReturn が空配列でも canMulligan を消費する (1回の権利を使った扱い)。
 *
 * 戻り値: 引き直したカード ID
 */
export function mulligan(state: GameState, p: Player, idsToReturn: CardId[]): CardId[] {
  if (!canMulligan(state, p)) {
    throw new Error(`setup.mulligan: already used by ${p}`);
  }
  // 手札に該当 ID が存在するか検証
  const hand = state.players[p].hand;
  for (const id of idsToReturn) {
    if (!hand.includes(id)) {
      throw new Error(`setup.mulligan: card "${id}" not in ${p} hand`);
    }
  }
  // 戻す → シャッフル → 引き直す
  mutate.hand.toDeckBottom(state, p, idsToReturn);
  mutate.deck.shuffle(state, p);
  const drawn = mutate.deck.draw(state, p, idsToReturn.length);
  state.players[p].mulliganUsed = true;
  return drawn;
}

/**
 * setup.reveal — 事件 / パートナーを表向きにする (rules/04)
 *
 * 現状の GameState 設計には partner.faceUp / case.faceUp フィールドがない。
 * 物理的な向きは UI 側で扱う前提。Phase 4 では no-op + ログのみ。
 * 必要になった時点で GameState に faceUp フィールドを追加する。
 */
export function reveal(state: GameState): void {
  mutate.log.append(state, {
    ts: Date.now(),
    player: state.turn.player,
    turn: state.turn.number,
    action: 'setup.reveal',
    result: 'partner/case faceUp',
  });
}

/**
 * setup.startGame — Game Start! ログ出力 (rules/04)
 *
 * 実際のオートフェイズ実行は flow.runAutoPhase の責務。
 * startGame はゲーム開始の signaling のみ。
 */
export function startGame(state: GameState): void {
  mutate.log.append(state, {
    ts: Date.now(),
    player: state.turn.player,
    turn: state.turn.number,
    action: 'setup.startGame',
    result: 'Game Start!',
  });
}

export const setup = {
  init,
  decideFirstPlayer,
  dealOpeningHand,
  canMulligan,
  mulligan,
  reveal,
  startGame,
};
