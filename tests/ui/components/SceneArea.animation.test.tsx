// Phase 8.10c: SceneArea animation attributes test
//
// CSS keyframes 自体は vitest で検証できないため、UI 側で必要な属性
// (data-state / data-uid) が付与されることを確認する。

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SceneArea } from '@/ui/components/SceneArea';
import type { SceneCharacter } from '@/engine/types/game-state';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

function makeChar(uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return {
    cardId: 'C1',
    uid,
    state,
    isNamed: false,
    enterOrder: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

const resolveCard = (_cardId: string): ResolvedCardMeta => ({
  name: 'テストカード',
  color: 'blue',
  ap: 1000,
  lp: 1000,
  lv: 1,
});

describe('SceneArea animation attributes (Phase 8.10c)', () => {
  it('emits data-state on each scene card (active / sleep / stun)', () => {
    const chars = [
      makeChar('u1', 'active'),
      makeChar('u2', 'sleep'),
      makeChar('u3', 'stun'),
    ];
    const html = renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    );
    expect(html).toContain('data-state="active"');
    expect(html).toContain('data-state="sleep"');
    expect(html).toContain('data-state="stun"');
  });

  it('each scene card has a stable data-uid (for key + entry animation)', () => {
    const chars = [makeChar('alpha-uid'), makeChar('beta-uid')];
    const html = renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    );
    expect(html).toContain('data-uid="alpha-uid"');
    expect(html).toContain('data-uid="beta-uid"');
  });
});
