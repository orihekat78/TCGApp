// Phase 8 完全クローズ Commit 3b: ミスリード listener
//
// rules: 13-keywords.md §ミスリード
// spec: 計画 — Commit 3b Misread infrastructure
//
// 役割:
//   - `reasoning:before-add` イベント発火時に、反対側 scene の active キャラから
//     type:'icon-misread' ability を抽出 → 発動候補リストを構築
//   - AI defender (= opp 側に misread 持ち && human が推理側) の場合は listener 内
//     synchronous に HeuristicPolicy.chooseMisreadTriggers を呼んで sleep + LP-X 適用
//   - Human defender (= self 側に misread 持ち && opp が推理側) の場合は側チャネル set
//     → UI 経由で resolve (Commit 3b では scaffold のみ、実発動は別 commit で対応)
//
// 注: MVP デッキ (CT-D08/CT-D11) には icon-misread を持つカードがないため、
//     本 listener が実際に発動するのは Phase 5 で実カード追加された後。

import { event } from '../event/registry.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js';
import { mutate } from '../mutate/index.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type { GameState } from '../types/index.js';

export type MisreadCandidate = { uid: string; x: number };

export type PendingMisreadSide = {
  reasoningUid: string;
  reasoningPlayer: 'self' | 'opp';
  candidates: MisreadCandidate[];
};

let _pendingMisreadSideChannel: PendingMisreadSide | null = null;

/** dispatchEngineAction が produce 完了後に呼び、Zustand に転送するための drain API */
export function _drainPendingMisread(): PendingMisreadSide | null {
  const v = _pendingMisreadSideChannel;
  _pendingMisreadSideChannel = null;
  return v;
}

/** テスト用: 側チャネル直接リセット */
export function _resetPendingMisread(): void {
  _pendingMisreadSideChannel = null;
}

/**
 * テスト用: `_registered` flag をリセットして次回 `registerMisreadListener()` 呼出で
 * listener を再登録可能にする。`event._resetRegistry()` 直後に呼ぶ必要がある
 * (Hirameki と同じ pattern, commit 75fe5f4)。
 */
export function _resetMisreadRegistered(): void {
  _registered = false;
}

function findOwnerOfUid(state: GameState, uid: string): 'self' | 'opp' | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some((c) => c.uid === uid)) return p;
  }
  return null;
}

function extractMisreadX(ability: unknown): number | null {
  if (!ability || typeof ability !== 'object') return null;
  const a = ability as { type?: string; effect?: { args?: { x?: number } } };
  if (a.type !== 'icon-misread') return null;
  const x = a.effect?.args?.x;
  return typeof x === 'number' ? x : null;
}

let _registered = false;

export function registerMisreadListener(): void {
  if (_registered) return;
  _registered = true;
  event.on('reasoning:before-add', (state, payload) => {
    const p = payload as { uid?: string } | undefined;
    if (!p?.uid) return;
    const reasoningPlayer = findOwnerOfUid(state, p.uid);
    if (!reasoningPlayer) return;
    const defender: 'self' | 'opp' = reasoningPlayer === 'self' ? 'opp' : 'self';

    const candidates: MisreadCandidate[] = [];
    for (const c of state.players[defender].scene) {
      if (c.state !== 'active') continue;
      const def = readDef.card(c.cardId);
      if (!def) continue;
      for (const ability of def.abilities) {
        const x = extractMisreadX(ability);
        if (x === null) continue;
        candidates.push({ uid: c.uid, x });
      }
    }
    if (candidates.length === 0) return;

    // AI defender (= opp が defender) は同期的に判定 + 適用
    if (defender === 'opp') {
      const ai = new HeuristicPolicy();
      const picks = ai.chooseMisreadTriggers
        ? ai.chooseMisreadTriggers(state, p.uid, candidates)
        : candidates; // fallback: 全発動 (人間有利)
      let totalReduction = 0;
      for (const pick of picks) {
        mutate.scene.setState(state, pick.uid, 'sleep');
        totalReduction += pick.x;
      }
      // LP-X は推理中だけ参照されるため lpOverride で 1 回適用 (reasoning.ts は emit 後に
      // 再読みする実装になっている)。partner uid は scene にないため skip。
      // TODO(Phase 5): reasoning:end で lpOverride を元に戻す cleanup listener を追加。
      if (totalReduction > 0 && p.uid !== 'partner:self' && p.uid !== 'partner:opp') {
        const currentLp = readChar.lp(state, p.uid);
        mutate.char.setOverrideLP(state, p.uid, currentLp - totalReduction);
      }
      return;
    }

    // Human defender → 側チャネル (UI 側で resolve、Commit 3b では scaffold のみ)
    _pendingMisreadSideChannel = {
      reasoningUid: p.uid,
      reasoningPlayer,
      candidates,
    };
  });
}
