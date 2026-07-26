// engine.mutate.partner — パートナー操作プリミティブ
// rules: 01-victory-conditions.md, 13-keywords.md (アシスト・事件解決), 18-mr.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';
import { file as fileMutate } from './file.js';
import { caseOp } from './case.js';
import { remove as removeMut } from './remove.js'; // engine wave-12: remove:exit emit (remove→PA 離脱)
import { evidence as evidenceMut } from './evidence.js'; // engine E3 P10: 【証拠隠滅】override の証拠リムーブ
import { gameResult as gameResultMut } from './gameResult.js'; // engine E3 P10: alt-lose 決着 (無条件 set、旧 evidence 直代入と対称)
import { game as readGame } from '../read/game.js'; // engine E3 P10: partnerSolveOverride 走査 (read→mutate 片方向、cycle なし)

type Player = 'self' | 'opp';
type PartnerState = 'active' | 'sleep' | 'stun';
type PartnerLocation = 'partner-area' | 'file-area' | 'mr-removed';

/**
 * パートナーを初期配置する (Phase 4 setup, rules/04)
 * - cardId を設定
 * - state='active', location='partner-area'
 */
function init(s: GameState, p: Player, cardId: string): void {
  s.players[p].partner.cardId = cardId;
  s.players[p].partner.state = 'active';
  s.players[p].partner.location = 'partner-area';
}

/**
 * パートナーの状態を設定する (rules/03)
 */
function setState(s: GameState, p: Player, st: PartnerState): void {
  s.players[p].partner.state = st;
}

/**
 * パートナーの場所を設定する (MR能力等)
 */
function setLocation(s: GameState, p: Player, loc: PartnerLocation): void {
  s.players[p].partner.location = loc;
}

/**
 * アシスト: パートナーを sleep + FILE へ移動 (rules/13 アシスト)
 * - パートナーをスリープ化
 * - location を 'file-area' へ
 * - FILE に assisted-partner カードとして追加
 * - assistedThisTurn = true
 *
 * Round 4a (バグ B): FILE 7 枚以上で事件編→解決編 自動遷移 (rules/01, 25)。
 * 公式 Q&A (rules/25): 「アシスト後、FILE 7+ 条件達成時、解決編にしないことは不可。必ず移行」。
 * 旧実装は `src/ai/policy.ts:assist` のみで check していたが、UI dispatch
 * (`src/ui/hooks/useEngineDispatch.ts:assist`) は単に mutate.partner.assist を呼ぶだけで
 * check を持たず、人間プレイで「FILE 7 枚で解決編に行けない」バグの原因だった。
 * engine mutator 内に check を移して全 caller (AI / UI 両方) で自動適用される。
 */
function assist(s: GameState, p: Player): void {
  s.players[p].partner.state = 'sleep';
  s.players[p].partner.location = 'file-area';
  fileMutate.insertAssistedPartner(s, p);
  s.turnState[p].assistedThisTurn = true;
  // rules/01 + rules/25: FILE 7 枚以上 (アシストしたパートナー含む) で必ず解決編へ移行
  if (s.players[p].case.status === '事件編' && s.players[p].file.length >= 7) {
    caseOp.toResolved(s, p); // BUG-089: hook 経由で a1 (caseResolvedHandRemove) を発火させる
  }
}

/**
 * オートフェイズ用: FILE から partner-area に戻してアクティブ化 (rules/05)
 * - FILE から assisted-partner エントリを削除
 * - location を 'partner-area' へ
 * - 状態を active に
 */
function returnFromFile(s: GameState, p: Player): void {
  fileMutate.removeAssistedPartner(s, p);
  s.players[p].partner.location = 'partner-area';
  s.players[p].partner.state = 'active';
}

/**
 * 事件解決: パートナーをスリープ化してゲーム勝利 (rules/01)
 *
 * engine E3 P10 (2026-07-03): 自 case card が【事件解決】を書き換えている場合 (partnerSolveOverride、
 * B03135/B05118/B06105「相手はゲームに敗北する」) は、通常勝利 (reason:'evidence') の代わりに
 * 〚証拠を事件レベル(=requiredEvidence)数リムーブ〛(=【証拠隠滅】cost) を行い alt-lose で決着させる。
 * 前提条件 (解決編/active partner/evidence>=required) は canWin で既に担保済 (列挙は通常 solve と同一)。
 * 全 caller (UI dispatch / AI policy / effect atomPartnerSolveCase) が引数不変ゆえ自動で分岐に乗る。
 */
function solveCase(s: GameState, p: Player): void {
  s.players[p].partner.state = 'sleep';
  if (readGame.partnerSolveOverride(s, p)) {
    // 【証拠隠滅】: 証拠を事件レベル(=requiredEvidence)数だけ最上部から順にリムーブ (rules/10/21)。
    // removeTop は evidence:removed observer を emit するが event.emit は pendingEffects へ push のみ
    // (inline 解決なし) ゆえ勝利前に横取り不可。terminal win なので cause-independent observer を意図的に再利用。
    const n = s.players[p].case.requiredEvidence;
    for (let i = 0; i < n; i++) evidenceMut.removeTop(s, p);
    gameResultMut.set(s, p, 'alt-lose'); // 相手はゲームに敗北する (winner = 効果所有者 p、旧 evidence 直代入と同じ無条件 set)
    return;
  }
  s.gameResult = { winner: p, reason: 'evidence' };
}

/**
 * PA 一般カード枠へ remove から移す (engine wave-12 2026-07-02 G39、rules/03 §パートナーエリア)
 * 「このカードをパートナーエリアに移す」(B07059/B07060/PR195 等)。
 * evidence.gainCard (mutate/evidence.ts) と同型:
 * - remove から lastIndexOf で splice (同 cardId 複数時は直近 push 分 = 当該カード自身)
 * - 不在 (idx===-1) は no-op (B06026 Q&A 同型: 効果解決までに refresh 等で remove を離れていたら移せない)
 * - remove 離脱として remove:exit を emit (wave-4 observer 一貫性)
 * - PA は枚数上限なし (公式 Q&A) → 配列 push、cap なし
 * real partner singleton / partnerAreaMR には一切触れない。
 * @returns 移動が実行されたか
 */
function addAreaCardFromRemove(s: GameState, p: Player, cardId: string, exactIndex?: number): boolean {
  const list = s.players[p].remove;
  const idx = typeof exactIndex === 'number'
    ? (list[exactIndex] === cardId ? exactIndex : -1)
    : list.lastIndexOf(cardId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  removeMut.emitExit(s, p, cardId);
  (s.players[p].partnerAreaCards ??= []).push(cardId);
  return true;
}

/**
 * PA 一般カード枠から cardIds をリムーブする (engine wave A1 2026-07-02 G39 継続、rules/03)。
 * 「自分のパートナーエリアにある〚特徴[ビッグジュエル]〛のカードを N 枚リムーブ」(B07037/PR263)。
 * - partnerAreaCards から各 cardId を lastIndexOf で splice (同 cardId 複数時は直近分)、remove へ push。
 * - PA→remove は「remove エリアへ入る」= discardToRemove 同型 (remove:exit emit は不要、離脱でなく流入)。
 * - PA は現場ではないため【現場リムーブ時】hook は対象外 (rules/03: PA≠現場)。
 * - 不在 cardId は skip (defensive、通常 pick は列挙済 cardId のみ渡す)。
 * real partner singleton / partnerAreaMR には一切触れない。
 */
function removeAreaCardsToRemove(s: GameState, p: Player, cardIds: string[]): void {
  const list = s.players[p].partnerAreaCards;
  if (!list) return;
  for (const cardId of cardIds) {
    const idx = list.lastIndexOf(cardId);
    if (idx === -1) continue;
    list.splice(idx, 1);
    s.players[p].remove.push(cardId);
  }
}

/**
 * Remove one exact general-PA occurrence.  Unlike the legacy cardId helper,
 * this never falls back to another equal copy when a human/AI selection has
 * become stale.  PA cards are not scene characters, so no scene leave hook is
 * emitted here.
 */
function removeAreaCardToRemoveAt(s: GameState, p: Player, cardId: string, index: number): boolean {
  const list = s.players[p].partnerAreaCards;
  if (!list || list[index] !== cardId) return false;
  list.splice(index, 1);
  s.players[p].remove.push(cardId);
  return true;
}

// MR能力①② (rules/18) は real partner singleton を破壊しない別 slot `PlayerState.partnerAreaMR`
// に再実装された (engine/mr-partner-area-core, 2026-06-23):
//   - MR①: mutate/scene.ts placeMrInPA (相手ターン中の全 leave verb から PA へ redirect)
//   - MR②: mutate/scene.ts applyMrEntryRemoval (enter/switchEnter 冒頭で既存 MR を除去)
// 旧 dead stub toRemovedByMR / toPartnerAreaFromScene (real partner.cardId/location を上書きしていた・
// caller 0) は削除した。partner は引き続き strict singleton。

export const partner = {
  init,
  setState,
  setLocation,
  assist,
  returnFromFile,
  solveCase,
  addAreaCardFromRemove,
  removeAreaCardsToRemove,
  removeAreaCardToRemoveAt,
};
