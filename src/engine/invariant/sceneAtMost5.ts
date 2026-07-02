// engine.invariant.sceneAtMost5 — 現場5枚上限の不変条件
// rules: 03-field-areas.md, 20-color-and-switch.md

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';

/**
 * 現場のキャラ数が5枚以下であることを確認する
 * 5枚超で throw Error
 *
 * ⚠ engine E3 P11 (2026-07-02): これは **絶対エンジン天井** (5 固定)。
 * case override による現場上限 (read.sceneCap、PR067 で 4 等) は **登場ゲート** にのみ効き、
 * 本 invariant は下げない。理由: cap4 が既存 5 枚に乗っても強制リムーブしない非強制解釈のため
 * (rules/19 §下限なし 準拠、公式は超過時裁定を明示せず)。登場は sceneCap でブロックされるので
 * 通常 5 を超えることはなく、本 invariant は「6 以上=エンジンバグ」の paranoia ガードとして 5 固定で残す。
 */
export function sceneAtMost5(s: GameState, p: Player): void {
  const count = s.players[p].scene.length;
  if (count > 5) {
    throw new Error(`scene at most 5: player ${p} has ${count} chars (rules/03, 20)`);
  }
}
