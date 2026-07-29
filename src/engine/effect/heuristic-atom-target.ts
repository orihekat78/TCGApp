import { char } from '../read/char.js';
import type { Candidate, GameState } from '../types/index.js';

type Player = 'self' | 'opp';
type CharCandidate = Candidate & { kind: 'char' };

export function chooseHeuristicAtomTarget(
  state: GameState,
  atomVerb: string,
  atomArgs: Readonly<Record<string, unknown>>,
  candidates: ReadonlyArray<Candidate>,
  byPlayer: Player,
): Candidate | null {
  const chars = candidates.filter((candidate): candidate is CharCandidate => candidate.kind === 'char');
  if (chars.length === 0) return null;

  const opponent: Player = byPlayer === 'self' ? 'opp' : 'self';
  const enemies = chars.filter((candidate) => candidate.player === opponent);
  const allies = chars.filter((candidate) => candidate.player === byPlayer);
  const pickMaxAp = (pool: CharCandidate[]): CharCandidate | null =>
    pool.reduce<CharCandidate | null>(
      (best, candidate) => best === null || char.ap(state, candidate.uid) > char.ap(state, best.uid)
        ? candidate
        : best,
      null,
    );
  const pickMinAp = (pool: CharCandidate[]): CharCandidate | null =>
    pool.reduce<CharCandidate | null>(
      (best, candidate) => best === null || char.ap(state, candidate.uid) < char.ap(state, best.uid)
        ? candidate
        : best,
      null,
    );
  const pickMaxLp = (pool: CharCandidate[]): CharCandidate | null =>
    pool.reduce<CharCandidate | null>(
      (best, candidate) => best === null || char.lp(state, candidate.uid) > char.lp(state, best.uid)
        ? candidate
        : best,
      null,
    );

  switch (atomVerb) {
    case 'sceneRemove':
      return pickMaxAp(enemies) ?? pickMaxLp(enemies);
    case 'sceneSetState': {
      const targetState = atomArgs['state'];
      if (targetState === 'sleep' || targetState === 'stun') {
        const activeEnemies = enemies.filter((candidate) => char.state(state, candidate.uid) === 'active');
        return pickMaxAp(activeEnemies) ?? pickMaxAp(enemies);
      }
      if (targetState === 'active') {
        const downedAllies = allies.filter((candidate) => {
          const current = char.state(state, candidate.uid);
          return current === 'sleep' || current === 'stun';
        });
        return pickMaxAp(downedAllies) ?? pickMaxAp(allies);
      }
      return null;
    }
    case 'charModifyAP': {
      const delta = typeof atomArgs['delta'] === 'number' ? atomArgs['delta'] : 0;
      if (delta > 0) return pickMinAp(allies);
      if (delta < 0) return pickMaxAp(enemies);
      return null;
    }
    case 'charModifyLP': {
      const delta = typeof atomArgs['delta'] === 'number' ? atomArgs['delta'] : 0;
      if (delta > 0) return pickMaxLp(allies);
      if (delta < 0) return pickMaxLp(enemies);
      return null;
    }
    default:
      return null;
  }
}
