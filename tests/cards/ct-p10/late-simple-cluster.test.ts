import { describe, expect, it } from 'vitest';
import { B10080 } from '@/cards/ct-p10/B10080';
import { B10082 } from '@/cards/ct-p10/B10082';
import { B10083 } from '@/cards/ct-p10/B10083';
import { B10085 } from '@/cards/ct-p10/B10085';
import { B10089 } from '@/cards/ct-p10/B10089';
import { B10093 } from '@/cards/ct-p10/B10093';
import { B10095 } from '@/cards/ct-p10/B10095';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const police: CardDef = {
  id: 'P10_POLICE', no: 'P10_POLICE', kind: 'character', names: ['警察'], colors: ['黄'],
  level: 3, ap: 3000, lp: 1, traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

describe('CT-P10 late simple cluster', () => {
  it('B10080 applies its conditional AP penalty only while either scene has Police', () => {
    _resetRegistry(); [B10080, police].forEach(register);
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('B10080', 'three')];
    expect(read.char.ap(state, 'three')).toBe(5000);
    state.players.opp.scene = [sceneChar('P10_POLICE', 'police')];
    expect(read.char.ap(state, 'three')).toBe(3000);
  });

  it('models the official choice, cost, exact filters, and causal gates', () => {
    expect(B10082.abilities[1]).toMatchObject({
      type: 'declared', scope: 'always', limit: { kind: 'turn', n: 1 },
      cost: { kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } },
    });
    expect(B10083.abilities[1]).toMatchObject({
      type: 'declared', scope: 'always', condition: { kind: 'and' },
      cost: { kind: 'flipFaceUpEvidence', n: { min: 3, max: 3 } },
    });
    expect(B10085.abilities[0]).toMatchObject({
      type: 'declared', scope: 'on-partner-area', condition: { kind: 'partnerColor', color: '黒' },
      cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
    });
    expect(B10085.abilities[1]).toMatchObject({
      type: 'triggered', scope: 'on-partner-area', trigger: { hook: 'cutin:used' },
    });
    expect(B10089.abilities[0]).toMatchObject({
      type: 'declared', scope: 'on-scene', condition: { kind: 'partnerColor', color: '黒' },
      cost: { kind: 'removeDeckTop', player: 'self', n: 3 },
    });
    expect(B10093.abilities[0]).toMatchObject({
      type: 'triggered', scope: 'on-scene', condition: { kind: 'caseColor', combine: 'and', color: ['青', '黒'] },
    });
    expect(B10095.abilities).toHaveLength(2);
  });
});
