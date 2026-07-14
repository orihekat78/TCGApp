// engine.mutate.deck — デッキ操作プリミティブ
// rules: 14-refresh.md, 26-qa-deck-refresh.md, 13-keywords.md (痕跡)
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, CardId, RefreshResult } from '@/engine/types';
import { log as logMut } from './log.js';
import { gameResult as gameResultMut } from './gameResult.js';
import { remove as removeMut } from './remove.js'; // engine additive wave-4: remove:exit emit (リフレッシュで remove→deck)
// engine mega-wave W2 (2026-07-03, P08/r25): refreshEvidence 抑止 aura の read。read→mutate 片方向 import
// (mutate/partner.ts→read/game・mutate/scene.ts→read/def と同流儀、cycle なし)。
import { char as readChar } from '../read/char.js';

type Player = 'self' | 'opp';
type OrderMode = 'given' | 'reverse';

/** デッキ上から n 枚を手札へ。デッキ不足時はリフレッシュ自動発火 (rules/14) */
function draw(s: GameState, p: Player, n: number, resolvingCardId?: CardId): CardId[] {
  const drawn: CardId[] = [];
  let remaining = n;

  while (remaining > 0) {
    const d = s.players[p].deck;
    if (d.length === 0) {
      // デッキ 0 枚 → リフレッシュ試行
      const result = refresh(s, p, resolvingCardId);
      if (!result.ok) {
        // BUG-036 fix (rules/04 + rules/14): リムーブ 0 枚なら refresh 失敗 →
        // そのプレイヤーは敗北、gameResult を deck-out で設定。
        // 既存実装は break のみで gameResult 未設定だった。
        // 既に gameResult が設定済 (= 既に勝敗確定) の場合は上書きしない。
        if (s.gameResult === undefined) {
          const winner: Player = p === 'self' ? 'opp' : 'self';
          gameResultMut.set(s, winner, 'deck-out');
        }
        // 引ける分だけ返す
        break;
      }
      // リフレッシュ後再試行
      if (s.players[p].deck.length === 0) break;
    }
    // 上から 1 枚引く
    const card = s.players[p].deck.shift()!;
    s.players[p].hand.push(card);
    drawn.push(card);
    remaining--;
  }

  return drawn;
}

/** デッキ上から n 枚を覗くだけ (デッキから取らない、リフレッシュ判定なし) rules/26 */
function peek(s: GameState, p: Player, n: number): CardId[] {
  const d = s.players[p].deck;
  return d.slice(0, Math.min(n, d.length));
}

/** デッキ上から n 枚を公開 (まだ deck 扱い) rules/26 */
function reveal(s: GameState, p: Player, n: number): CardId[] {
  const d = s.players[p].deck;
  return d.slice(0, Math.min(n, d.length));
}

/** 指定カードをデッキの下へ追加 (order='given': 配列順、'reverse': 逆順) */
function toBottom(s: GameState, p: Player, ids: CardId[], _order: OrderMode = 'given'): void {
  const ordered = _order === 'reverse' ? [...ids].reverse() : ids;
  s.players[p].deck.push(...ordered);
}

/** 指定カードをデッキの上へ追加 */
function toTop(s: GameState, p: Player, ids: CardId[], _order: OrderMode = 'given'): void {
  const ordered = _order === 'reverse' ? [...ids].reverse() : ids;
  s.players[p].deck.unshift(...ordered);
}

/** デッキ上から n 枚をリムーブエリアへ。不足時は可能な分のみ (rules/26) */
function removeFromTop(s: GameState, p: Player, n: number): CardId[] {
  const d = s.players[p].deck;
  const count = Math.min(n, d.length);
  const removed = d.splice(0, count);
  s.players[p].remove.push(...removed);
  return removed;
}

/** デッキをシャッフル (Fisher-Yates with Math.random) */
function shuffle(s: GameState, p: Player, rng?: () => number): void {
  const rand = rng ?? Math.random;
  const d = s.players[p].deck;
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = d[i];
    d[i] = d[j];
    d[j] = tmp;
  }
}

/**
 * リフレッシュ処理 (rules/14, 26)
 * - リムーブ → デッキシャッフル
 * - 相手 evidence +1 (refresh-penalty)
 * - 相手 scratchTrace = '発見済' (rules/13)
 * - リムーブ 0 枚敗北: ok:false 返す (gameResult は draw() 呼出元で
 *   `'deck-out'` reason で set される。BUG-036 fix 2026-05-22)
 */
function refresh(s: GameState, p: Player, resolvingCardId?: CardId): RefreshResult {
  const remove = s.players[p].remove;
  const preservedIndex = resolvingCardId === undefined ? -1 : remove.indexOf(resolvingCardId);
  const preserved = preservedIndex === -1 ? undefined : remove[preservedIndex];
  const refreshable = preservedIndex === -1
    ? remove
    : remove.filter((_, index) => index !== preservedIndex);
  if (refreshable.length === 0) {
    return {
      ok: false,
      loserPlayer: p,
      reason: 'remove-empty',
    };
  }

  const reshuffled = refreshable.length;
  // engine additive wave-4 (2026-07-01): 離脱カード snapshot (clear 前)。リフレッシュで remove→deck へ
  // 移ったカード毎に remove:exit を emit (rules/14、公式Q&A「シャッフルされデッキへ移った場合に発動」)。
  const exiting: CardId[] = [...refreshable];

  // リムーブ → デッキへ移動してシャッフル
  s.players[p].deck.push(...refreshable);
  s.players[p].remove = preserved === undefined ? [] : [preserved];
  shuffle(s, p);

  // engine additive wave-4: 離脱カード毎に remove:exit emit (移動完了後)。観測 = B05087/B05088 (在場キャラ)。
  // 既存カードは本 hook を宣言しないため queue 0 (= 挙動不変)。emit は handleHook を同期実行するが
  // pendingEffects へ queue するのみ (再帰なし)。evidence:removed と同パターン (mutate 内 emit)。
  for (const cardId of exiting) {
    removeMut.emitExit(s, p, cardId);
  }

  // refreshCount インクリメント
  s.refreshCount[p] = (s.refreshCount[p] ?? 0) + 1;

  // 相手 evidence +1 (rules/14)
  // engine mega-wave W2 (2026-07-03, P08/r25): refreshEvidence 抑止 aura —
  // 「相手はリフレッシュによって証拠を得られない」(B05097)。aura 所有者 = **リフレッシュ実行側 p**
  // (自分がリフレッシュした時に相手が得る penalty を消す = rules/14 の方向)。restrictsOpponent(s, p, ..)
  // の語義「p の盤面 aura が p の相手を制限」と一致。抑止は penalty push のみ — reshuffle / 痕跡 /
  // remove:exit / refreshCount は不変 (公式Q&A: 証拠獲得のみを消す、リフレッシュ自体は成立)。
  const opp: Player = p === 'self' ? 'opp' : 'self';
  if (!readChar.restrictsOpponent(s, p, 'refreshEvidence')) {
    s.players[opp].evidence.push({
      cardId: 'penalty-card',
      faceUp: false,
      origin: { turn: s.turn.number, via: 'refresh-penalty' },
    });
  }

  // 相手 scratchTrace = '発見済' (rules/13, 26)
  s.scratchTrace[opp] = '発見済';

  // Phase 8.10i: refresh を state.log に記録 (UI RefreshOverlay が拾う)
  logMut.append(s, {
    ts: Date.now(),
    player: p,
    turn: s.turn.number,
    action: 'refresh',
    result: String(reshuffled),
  });

  return {
    ok: true,
    reshuffled,
    opponentEvidenceGained: 1,
  };
}

export const deck = {
  draw,
  peek,
  reveal,
  toBottom,
  toTop,
  removeFromTop,
  shuffle,
  refresh,
};
