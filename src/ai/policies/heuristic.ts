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
 * partner / scene 共通の effective AP reader。
 */
function readEffectiveAp(s: GameState, uid: string): number {
  return engine.read.char.ap(s, uid);
}

type Player = 'self' | 'opp';

export type HeuristicPolicyOptions = RandomPolicyOptions;

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

    // 優先順位 3 / 4: reasoning vs actionAgainstCase (BUG-044 / user_request #4)
    //
    // 旧実装は reasoning を常に先に評価し LP > 0 なら return していたため
    // CPU が actionAgainstCase を選ぶ機会がほぼゼロだった (ユーザー指摘 #4)。
    //
    // ただし「常に case attack を選ぶ」と双方 AI が攻防戦に陥り試合が延々と
    // 終わらない (試 smoke で 9.85→135.54 turn / timeout 0→641 を観測)。
    //
    // 解決: 後期ゲーム条件 (相手証拠が必要数の半分以上、または自分の reasoning
    // LP が低い) でのみ case attack を優先。それ以外は既存通り reasoning 優先。
    const reasoningMoves = candidates.filter(
      (m): m is Extract<Move, { kind: 'reasoning' }> => m.kind === 'reasoning',
    );
    const caseAttacks = candidates.filter(
      (m): m is Extract<Move, { kind: 'actionAgainstCase' }> => m.kind === 'actionAgainstCase',
    );
    const bestReasoning = (() => {
      if (reasoningMoves.length === 0) return null;
      const scored = reasoningMoves
        .map(m => ({ m, lp: lpOf(state, m.uid) }))
        .sort((a, b) => b.lp - a.lp);
      const best = scored[0];
      return best.lp > 0 ? best : null;
    })();
    const bestCaseAttack = (() => {
      if (caseAttacks.length === 0) return null;
      const oppPlayer: Player = byPlayer === 'self' ? 'opp' : 'self';
      const oppEvidence = state.players[oppPlayer].evidence.length;
      const oppRequired = state.players[oppPlayer].case.requiredEvidence;
      // 「劣勢時のみ disruption」戦略 (BUG-044 試行錯誤後の最終 threshold):
      //   - 相手があと 1 で勝つ状態 (oppEvidence ≥ req-1) かつ
      //   - 自分が劣勢 (selfEvidence < oppEvidence)
      // の両条件を満たすときのみ case attack を選択。
      // 序盤/中盤は reasoning 優先 (smoke turn 数 9.85 維持目的)。
      // 攻撃側と同位/優位の時は reasoning でレースし勝ち切るほうが効率的。
      const selfEvidence = state.players[byPlayer].evidence.length;
      const oppCriticalWin = oppEvidence >= oppRequired - 1;
      const selfBehind = selfEvidence < oppEvidence;
      if (oppEvidence < 1) return null;       // rules/07: 証拠 0 の事件は対象不可
      if (!oppCriticalWin || !selfBehind) return null;
      const scored = caseAttacks
        .map(m => ({ m, ap: apOf(state, m.byUid) }))
        .sort((a, b) => b.ap - a.ap);
      // case attack の期待差分: +1 自 / -1 相手 = 2
      return { m: scored[0].m, score: 2 };
    })();
    if (bestReasoning && bestCaseAttack) {
      // 後期ゲームのみ case attack score=2 と LP を比較 — LP=1 なら case 優先、
      // LP≧2 なら reasoning 優先 (既存挙動維持)
      return bestReasoning.lp >= bestCaseAttack.score ? bestReasoning.m : bestCaseAttack.m;
    }
    if (bestReasoning) return bestReasoning.m;
    if (bestCaseAttack) return bestCaseAttack.m;

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

    // 優先順位 6: handUseCard (user_request 20260521_01 #12 改修)
    // 改修前: event を優先、無ければ最初の候補 — character は AP/LP 無視で先頭固定
    // 改修後: scene が空いている (< 3) なら character を AP/LP scoring で選ぶ、
    //         scene 充足時は event を優先 (推理盤面の補強より effect を優先)
    const handCards = candidates.filter(
      (m): m is Extract<Move, { kind: 'handUseCard' }> => m.kind === 'handUseCard',
    );
    if (handCards.length > 0) {
      const sceneLen = state.players[byPlayer].scene.length;
      const isSparse = sceneLen < 3;
      // 各カードを (def, m) ペアで分類
      const classified = handCards.map(m => ({
        m,
        def: engine.cards.get(m.cardId),
      }));
      const charCards = classified.filter(c => c.def?.kind === 'character');
      const eventCards = classified.filter(c => c.def?.kind === 'event');

      // scoring: AP + LP * 1.5 (推理重視のためLPを少し重く)
      const scoreCharCard = (def: { ap?: number | null; lp?: number | null } | undefined): number => {
        const ap = def?.ap ?? 0;
        const lp = def?.lp ?? 0;
        return ap + lp * 1.5;
      };

      if (isSparse && charCards.length > 0) {
        // scene 空き — 最大スコアの character を優先
        const best = charCards
          .map(c => ({ m: c.m, score: scoreCharCard(c.def) }))
          .sort((a, b) => b.score - a.score)[0];
        return best.m;
      }
      // それ以外は従来通り event > character (先頭)
      if (eventCards.length > 0) return eventCards[0].m;
      if (charCards.length > 0) {
        // scene 充足時の character は scoring で最良を選ぶ (上書き効果や登場時効果優先)
        const best = charCards
          .map(c => ({ m: c.m, score: scoreCharCard(c.def) }))
          .sort((a, b) => b.score - a.score)[0];
        return best.m;
      }
      return handCards[0];
    }

    // 優先順位 6b: handUseCardSwitch (rules/20 §スイッチ、scene 5 枚埋まり時の代替経路)
    // Cleanup #3 (2026-05-22): 「最古 enterOrder」→ cardValue 最低の自陣 char を
    // 削除するよう改修。価値の低いカード (低 AP + 低 LP) を犠牲にして新カード召喚。
    const handSwitchCards = candidates.filter(
      (m): m is Extract<Move, { kind: 'handUseCardSwitch' }> => m.kind === 'handUseCardSwitch',
    );
    if (handSwitchCards.length > 0) {
      // 削除候補 = self.scene のうち handSwitchCards の removeUid に含まれるもの
      const removableUids = new Set(handSwitchCards.map(m => m.removeUid));
      const removables = state.players[byPlayer].scene.filter(c => removableUids.has(c.uid));
      const worst = removables
        .map(c => ({ uid: c.uid, score: cardValueSelf(state, c.uid) }))
        .sort((a, b) => a.score - b.score)[0]; // ascending = 価値最低が先頭
      if (worst) {
        const picked = handSwitchCards.find(m => m.removeUid === worst.uid);
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
  return engine.read.char.lp(state, uid);
}

/**
 * apOf — uid のエフェクティブ AP を返す (lpOf と同様)
 */
function apOf(state: GameState, uid: string): number {
  return engine.read.char.ap(state, uid);
}

/**
 * Cleanup #3 (2026-05-22): 自陣 char の「価値」を 1 つの number で評価する
 * helper。handUseCardSwitch の犠牲選択 (score 最低を捨てる) に使用。
 *
 * 設計:
 *   - AP + LP * 1.5 (BUG-047 で handUseCard scoring に追加した数式と統一)
 *   - 能力数 (abilities.length) を bonus +500/each (有用カード保護)
 *   - 名乗り状態 +0 (制約なし、後述 turn でアクション可能)
 *
 * 将来拡張: ability priority weight / ターン経過予測等は Phase 9-F.2 で。
 */
function cardValueSelf(state: GameState, uid: string): number {
  const ap = apOf(state, uid);
  const lp = lpOf(state, uid);
  const cardId = uid === 'partner:self' || uid === 'partner:opp'
    ? state.players[uid === 'partner:self' ? 'self' : 'opp'].partner.cardId
    : state.players.self.scene.find((c) => c.uid === uid)?.cardId
      ?? state.players.opp.scene.find((c) => c.uid === uid)?.cardId
      ?? '';
  const def = cardId ? engine.cards.get(cardId) : null;
  const abilityCount = def?.abilities?.length ?? 0;
  return ap + lp * 1.5 + abilityCount * 500;
}
