// ai.move-enumerator — 合法手の全列挙 (Phase 6 Group A Task 6.1)
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
// rules: 05-turn-phases.md (メインフェイズ 6 行動), 01-victory-conditions.md (事件解決),
//        13-keywords.md (アシスト), 11-reasoning.md, 07-action-flow.md
//
// 設計メモ:
//   - 列挙は GameState から決定論的に行う (順序は安定; テスト可能)
//   - engine.flow.canX 系セレクタを順に呼び、合法手だけを収集する
//   - 'assist' / 'solveCase' は flow に専用セレクタがないので state から派生判定
//   - 'endTurn' は常に列挙される (プレイヤーは常にターン終了可)
//   - actionAgainstChar は flow.action.candidates も併用し、G29 拡張対象も含める

import type { GameState, CardDef, AbilityDef } from '@/engine/types';
import { engine } from '@/engine';
import { makePartnerAbilCtx } from './ability-ctx.js';

type Player = 'self' | 'opp';

/**
 * Move — エンジンに対して実行可能な行動の discriminated union。
 * dispatcher (ai.policy.applyMove) が kind ごとに対応する flow API を呼ぶ。
 */
export type Move =
  | { kind: 'handUseCard'; cardId: string }
  | { kind: 'handUseCardSwitch'; cardId: string; removeUid: string }
  | { kind: 'startNextHint' }
  | { kind: 'partnerAbility'; abilityId: string }
  | { kind: 'declaredAbility'; uid: string; abilityId: string }
  | { kind: 'reasoning'; uid: string }
  | { kind: 'actionAgainstChar'; byUid: string; targetUid: string }
  | { kind: 'actionAgainstCase'; byUid: string; targetPlayer: 'self' | 'opp' }
  | { kind: 'assist' }
  | { kind: 'solveCase' }
  | { kind: 'endTurn' };

/**
 * canAssist — flow に専用セレクタがないため state から派生判定。
 * rules/13:
 *   - パートナーが active かつ partner-area にいる
 *   - その turn で assistedThisTurn === false
 */
export function canAssist(state: GameState, p: Player): boolean {
  return engine.read.game.canPartnerAssist(state, p);
}

/**
 * canSolveCase — flow に専用セレクタがないため state から派生判定。
 * rules/01:
 *   - 事件が解決編 (= FILE 7 枚以上を経由してアシストされた後の状態)
 *   - 証拠 >= 必要枚数
 *   - パートナーが active 状態
 *   - 同ターン assist 済みは不可 (rules/01 注意)
 */
export function canSolveCase(state: GameState, p: Player): boolean {
  return engine.read.game.canPartnerSolveCase(state, p);
}

/**
 * AbilityDef 型を narrow する (CardDef.abilities は AbilityDef[] だが
 * 配列要素アクセス時 union narrowing を安全側で行う)。
 */
function isAbilityDef(a: unknown): a is AbilityDef {
  return typeof a === 'object' && a !== null && 'id' in a && 'type' in a;
}

/**
 * パートナーの declared abilities を取得 (空配列なら能力なし)
 */
function partnerDeclaredAbilities(state: GameState, p: Player): AbilityDef[] {
  const cardId = state.players[p].partner.cardId;
  if (!cardId) return [];
  const def: CardDef | undefined = engine.cards.get(cardId);
  if (!def) return [];
  return def.abilities.filter((a): a is AbilityDef => isAbilityDef(a) && a.type === 'declared');
}

/**
 * scene キャラの declared abilities を取得
 */
function charDeclaredAbilities(cardId: string): AbilityDef[] {
  const def: CardDef | undefined = engine.cards.get(cardId);
  if (!def) return [];
  return def.abilities.filter((a): a is AbilityDef => isAbilityDef(a) && a.type === 'declared');
}

/**
 * enumerateMoves — 与えられた state / プレイヤーで合法な Move を全て返す。
 *
 * 順序 (テスト可能な決定論):
 *   1. assist
 *   2. solveCase
 *   3. handUseCard (手札順)
 *   4. startNextHint
 *   5. partnerAbility (定義順)
 *   6. declaredAbility (scene 順 × ability 順)
 *   7. reasoning (partner → scene)
 *   8. actionAgainstChar (主体: partner → scene; 対象: candidates 順)
 *   9. actionAgainstCase (主体: partner → scene)
 *  10. endTurn (常)
 */
export function enumerateMoves(state: GameState, byPlayer: Player): Move[] {
  const moves: Move[] = [];
  const oppPlayer: Player = byPlayer === 'self' ? 'opp' : 'self';

  // 1. assist
  if (canAssist(state, byPlayer)) {
    moves.push({ kind: 'assist' });
  }

  // 2. solveCase
  if (canSolveCase(state, byPlayer)) {
    moves.push({ kind: 'solveCase' });
  }

  // 3. handUseCard (手札順 — 同じ cardId が複数あっても各枚を区別しない; 重複は dedup)
  //    rules/20 §スイッチ: scene>=5 でキャラ手札使用したい場合は handUseCardSwitch を
  //    各 scene char (removeUid) ごとに列挙する。
  {
    const seen = new Set<string>();
    for (const cardId of state.players[byPlayer].hand) {
      if (seen.has(cardId)) continue;
      seen.add(cardId);
      if (engine.flow.canHandUseCard(state, byPlayer, cardId)) {
        moves.push({ kind: 'handUseCard', cardId });
        continue;
      }
      if (engine.flow.canHandUseCardSwitch(state, byPlayer, cardId)) {
        for (const sc of state.players[byPlayer].scene) {
          moves.push({ kind: 'handUseCardSwitch', cardId, removeUid: sc.uid });
        }
      }
    }
  }

  // 4. startNextHint
  if (engine.flow.canStartNextHint(state, byPlayer)) {
    moves.push({ kind: 'startNextHint' });
  }

  // 5. partnerAbility (declared のみ)
  // Phase 8.8d: ability.cost が払えない候補は除外
  const partnerCardId = state.players[byPlayer].partner.cardId;
  for (const ab of partnerDeclaredAbilities(state, byPlayer)) {
    if (!engine.flow.canPartnerAbility(state, byPlayer, ab.id)) continue;
    if (ab.cost && partnerCardId) {
      const ctx = makePartnerAbilCtx(byPlayer, partnerCardId, ab.id);
      if (!engine.cost.canPay(state, ab.cost, ctx)) continue;
    }
    moves.push({ kind: 'partnerAbility', abilityId: ab.id });
  }

  // 6. declaredAbility (scene 順 × ability 順)
  // Phase 8.8d: 同じく cost.canPay フィルタ
  for (const c of state.players[byPlayer].scene) {
    // gap② (2026-07-11, B06042): 印字 declared + charGrantAbility 付与 declared (BUG-084 UI/AI 対称)。
    for (const ab of [...charDeclaredAbilities(c.cardId), ...engine.flow.grantedDeclaredAbilitiesOf(c)]) {
      if (!engine.flow.canActivateDeclaredAbility(state, c.uid, ab.id, undefined, { allowImplicitPhysicalCostSelection: true })) continue;
      moves.push({ kind: 'declaredAbility', uid: c.uid, abilityId: ab.id });
    }
  }

  // 6b. 事件カードの declaredAbility (uid 'case:self'/'case:opp')
  // 2026-05-30 BUG-084: UI 側 enumDeclaredAbilitySources は case を含むのに AI 列挙が
  // scene のみで欠落していた (AI vs AI 時に事件の宣言能力を使えない) のを修正。
  {
    const caseCardId = state.players[byPlayer].case.cardId;
    if (caseCardId) {
      const caseUid = `case:${byPlayer}`;
      for (const ab of charDeclaredAbilities(caseCardId)) {
        if (!engine.flow.canActivateDeclaredAbility(state, caseUid, ab.id, undefined, { allowImplicitPhysicalCostSelection: true })) continue;
        moves.push({ kind: 'declaredAbility', uid: caseUid, abilityId: ab.id });
      }
    }
  }

  // 6c. partnerAreaMR の declaredAbility (uid 'partnerMR:self'/'partnerMR:opp')
  // M3 PA batch (2026-07-10, rules/18 §パートナーエリアにいるMRキャラ): BUG-084 同型の
  // UI/AI source 非対称を防ぐ。scope gate (on-partner-area/always のみ) は engine 側。
  {
    const mr = state.players[byPlayer].partnerAreaMR;
    if (mr) {
      const mrUid = mr.uid;
      for (const ab of charDeclaredAbilities(mr.cardId)) {
        if (!engine.flow.canActivateDeclaredAbility(state, mrUid, ab.id, undefined, { allowImplicitPhysicalCostSelection: true })) continue;
        moves.push({ kind: 'declaredAbility', uid: mrUid, abilityId: ab.id });
      }
    }
  }

  // 7. reasoning (partner → scene)
  // 6d. hand declaredAbility (uid `hand:self:<cardId>` / `hand:opp:<cardId>`)
  // Keep the UI's source identity and duplicate-card contract: one sentinel
  // per cardId, admitted by the same cost/timing/ownership boundary.
  for (const [index, cardId] of state.players[byPlayer].hand.entries()) {
    const handUid = `hand:${byPlayer}:${index}`;
    for (const ab of charDeclaredAbilities(cardId)) {
      if (!engine.flow.canActivateDeclaredAbility(state, handUid, ab.id, undefined, { allowImplicitPhysicalCostSelection: true })) continue;
      moves.push({ kind: 'declaredAbility', uid: handUid, abilityId: ab.id });
    }
  }

  for (const [index, entry] of state.players[byPlayer].evidence.entries()) {
    if (!entry.faceUp) continue;
    const uid = `evidence:${byPlayer}:${index}`;
    for (const ab of charDeclaredAbilities(entry.cardId)) {
      if (engine.flow.canActivateDeclaredAbility(state, uid, ab.id, undefined, { allowImplicitPhysicalCostSelection: true })) {
        moves.push({ kind: 'declaredAbility', uid, abilityId: ab.id });
      }
    }
  }
  for (const [index, entry] of state.players[byPlayer].file.entries()) {
    if (entry.type !== 'card-back' || entry.faceUp !== true) continue;
    const uid = `file:${byPlayer}:${index}`;
    for (const ab of charDeclaredAbilities(entry.cardId)) {
      if (engine.flow.canActivateDeclaredAbility(state, uid, ab.id, undefined, { allowImplicitPhysicalCostSelection: true })) {
        moves.push({ kind: 'declaredAbility', uid, abilityId: ab.id });
      }
    }
  }

  const partnerUid = byPlayer === 'self' ? 'partner:self' : 'partner:opp';
  if (engine.flow.canReason(state, partnerUid)) {
    moves.push({ kind: 'reasoning', uid: partnerUid });
  }
  for (const c of state.players[byPlayer].scene) {
    if (engine.flow.canReason(state, c.uid)) {
      moves.push({ kind: 'reasoning', uid: c.uid });
    }
  }

  // 8. actionAgainstChar
  //    主体は partner と scene のキャラを順に試す。
  //    対象は flow.action.candidates (G29 拡張対象も含む) で取得し、canActionAgainstChar
  //    で再フィルタする (mustBeTargeted 等の最終判定は declare 時に行われるが、
  //    列挙時には canActionAgainstChar を素直に呼んで合法手のみ採用)。
  const actorUids: string[] = [partnerUid];
  for (const c of state.players[byPlayer].scene) {
    actorUids.push(c.uid);
  }
  for (const byUid of actorUids) {
    if (!engine.flow.canAction(state, byUid)) continue;
    const cands = engine.flow.action.candidates(state, byUid);
    for (const t of cands) {
      if (engine.flow.canActionAgainstChar(state, byUid, t.uid)) {
        moves.push({ kind: 'actionAgainstChar', byUid, targetUid: t.uid });
      }
    }
  }

  // 9. actionAgainstCase (相手の事件)
  for (const byUid of actorUids) {
    if (engine.flow.canActionAgainstCase(state, byUid, oppPlayer)) {
      moves.push({ kind: 'actionAgainstCase', byUid, targetPlayer: oppPlayer });
    }
  }

  // 10. endTurn (常に列挙)
  moves.push({ kind: 'endTurn' });

  return moves;
}
