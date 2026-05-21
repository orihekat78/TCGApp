// ai.policies.heuristic — 優先順位ベースの AIPolicy 実装 (Phase 6 Group B Task 6.4)
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
// rules: 01-victory-conditions.md (事件解決), 11-reasoning.md (LP≤0 で証拠0枚),
//        07-action-flow.md / 08-contact.md (AP 判定), 12-next-hint.md, 13-keywords.md
//
// 優先順位 (高→低):
//   1. solveCase — 勝利が見えるなら必ず取る
//   2. assist — このアシストで FILE>=7 になる場合 (解決編移行) のみ
//   3. reasoning — 最も LP の高いソースを選ぶ。LP=0 のソースしかない場合はスキップ (rules/11)
//   4. actionAgainstCase — 最大 AP のアタッカーを選ぶ
//   5. actionAgainstChar — 攻撃側 AP >= 対象 AP の候補のみ。攻撃 AP 最大を選ぶ
//   6. handUseCard — event を優先、無ければ最初の候補
//   7. startNextHint — FILE を消費するため優先度低め
//   8. partnerAbility / declaredAbility — MVP では heuristic スコアを付けにくいのでフォールバック
//   9. fallback: endTurn 以外をランダム
//  10. endTurn — 最後の手段

import type { AIPolicy } from '../policy.js';
import type { Move } from '../move-enumerator.js';
import type { GameState, ActionContext, Candidate } from '@/engine/types';
// Phase 7-3 (BUG: circular import fix): `@/engine` umbrella を使うと
// triggered.ts → heuristic.ts → engine/index.ts → triggered.ts の TDZ ループに陥るため、
// 必要な submodule のみ直接 import する。
import { cards as engineCards } from '@/engine/cards/index.js';
import { read as engineRead } from '@/engine/read/index.js';
import { RandomPolicy, type RandomPolicyOptions } from './random.js';

/** 旧コード互換: `engine.cards` / `engine.read` のみ使用していたため facade で代替。 */
const engine = { cards: engineCards, read: engineRead };

/**
 * uid のオーナープレイヤーを判定 (chooseCutIn 内部用)。
 * partner uid と scene uid 両対応。
 */
function ownerOfUid(s: GameState, uid: string): 'self' | 'opp' | null {
  if (uid === 'partner:self') return 'self';
  if (uid === 'partner:opp') return 'opp';
  for (const p of ['self', 'opp'] as const) {
    if (s.players[p].scene.some((c) => c.uid === uid)) return p;
  }
  return null;
}

/**
 * ax の firstUid / secondUid のうち、player 側のキャラ uid を返す (chooseCutIn 用)。
 */
function pickContactUidFor(s: GameState, ax: ActionContext, player: 'self' | 'opp'): string | null {
  const candidates = [ax.firstUid, ax.secondUid].filter((u): u is string => Boolean(u));
  for (const uid of candidates) {
    if (ownerOfUid(s, uid) === player) return uid;
  }
  return null;
}

/**
 * partner uid を考慮した AP 読み出し (rules/07: パートナーもアクション可能)。
 * read.char.ap は scene[] のみスキャンするため、partner uid は CardDef から直接取得。
 * (state-machine.ts:46 readEffectiveAp と同じロジック)
 */
function readEffectiveAp(s: GameState, uid: string): number {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p = uid === 'partner:self' ? 'self' : 'opp';
    const partner = s.players[p].partner;
    if (!partner.cardId) return 0;
    const def = engine.cards.get(partner.cardId);
    return def?.ap ?? 0;
  }
  return engine.read.char.ap(s, uid);
}

type Player = 'self' | 'opp';

export interface HeuristicPolicyOptions extends RandomPolicyOptions {}

export class HeuristicPolicy implements AIPolicy {
  readonly name = 'heuristic';
  private readonly fallback: RandomPolicy;

  constructor(opts?: HeuristicPolicyOptions) {
    this.fallback = new RandomPolicy(opts);
  }

  choose(state: GameState, candidates: Move[], byPlayer: Player): Move | null {
    if (candidates.length === 0) return null;

    // 優先順位 1: solveCase
    const solve = candidates.find((m): m is Extract<Move, { kind: 'solveCase' }> => m.kind === 'solveCase');
    if (solve) return solve;

    // 優先順位 2: assist — このアシストで FILE が 7 枚以上になる場合のみ採用
    // (rules/01, 13: FILE 7 枚以上で事件編 → 解決編)
    const assist = candidates.find((m): m is Extract<Move, { kind: 'assist' }> => m.kind === 'assist');
    if (assist) {
      const fileLen = state.players[byPlayer].file.length;
      // アシスト時にパートナーが FILE に加わるため +1
      if (fileLen + 1 >= 7) return assist;
    }

    // 優先順位 3: reasoning — 最も LP の高い候補。LP > 0 のものに限る (rules/11)
    const reasoningMoves = candidates.filter(
      (m): m is Extract<Move, { kind: 'reasoning' }> => m.kind === 'reasoning',
    );
    if (reasoningMoves.length > 0) {
      const scored = reasoningMoves
        .map(m => ({ m, lp: lpOf(state, m.uid) }))
        .sort((a, b) => b.lp - a.lp);
      const best = scored[0];
      if (best.lp > 0) return best.m;
    }

    // 優先順位 4: actionAgainstCase — 最大 AP のアタッカーを採用
    const caseAttacks = candidates.filter(
      (m): m is Extract<Move, { kind: 'actionAgainstCase' }> => m.kind === 'actionAgainstCase',
    );
    if (caseAttacks.length > 0) {
      const scored = caseAttacks
        .map(m => ({ m, ap: apOf(state, m.byUid) }))
        .sort((a, b) => b.ap - a.ap);
      return scored[0].m;
    }

    // 優先順位 5: actionAgainstChar — 攻撃側 AP >= 対象 AP の手のみ
    // (rules/08: AP 同値でもリムーブ成立)。負ける攻撃は出さない。
    const charAttacks = candidates.filter(
      (m): m is Extract<Move, { kind: 'actionAgainstChar' }> => m.kind === 'actionAgainstChar',
    );
    const winningCharAttacks = charAttacks.filter(
      m => apOf(state, m.byUid) >= apOf(state, m.targetUid),
    );
    if (winningCharAttacks.length > 0) {
      const scored = winningCharAttacks
        .map(m => ({ m, ap: apOf(state, m.byUid) }))
        .sort((a, b) => b.ap - a.ap);
      return scored[0].m;
    }

    // 優先順位 6: handUseCard — event を優先
    const handCards = candidates.filter(
      (m): m is Extract<Move, { kind: 'handUseCard' }> => m.kind === 'handUseCard',
    );
    if (handCards.length > 0) {
      const eventCard = handCards.find(m => {
        const def = engine.cards.get(m.cardId);
        return def?.kind === 'event';
      });
      if (eventCard) return eventCard;
      return handCards[0];
    }

    // 優先順位 6b: handUseCardSwitch (rules/20 §スイッチ、scene 5 枚埋まり時の代替経路)
    // Option A: 各 cardId について最古 enterOrder の removeUid を選ぶ (戦術強化は Phase 9-F)。
    const handSwitchCards = candidates.filter(
      (m): m is Extract<Move, { kind: 'handUseCardSwitch' }> => m.kind === 'handUseCardSwitch',
    );
    if (handSwitchCards.length > 0) {
      const oldest = [...state.players[byPlayer].scene].sort(
        (a, b) => a.enterOrder - b.enterOrder,
      )[0];
      if (oldest) {
        const picked = handSwitchCards.find(m => m.removeUid === oldest.uid);
        if (picked) return picked;
      }
      return handSwitchCards[0];
    }

    // 優先順位 7: startNextHint (Phase 9-B: fileLen >= 8 の surplus がある時だけ)
    // NextHint は FILE を消費するため、assist 用 7 枚を確保した上での surplus でのみ使う。
    // この gate を入れないと FILE 蓄積が NextHint で相殺され assist 閾値に到達しない。
    const nh = candidates.find((m): m is Extract<Move, { kind: 'startNextHint' }> => m.kind === 'startNextHint');
    if (nh && state.players[byPlayer].file.length >= 8) return nh;

    // フォールバック: endTurn / startNextHint 以外をランダムに選ぶ
    // (NextHint は priority 7 gate を通らない場合は使用しない)
    const nonEnd = candidates.filter(m => m.kind !== 'endTurn' && m.kind !== 'startNextHint');
    if (nonEnd.length > 0) {
      return this.fallback.choose(state, nonEnd, byPlayer);
    }

    // 最後: endTurn
    const endTurn = candidates.find((m): m is Extract<Move, { kind: 'endTurn' }> => m.kind === 'endTurn');
    return endTurn ?? null;
  }

  /**
   * Phase 8.7d: カットイン判定 (rules/08 / rules/09)。
   *
   * ヒューリスティック:
   *   - candidates 0 件 → null
   *   - 自分のコンタクトキャラの AP >= 相手の AP → null (既に勝てる)
   *   - そうでなければ candidates[0] を選ぶ (不利の挽回試行)
   *
   * ※「どのカットインを選ぶか」は MVP では先頭固定。将来は AP+ 量や
   * 効果内容で最適化したい (Phase 8.7d2 ポリッシュ)。
   */
  chooseCutIn(
    state: GameState,
    ax: ActionContext,
    player: 'self' | 'opp',
    candidates: ReadonlyArray<string>,
  ): string | null {
    if (candidates.length === 0) return null;
    // 自分 / 相手 のコンタクトキャラ uid を特定
    const myUid = pickContactUidFor(state, ax, player);
    if (!myUid) return null;
    const oppUid = myUid === ax.firstUid ? ax.secondUid : ax.firstUid;
    if (!oppUid) return null;
    const myAp = readEffectiveAp(state, myUid);
    const oppAp = readEffectiveAp(state, oppUid);
    if (myAp >= oppAp) return null; // 既に勝てるので資源温存
    return candidates[0];
  }

  /**
   * Phase 8.7e: 変装判定 (rules/09)。
   *
   * ヒューリスティック: chooseCutIn と同じ AP 比較ロジック。
   *   - candidates 0 件 → null
   *   - 自 AP >= 敵 AP → null
   *   - そうでなければ candidates[0]
   *
   * ※「変装後の新カード AP を考慮して最大を選ぶ」最適化は将来 (8.7e2)。
   */
  chooseDisguise(
    state: GameState,
    ax: ActionContext,
    player: 'self' | 'opp',
    candidates: ReadonlyArray<string>,
  ): string | null {
    if (candidates.length === 0) return null;
    const myUid = pickContactUidFor(state, ax, player);
    if (!myUid) return null;
    const oppUid = myUid === ax.firstUid ? ax.secondUid : ax.firstUid;
    if (!oppUid) return null;
    const myAp = readEffectiveAp(state, myUid);
    const oppAp = readEffectiveAp(state, oppUid);
    if (myAp >= oppAp) return null;
    return candidates[0];
  }

  /**
   * Phase 8.7c: ガード判定 (rules/07 / rules/08)。
   *
   * ヒューリスティック:
   *   - 候補 0 件 → null (passGuard)
   *   - 最大 AP の候補 >= attacker AP → そのキャラでガード
   *     (引き分け以上なら attacker をリムーブできるため、ガード価値あり)
   *   - 全候補 AP < attacker AP → null (どうせ負けるならガード資源を温存)
   *
   * 注: 「ガード対象キャラ自身もリムーブされる可能性」「ターン回数温存」等の
   * 高度な評価は将来拡張。MVP では単純な AP 比較で十分。
   */
  chooseGuard(state: GameState, ax: ActionContext, candidates: ReadonlyArray<{ uid: string; cardId: string }>): string | null {
    if (candidates.length === 0) return null;
    const attackerAp = readEffectiveAp(state, ax.byUid);
    let best = candidates[0];
    let bestAp = readEffectiveAp(state, best.uid);
    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i];
      const ap = readEffectiveAp(state, c.uid);
      if (ap > bestAp) {
        best = c;
        bestAp = ap;
      }
    }
    // 防御側の最大 AP が attacker に届かない → ガードしても倒せず資源浪費
    if (bestAp < attackerAp) return null;
    return best.uid;
  }

  /**
   * Phase 8 完全クローズ Commit 3a: ヒラメキ発動判定。
   * ヒラメキは「証拠を失ったお詫び」として手札 +1 / 相手キャラ stun といった
   * 防御リソース系効果のため、常に発動するのが定石。MVP 単純実装で常に true。
   */
  chooseHiramekiTrigger(
    _state: GameState,
    _pending: { cardId: string; abilityId: string },
  ): boolean {
    return true;
  }

  /**
   * Phase 8 完全クローズ Commit 3b: ミスリード発動キャラ選択。
   * Greedy 戦略: 推理対象の LP を 0 以下にできる最小限の組み合わせを選ぶ。
   *   1. candidates を x 降順にソート
   *   2. 累計 x が必要削減量 (= 推理対象 LP) を超えたら採用打ち切り
   *   3. LP を 0 以下にできない場合は 1 枚も発動しない (資源温存)
   * 注: chooseGuard と同じ「届かないなら発動しない」哲学。
   */
  chooseMisreadTriggers(
    state: GameState,
    reasoningUid: string,
    candidates: ReadonlyArray<{ uid: string; x: number }>,
  ): ReadonlyArray<{ uid: string; x: number }> {
    if (candidates.length === 0) return [];
    const targetLp = lpOf(state, reasoningUid);
    const sorted = [...candidates].sort((a, b) => b.x - a.x);
    const totalX = sorted.reduce((sum, c) => sum + c.x, 0);
    // 全部発動しても LP <= 0 にできない → 資源温存で全スキップ
    if (totalX < targetLp) return [];
    // Greedy: x 降順に必要分まで採用
    const picks: { uid: string; x: number }[] = [];
    let acc = 0;
    for (const c of sorted) {
      picks.push(c);
      acc += c.x;
      if (acc >= targetLp) break;
    }
    return picks;
  }

  /**
   * Phase 5 advance: 捜査X 順番決定 (rules/13)。
   * MVP では「発見された」参照効果がないため戦術差なし。peek 順をそのまま return。
   * Phase 9-F で「相手の有用カードを先頭 (= 早く下に戻る) に置く」等の戦術強化候補。
   */
  chooseSouzaOrder(
    _state: GameState,
    _defender: 'self' | 'opp',
    cardIds: ReadonlyArray<string>,
  ): ReadonlyArray<string> {
    return cardIds;
  }

  /**
   * Phase 7-3: $pick atom target ヒューリスティック選択。
   * resolveEffectPicks (engine/effect/resolve-picks.ts) から呼ばれ、verb / args / 自陣敵陣を
   * 考慮して best 候補を選ぶ。戻り値 null → caller 側で先頭採用 fallback。
   *
   * verb 別戦術:
   *   - sceneRemove          → 敵候補から AP 最高 (脅威排除)、無ければ LP 最高
   *   - sceneSetState sleep/stun → 敵 active 最高 AP (脅威阻害)。active 無ければ任意敵
   *   - sceneSetState active → 自陣 sleep/stun 最高 AP (再活性)、無ければ任意自陣
   *   - charModifyAP delta>0 → 自陣 AP 最低 (伸び代の大きい味方を強化)
   *   - charModifyAP delta<0 → 敵 AP 最高 (脅威弱化)
   *   - charModifyLP delta>0 → 自陣 LP 最高 (推理エースを強化)
   *   - charModifyLP delta<0 → 敵 LP 最高 (推理妨害)
   *   - その他 verb         → null (caller の先頭採用 fallback)
   *
   * 'char' kind 以外の候補は無視 (substituteAtomPick の制約と整合)。
   * 候補 0 件は呼ばれない (caller 側で先に no-op fallback)。
   */
  chooseAtomTarget(
    state: GameState,
    atomVerb: string,
    atomArgs: Readonly<Record<string, unknown>>,
    candidates: ReadonlyArray<Candidate>,
    byPlayer: 'self' | 'opp',
  ): Candidate | null {
    type CharCand = Candidate & { kind: 'char' };
    const chars = candidates.filter((c): c is CharCand => c.kind === 'char');
    if (chars.length === 0) return null;

    const oppSide: 'self' | 'opp' = byPlayer === 'self' ? 'opp' : 'self';
    const enemies = chars.filter((c) => c.player === oppSide);
    const allies = chars.filter((c) => c.player === byPlayer);

    const pickMaxAP = (pool: CharCand[]): CharCand | null =>
      pool.reduce<CharCand | null>(
        (best, c) => (best === null || apOf(state, c.uid) > apOf(state, best.uid) ? c : best),
        null,
      );
    const pickMinAP = (pool: CharCand[]): CharCand | null =>
      pool.reduce<CharCand | null>(
        (best, c) => (best === null || apOf(state, c.uid) < apOf(state, best.uid) ? c : best),
        null,
      );
    const pickMaxLP = (pool: CharCand[]): CharCand | null =>
      pool.reduce<CharCand | null>(
        (best, c) => (best === null || lpOf(state, c.uid) > lpOf(state, best.uid) ? c : best),
        null,
      );
    const charState = (uid: string): 'active' | 'sleep' | 'stun' => engine.read.char.state(state, uid);

    switch (atomVerb) {
      case 'sceneRemove': {
        return pickMaxAP(enemies) ?? pickMaxLP(enemies);
      }
      case 'sceneSetState': {
        const targetState = atomArgs['state'];
        if (targetState === 'sleep' || targetState === 'stun') {
          const activeEnemies = enemies.filter((c) => charState(c.uid) === 'active');
          return pickMaxAP(activeEnemies) ?? pickMaxAP(enemies);
        }
        if (targetState === 'active') {
          const downedAllies = allies.filter((c) => {
            const st = charState(c.uid);
            return st === 'sleep' || st === 'stun';
          });
          return pickMaxAP(downedAllies) ?? pickMaxAP(allies);
        }
        return null;
      }
      case 'charModifyAP': {
        const delta = typeof atomArgs['delta'] === 'number' ? (atomArgs['delta'] as number) : 0;
        if (delta > 0) return pickMinAP(allies);
        if (delta < 0) return pickMaxAP(enemies);
        return null;
      }
      case 'charModifyLP': {
        const delta = typeof atomArgs['delta'] === 'number' ? (atomArgs['delta'] as number) : 0;
        if (delta > 0) return pickMaxLP(allies);
        if (delta < 0) return pickMaxLP(enemies);
        return null;
      }
      default:
        return null;
    }
  }
}

/**
 * lpOf — uid のエフェクティブ LP を返す。
 *   - 'partner:self' / 'partner:opp' は CardDef.lp (現状 partner は override なし)
 *   - scene のキャラは engine.read.char.lp で apOverride / lpOverride 反映済みの値
 */
function lpOf(state: GameState, uid: string): number {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[p].partner.cardId;
    if (!cardId) return 0;
    const def = engine.cards.get(cardId);
    return def?.lp ?? 0;
  }
  return engine.read.char.lp(state, uid);
}

/**
 * apOf — uid のエフェクティブ AP を返す (lpOf と同様)
 */
function apOf(state: GameState, uid: string): number {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[p].partner.cardId;
    if (!cardId) return 0;
    const def = engine.cards.get(cardId);
    return def?.ap ?? 0;
  }
  return engine.read.char.ap(state, uid);
}
