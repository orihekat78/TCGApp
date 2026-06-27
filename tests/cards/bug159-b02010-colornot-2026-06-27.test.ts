// BUG-159 fix — B02010 灰原哀 a1「【青】以外の色を持つキャラ」を custom closure (none説) から
// TargetFilter.colorNot:'青' (some説、公式 B08079) へ migration。
//
// 旧実装 `!def.colors.includes('青')` (none説) は 2色{青,赤} キャラを誤除外していた。
// 公式 B08079: 「【X】以外の色を持つ」= X以外の色を1つ以上持つ (2色{X,Y} は Y を持つので該当)。
// 本テストは出荷 AbilityDef の filter 値を実 engine (matchOneFilter) で評価し、2色 decoy が候補化されること
// (= some説、旧 none説なら fail) を 1対1 検証する。
// rules: 15 (まで=0可), 20 (色)。spec: .claude/specs/engine-additive-colornot-filter-design.md
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { B02010 } from '@/cards/ct-p02/B02010';
import type { AbilityDef, CardDef, GameState, Candidate, EffectDescriptor, TargetFilter } from '@/engine/types';

function ch(id: string, colors: string[]): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors, level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const MONO_BLUE = ch('MONO_BLUE', ['青']);
const MONO_RED = ch('MONO_RED', ['赤']);
const TWO_BR = ch('TWO_BR', ['青', '赤']); // 2色{青,赤} — none説なら誤除外、some説なら該当

// B02010 a1 の実 filter を AbilityDef から抽出 (spec の filter 値そのものを検証、再記述しない)。
function a1Filter(): TargetFilter {
  const eff = (B02010.abilities[0] as AbilityDef).effect as EffectDescriptor & { args: { filter: TargetFilter } };
  return eff.args.filter;
}

let s: GameState;
beforeEach(() => {
  resetDefRegistry();
  for (const d of [B02010, MONO_BLUE, MONO_RED, TWO_BR]) registerCardDef(d);
  s = createEmptyGameState();
});

function mof(cardId: string): boolean {
  const sc = sceneChar(cardId, `${cardId}#1`);
  s.players.self.scene = [sc];
  return matchOneFilter(s, cardId, a1Filter(), sc, { kind: 'char', uid: `${cardId}#1`, cardId, player: 'self' } as Candidate);
}

describe('BUG-159 — B02010 a1 が colorNot:青 (some説) で実装されている', () => {
  it('filter は colorNot:青 (custom closure none説ではない)', () => {
    expect(a1Filter()).toEqual({ colorNot: '青' });
    expect('custom' in a1Filter()).toBe(false);
  });
  it('mono-青 は除外', () => {
    expect(mof('MONO_BLUE')).toBe(false);
  });
  it('mono-赤 は該当', () => {
    expect(mof('MONO_RED')).toBe(true);
  });
  it('2色{青,赤} は該当 (BUG-159 fix の核心 — 旧 none説は誤除外していた)', () => {
    expect(mof('TWO_BR')).toBe(true);
  });
});
