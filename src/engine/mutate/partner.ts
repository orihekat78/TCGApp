// engine.mutate.partner — パートナー操作プリミティブ
// rules: 01-victory-conditions.md, 13-keywords.md (アシスト・事件解決), 18-mr.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';
import { file as fileMutate } from './file.js';

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
    s.players[p].case.status = '解決編';
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
 */
function solveCase(s: GameState, p: Player): void {
  s.players[p].partner.state = 'sleep';
  s.gameResult = { winner: p, reason: 'evidence' };
}

/**
 * MR能力②: パートナーを mr-removed 状態へ (rules/18)
 * 既存MRをリムーブ + Hook は Phase 3で
 */
function toRemovedByMR(s: GameState, p: Player): void {
  s.players[p].partner.location = 'mr-removed';
  s.players[p].partner.state = 'sleep';
}

/**
 * MR能力①: 現場からパートナーエリアへ移動 (rules/18 相手ターン中の現場離場)
 * SceneCharacter の uid を受け取り、パートナーエリアへ移動
 * 実際の現場からの削除は scene.removeToRemove が行う (リムーブ発火してから即座にPA移動)
 */
function toPartnerAreaFromScene(s: GameState, uid: string): void {
  // MRキャラのパートナー化: どちらのプレイヤーか探す
  for (const p of ['self', 'opp'] as const) {
    const charIdx = s.players[p].scene.findIndex(c => c.uid === uid);
    if (charIdx !== -1) {
      const char = s.players[p].scene[charIdx];
      // パートナーエリアに MR キャラを格納 (partner を上書き)
      s.players[p].partner.cardId = char.cardId;
      s.players[p].partner.state = char.state;
      s.players[p].partner.location = 'partner-area';
      return;
    }
  }
}

export const partner = {
  init,
  setState,
  setLocation,
  assist,
  returnFromFile,
  solveCase,
  toRemovedByMR,
  toPartnerAreaFromScene,
};
