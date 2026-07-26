import { beforeEach, describe, expect, it } from 'vitest';
import { B10024, B10024P } from '@/cards/ct-p10/B10024';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide, resetPendingEffectSession } from '@/engine/effect/pending-state';
import { _resetRegistry as resetDefRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, EffectCtx } from '@/engine/types';

const police: CardDef = { id: 'POLICE', no: 'x/POLICE', kind: 'character', names: ['POLICE'], colors: ['緑'], level: 3, ap: 3000, lp: 1, traits: ['警察'], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const victim: CardDef = { id: 'VICTIM', no: 'x/VICTIM', kind: 'character', names: ['VICTIM'], colors: ['青'], level: 4, ap: 8000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const overAp: CardDef = { ...victim, id: 'OVER_AP', no: 'x/OVER_AP', ap: 9000 };

function ctx(abilityId: string): EffectCtx {
  return { source: { player: 'self', uid: 'otaki', cardId: 'B10024', abilityId, area: 'scene' }, bindings: {} };
}

beforeEach(() => {
  resetDefRegistry(); [B10024, B10024P, police, victim, overAp].forEach(register);
  _clearPendingEffectPickQueue(); resetPendingEffectSession();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B10024 大滝悟郎', () => {
  it('a1 reveals one police character before an AP≤8000 removal, and revealing zero does not continue', () => {
    const a1 = B10024.abilities.find((ability) => ability.id === 'a1')!;
    expect(a1).toMatchObject({ type: 'triggered', trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'partnerColor', color: '緑' } });
    expect(a1.effect).toMatchObject({ kind: 'chain', steps: [
      { kind: 'atom', verb: 'handReveal', args: { player: 'self', max: 1, bind: '$revealed', filter: { kind: 'character', trait: '警察' } } },
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, filter: { kind: 'character', apMax: 8000 } } },
    ] });
    expect(B10024.abilities.find((ability) => ability.id === 'a3')).toMatchObject({
      type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
      effect: { kind: 'choice', options: [{ kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep' } }] },
    });
  });

  it('a1 human continuation: selected police reveal leaves hand unchanged, then removes only an AP≤8000 target', () => {
    const state = createEmptyGameState();
    state.players.self.hand = ['POLICE', 'POLICE'];
    state.players.self.scene = [sceneChar('B10024', 'otaki')];
    state.players.opp.scene = [sceneChar('VICTIM', 'victim'), sceneChar('OVER_AP', 'over')];
    runEffect(state, B10024.abilities.find((ability) => ability.id === 'a1')!.effect!, ctx('a1'));
    const reveal = _drainPendingEffectPickSide();
    expect(reveal?.atomVerb).toBe('handReveal');
    expect(reveal?.candidates.map((candidate) => candidate.cardId)).toEqual(['POLICE', 'POLICE']);
    applyPickAndContinuation(state, reveal!, reveal!.candidates[1]!.uid);
    expect(state.players.self.hand).toEqual(['POLICE', 'POLICE']);
    const target = _drainPendingEffectPickSide();
    expect(target?.candidates.map((candidate) => candidate.uid)).toEqual(['otaki', 'victim']);
    applyPickAndContinuation(state, target!, 'victim');
    expect(state.players.opp.scene.map((char) => char.uid)).toEqual(['over']);
  });

  it('a1: no police reveal has no removal continuation; target disappearance is revalidated while source disappearance does not erase a resolved effect', () => {
    const noReveal = createEmptyGameState();
    noReveal.players.self.scene = [sceneChar('B10024', 'otaki')];
    noReveal.players.opp.scene = [sceneChar('VICTIM', 'victim')];
    runEffect(noReveal, B10024.abilities.find((ability) => ability.id === 'a1')!.effect!, ctx('a1'));
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(noReveal.players.opp.scene).toHaveLength(1);

    const state = createEmptyGameState();
    state.players.self.hand = ['POLICE'];
    state.players.self.scene = [sceneChar('B10024', 'otaki')];
    state.players.opp.scene = [sceneChar('VICTIM', 'victim')];
    runEffect(state, B10024.abilities.find((ability) => ability.id === 'a1')!.effect!, ctx('a1'));
    const reveal = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(state, reveal, reveal.candidates[0]!.uid);
    const target = _drainPendingEffectPickSide()!;
    state.players.opp.scene = [];
    applyPickAndContinuation(state, target, 'victim');
    expect(state.players.opp.scene).toEqual([]);

    const sourceGone = createEmptyGameState();
    sourceGone.players.self.hand = ['POLICE'];
    sourceGone.players.self.scene = [sceneChar('B10024', 'otaki')];
    sourceGone.players.opp.scene = [sceneChar('VICTIM', 'victim')];
    runEffect(sourceGone, B10024.abilities.find((ability) => ability.id === 'a1')!.effect!, ctx('a1'));
    const sourceReveal = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(sourceGone, sourceReveal, sourceReveal.candidates[0]!.uid);
    const sourceGoneTarget = _drainPendingEffectPickSide()!;
    sourceGone.players.self.scene = [];
    applyPickAndContinuation(sourceGone, sourceGoneTarget, 'victim');
    expect(sourceGone.players.opp.scene).toEqual([]);
  });

  it('a2 human continuation sets deck top face-down on the selected police host, and fails closed for vanished host or empty deck', () => {
    const a2 = B10024.abilities.find((ability) => ability.id === 'a2')!;
    const state = createEmptyGameState();
    state.players.self.deck = ['DUP', 'DUP'];
    state.players.self.scene = [sceneChar('B10024', 'otaki'), sceneChar('POLICE', 'host')];
    runEffect(state, a2.effect!, ctx('a2'));
    const host = _drainPendingEffectPickSide();
    expect(host?.atomVerb).toBe('charSetCard');
    applyPickAndContinuation(state, host!, 'host');
    expect(state.players.self.scene.find((char) => char.uid === 'host')?.setCards).toMatchObject([{ cardId: 'DUP', faceUp: false }]);

    const hostGone = createEmptyGameState();
    hostGone.players.self.deck = ['DUP'];
    hostGone.players.self.scene = [sceneChar('B10024', 'otaki'), sceneChar('POLICE', 'host')];
    runEffect(hostGone, a2.effect!, ctx('a2'));
    const vanishedPick = _drainPendingEffectPickSide()!;
    hostGone.players.self.scene = hostGone.players.self.scene.filter((char) => char.uid !== 'host');
    applyPickAndContinuation(hostGone, vanishedPick, 'host');
    expect(hostGone.players.self.deck).toEqual(['DUP']);

    const emptyDeck = createEmptyGameState();
    emptyDeck.players.self.scene = [sceneChar('B10024', 'otaki'), sceneChar('POLICE', 'host')];
    runEffect(emptyDeck, a2.effect!, ctx('a2'));
    const emptyDeckPick = _drainPendingEffectPickSide()!;
    applyPickAndContinuation(emptyDeck, emptyDeckPick, 'host');
    expect(emptyDeck.players.self.scene.find((char) => char.uid === 'host')?.setCards).toEqual([]);
  });

  it('P differs only by printing metadata', () => {
    expect({ ...B10024P, id: B10024.id, no: B10024.no, rarity: B10024.rarity, imageUrl: B10024.imageUrl }).toEqual(B10024);
  });
});
