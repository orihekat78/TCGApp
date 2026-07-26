import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/flow/action/target-expander';
import { canActionAgainstChar } from '@/engine/flow/main/action';
import { enumerateMoves } from '@/ai/move-enumerator';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { sceneChar } from '../../../helpers/fixtures';

const preTarget: AbilityDef = {
  id: 'grant', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'action:pre-target', selfOnly: true },
  effect: { kind: 'atom', verb: 'expandActionTargets', args: { side: 'opp', state: ['active'], levelMin: 6 } },
  description: '', ruleRefs: [],
};
const card = (id: string, level = 1, abilities: AbilityDef[] = []): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 1000, lp: 1,
  traits: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [],
});

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene.push(sceneChar('HOST', 'host'));
  s.players.opp.scene.push(
    sceneChar('L5', 'active-5'),
    sceneChar('L6', 'active-6'),
    sceneChar('L6', 'sleep-6', { state: 'sleep' }),
  );
  s.players.self.scene[0]!.turnEffects.grantedAbilities = [preTarget];
  return s;
}

beforeEach(() => {
  _resetRegistry();
  register(card('HOST'));
  register(card('L5', 5));
  register(card('L6', 6));
});

describe('granted action:pre-target expansion', () => {
  it('adds only active effective level 6+ and feeds engine/UI/AI candidates', () => {
    const s = state();
    const ids = candidates(s, 'host').map(candidate => candidate.uid);
    expect(ids).toContain('active-6');
    expect(ids).not.toContain('active-5');
    // Sleep remains a normal rules/07 target; the grant adds no extra sleep target.
    expect(ids).toContain('sleep-6');
    expect(canActionAgainstChar(s, 'host', 'active-6')).toBe(true);
    expect(canActionAgainstChar(s, 'host', 'active-5')).toBe(false);
    expect(enumerateMoves(s, 'self')).toContainEqual({ kind: 'actionAgainstChar', byUid: 'host', targetUid: 'active-6' });
    expect(enumerateMoves(s, 'self')).not.toContainEqual({ kind: 'actionAgainstChar', byUid: 'host', targetUid: 'active-5' });
  });

  it('survives original-ability disable but expires with turn effects', () => {
    const granted = produce(state(), draft => {
      mutate.char.disableOriginalAbilities(draft, 'host', 'turn');
    });
    expect(candidates(granted, 'host').map(candidate => candidate.uid)).toContain('active-6');
    const cleaned = produce(granted, draft => {
      mutate.char.clearTurnEffects(draft, 'host', 'turn');
    });
    expect(candidates(cleaned, 'host').map(candidate => candidate.uid)).not.toContain('active-6');
  });

  it('continues to suppress printed pre-target text after original-ability disable', () => {
    _resetRegistry();
    register(card('HOST', 1, [preTarget]));
    register(card('L6', 6));
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene.push(sceneChar('HOST', 'host'));
    s.players.opp.scene.push(sceneChar('L6', 'active-6'));
    expect(candidates(s, 'host').map(candidate => candidate.uid)).toContain('active-6');
    const disabled = produce(s, draft => mutate.char.disableOriginalAbilities(draft, 'host', 'turn'));
    expect(candidates(disabled, 'host').map(candidate => candidate.uid)).not.toContain('active-6');
  });
});
