import { beforeEach, describe, expect, it } from 'vitest';
import { B10050 } from '@/cards/ct-p10/B10050';
import { B10052 } from '@/cards/ct-p10/B10052';
import { B10060 } from '@/cards/ct-p10/B10060';
import { B10074 } from '@/cards/ct-p10/B10074';
import { B10099 } from '@/cards/ct-p10/B10099';
import { B10102 } from '@/cards/ct-p10/B10102';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { matchOneFilter } from '@/engine/target/candidates';
import { sceneChar } from '../../helpers/fixtures';
import type { Candidate, CardDef, TargetFilter } from '@/engine/types';

const FILTER_KEY = 'hasNoOriginalAbilityExceptIcons';
const PRINTED: CardDef = {
  id: 'ORIGINAL_PRINTED', no: 'QA/PRINTED', kind: 'character', names: ['印字能力あり'], colors: ['赤', '黄'],
  level: 9, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', description: '印字能力' }],
};
const VANILLA: CardDef = { ...PRINTED, id: 'ORIGINAL_VANILLA', no: 'QA/VANILLA', names: ['印字能力なし'], abilities: [] };

function findFilter(value: unknown): TargetFilter | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record[FILTER_KEY])) return record as TargetFilter;
  for (const child of Object.values(record)) {
    const found = findFilter(child);
    if (found) return found;
  }
  return undefined;
}

function matches(card: CardDef, target: CardDef, disabledOriginal: boolean, externallyGranted: boolean): boolean {
  const filter = findFilter(card.abilities);
  if (!filter) return false;
  const state = createEmptyGameState();
  const char = sceneChar(target.id, `${target.id}#1`, { keywordOverrides: { granted: [], disabledOriginal } });
  if (externallyGranted) char.turnEffects.grantedAbilities = [{ id: 'external', type: 'continuous', scope: 'on-scene', description: '外部付与' }];
  state.players.self.scene = [char];
  const candidate: Candidate = { kind: 'char', uid: char.uid, cardId: target.id, player: 'self' };
  return matchOneFilter(state, target.id, filter, char, candidate);
}

beforeEach(() => {
  _resetRegistry();
  register(PRINTED);
  register(VANILLA);
});

describe('CT-P10 original-ability official Q&A', () => {
  it('keeps printed abilities while disabled and ignores externally granted abilities', () => {
    // qa: card:B10050:98e82fae32a43d9b6de8c7fd8289dcf4565f2dada1498f0760f5ba9d0cf8ae17
    expect(matches(B10050, PRINTED, true, false)).toBe(false);
    // qa: card:B10050:778f2ec6d361908c4a67f350b59be3fb6673daac7dd65787323343b2748e3208
    expect(matches(B10050, VANILLA, false, true)).toBe(true);
    // qa: card:B10052:98e82fae32a43d9b6de8c7fd8289dcf4565f2dada1498f0760f5ba9d0cf8ae17
    expect(matches(B10052, PRINTED, true, false)).toBe(false);
    // qa: card:B10052:778f2ec6d361908c4a67f350b59be3fb6673daac7dd65787323343b2748e3208
    expect(matches(B10052, VANILLA, false, true)).toBe(true);
    // qa: card:B10060:98e82fae32a43d9b6de8c7fd8289dcf4565f2dada1498f0760f5ba9d0cf8ae17
    expect(matches(B10060, PRINTED, true, false)).toBe(false);
    // qa: card:B10060:778f2ec6d361908c4a67f350b59be3fb6673daac7dd65787323343b2748e3208
    expect(matches(B10060, VANILLA, false, true)).toBe(true);
    // qa: card:B10074:98e82fae32a43d9b6de8c7fd8289dcf4565f2dada1498f0760f5ba9d0cf8ae17
    expect(matches(B10074, PRINTED, true, false)).toBe(false);
    // qa: card:B10074:778f2ec6d361908c4a67f350b59be3fb6673daac7dd65787323343b2748e3208
    expect(matches(B10074, VANILLA, false, true)).toBe(true);
    // qa: card:B10099:98e82fae32a43d9b6de8c7fd8289dcf4565f2dada1498f0760f5ba9d0cf8ae17
    expect(matches(B10099, PRINTED, true, false)).toBe(false);
    // qa: card:B10102:98e82fae32a43d9b6de8c7fd8289dcf4565f2dada1498f0760f5ba9d0cf8ae17
    expect(matches(B10102, PRINTED, true, false)).toBe(false);
    // qa: card:B10102:778f2ec6d361908c4a67f350b59be3fb6673daac7dd65787323343b2748e3208
    expect(matches(B10102, VANILLA, false, true)).toBe(true);
  });
});
