// hybrid-batch2 probe — B05012 恩田遼平 a2 継続 grantNames/grantTraits (wave-6 P37 primitive の実カード配線)。
// 機構自体は tests/cards/engine-additive-wave6-trait-name-grant.test.ts が網羅 —
// ここでは実 CardDef が read.char.names/traits + candidates cardName filter で効くことのみ実測。
// rules: 19-special-rules.md (分割名/名前追加), 24-qa-naming-stun.md (常時有効型),
//        23-qa-disguise-cutin.md (変装引継なし = 元々の能力、Q&A)。
import { describe, it, expect, beforeEach } from 'vitest';
import { char as charRead } from '@/engine/read/char';
import { candidates } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../../helpers/fixtures';
import { B05012 } from '@/cards/ct-p05/B05012';
import type { GameState } from '@/engine/types';

const ctxSelf = makeCtx({ source: { player: 'self', uid: 'u-onda', area: 'scene' } });

function stateWithOnda(): GameState {
  const s = createEmptyGameState();
  s.players.self.scene.push(sceneChar('B05012', 'u-onda'));
  // decoy: grant を持たない同色キャラ (候補混入チェック用)
  s.players.self.scene.push(sceneChar('DECOY05012', 'u-decoy'));
  return s;
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(B05012);
  registerCardDef({ id: 'DECOY05012', no: '9/DECOY05012', kind: 'character', names: ['decoy'], colors: ['青'], level: 3, ap: 1000, lp: 1, traits: ['大学生'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
});

describe('B05012 a2 — 毛利小五郎としても扱い、特徴[探偵]を持つ (現場)', () => {
  it('read.char.names が 印字名 ∪ [毛利小五郎] を返す', () => {
    const s = stateWithOnda();
    const names = charRead.names(s, 'u-onda');
    expect(names).toContain('恩田遼平');
    expect(names).toContain('毛利小五郎');
  });

  it('read.char.traits が 探偵 を含む', () => {
    const s = stateWithOnda();
    expect(charRead.traits(s, 'u-onda')).toContain('探偵');
  });

  it('candidates cardName:[毛利小五郎] filter に現場の B05012 が一致し、decoy は入らない', () => {
    const s = stateWithOnda();
    const uids = candidates(s, { kind: 'all', query: { area: 'scene', side: 'self', filter: { cardName: '毛利小五郎' } } } as never, ctxSelf)
      .filter((c) => c.kind === 'char')
      .map((c) => (c as { uid: string }).uid);
    expect(uids).toContain('u-onda');
    expect(uids).not.toContain('u-decoy');
  });

  it('candidates trait:[探偵] filter にも一致する', () => {
    const s = stateWithOnda();
    const uids = candidates(s, { kind: 'all', query: { area: 'scene', side: 'self', filter: { trait: '探偵' } } } as never, ctxSelf)
      .filter((c) => c.kind === 'char')
      .map((c) => (c as { uid: string }).uid);
    expect(uids).toContain('u-onda');
    expect(uids).not.toContain('u-decoy');
  });
});
