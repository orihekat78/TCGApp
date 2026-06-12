// Phase 7 Task 7.4: SceneArea snapshot/behavior tests
// renderToString で server-side snapshot (jsdom 経由のレンダラを使わない軽量パス)

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { SceneCharacter } from '@/engine/types/game-state.js';
import { makeChar as baseChar } from '../../helpers/fixtures';
import {
  SceneArea,
  type ResolvedCardMeta,
} from '@/ui/components/SceneArea';

// ---- test fixtures ----

const META_DB: Record<string, ResolvedCardMeta> = {
  'c-blue':   { name: 'テスト青',   color: 'blue',   ap: 5000, lp: 2, lv: 5 },
  'c-yellow': { name: 'テスト黄',   color: 'yellow', ap: 4000, lp: 3, lv: 4 },
  'c-red':    { name: 'テスト赤',   color: 'red',    ap: 6000, lp: 1, lv: 6 },
  'c-green':  { name: 'テスト緑',   color: 'green',  ap: 3000, lp: 4, lv: 3 },
  'c-purple': { name: 'テスト紫',   color: 'purple', ap: 7000, lp: 0, lv: 7 },
};
const resolveCard = (cardId: string): ResolvedCardMeta => {
  return META_DB[cardId] ?? { name: '???', color: 'blue', ap: 0, lp: 0, lv: 0 };
};

// React SSR は隣接 text 子要素の間に `<!-- -->` を挿入する。
// "1 / 5" は SSR 出力では "1<!-- --> / <!-- -->5" になるため、
// アサーション側でコメントを除去してから match する。
function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function makeChar(overrides: Partial<SceneCharacter> & Pick<SceneCharacter, 'cardId' | 'uid'>): SceneCharacter {
  return baseChar({ enterOrder: 0, ...overrides });
}

// ---- tests ----

describe('SceneArea', () => {
  it('renders 5 empty slots when characters is empty', () => {
    const html = strip(renderToString(
      <SceneArea characters={[]} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/scene-area side-self/);
    expect(html).toMatch(/0 \/ 5/);
    expect(html.match(/slot-empty/g)?.length).toBe(5);
    expect(html).not.toMatch(/class="card /);
  });

  it('renders 3 chars + 2 empty slots (partial fill)', () => {
    const chars: SceneCharacter[] = [
      makeChar({ cardId: 'c-blue',   uid: 'u1', enterOrder: 0 }),
      makeChar({ cardId: 'c-yellow', uid: 'u2', enterOrder: 1, state: 'sleep' }),
      makeChar({ cardId: 'c-red',    uid: 'u3', enterOrder: 2, state: 'stun' }),
    ];
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/3 \/ 5/);
    expect(html.match(/slot-empty/g)?.length).toBe(2);
    expect(html).toMatch(/data-uid="u1"/);
    expect(html).toMatch(/data-uid="u2"/);
    expect(html).toMatch(/color-blue/);
    expect(html).toMatch(/color-yellow.*sleep/s);
    expect(html).toMatch(/color-red.*stun/s);
  });

  it('renders 5 chars (full, no empty slots)', () => {
    const chars: SceneCharacter[] = (['c-blue','c-yellow','c-red','c-green','c-purple'] as const).map((id, i) =>
      makeChar({ cardId: id, uid: `u${i}`, enterOrder: i }),
    );
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/5 \/ 5/);
    expect(html).not.toMatch(/slot-empty/);
  });

  // BUG-110: カード下の AP/LP は base ではなく「修正反映後の有効値」を表示する。
  it('resolveCharStats が与えられたとき、修正後の有効 AP/LP を表示し modified クラスを付与する (BUG-110)', () => {
    const chars: SceneCharacter[] = [makeChar({ cardId: 'c-blue', uid: 'u1', enterOrder: 0 })]; // base ap5000 lp2
    const html = strip(renderToString(
      <SceneArea
        characters={chars}
        side="self"
        resolveCard={resolveCard}
        resolveCharStats={(uid) => (uid === 'u1' ? { ap: 7000, lp: 3 } : undefined)}
      />,
    ));
    // base (5000/2) ではなく 有効値 (7000/3) を表示する
    expect(html).toMatch(/class="ap modified"[^>]*>7000/);
    expect(html).toMatch(/class="lp modified"[^>]*>3/);
    expect(html).not.toMatch(/>5000</);
    // buff (有効値 > base) は data-mod="up"
    expect(html).toMatch(/data-mod="up"/);
  });

  it('debuff (有効値 < base) は data-mod="down" を付ける', () => {
    const chars: SceneCharacter[] = [makeChar({ cardId: 'c-red', uid: 'u1', enterOrder: 0 })]; // base ap6000
    const html = strip(renderToString(
      <SceneArea
        characters={chars}
        side="self"
        resolveCard={resolveCard}
        resolveCharStats={() => ({ ap: 5000, lp: 1 })}
      />,
    ));
    expect(html).toMatch(/class="ap modified"[^>]*>5000/);
    expect(html).toMatch(/data-mod="down"/);
  });

  it('resolveCharStats が base と同値なら modified クラスを付けない', () => {
    const chars: SceneCharacter[] = [makeChar({ cardId: 'c-blue', uid: 'u1', enterOrder: 0 })]; // base ap5000 lp2
    const html = strip(renderToString(
      <SceneArea
        characters={chars}
        side="self"
        resolveCard={resolveCard}
        resolveCharStats={() => ({ ap: 5000, lp: 2 })}
      />,
    ));
    expect(html).toMatch(/class="ap"[^>]*>5000/);
    expect(html).toMatch(/class="lp"[^>]*>2/);
    expect(html).not.toMatch(/modified/);
  });

  it('applies side-opp class on opponent side', () => {
    const html = strip(renderToString(
      <SceneArea characters={[]} side="opp" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/scene-area side-opp/);
    expect(html).toMatch(/data-side="opp"/);
  });

  it('sorts characters by enterOrder ascending', () => {
    const chars: SceneCharacter[] = [
      makeChar({ cardId: 'c-blue',   uid: 'later',  enterOrder: 5 }),
      makeChar({ cardId: 'c-yellow', uid: 'middle', enterOrder: 3 }),
      makeChar({ cardId: 'c-red',    uid: 'first',  enterOrder: 1 }),
    ];
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    ));
    const firstIdx  = html.indexOf('data-uid="first"');
    const middleIdx = html.indexOf('data-uid="middle"');
    const laterIdx  = html.indexOf('data-uid="later"');
    expect(firstIdx).toBeGreaterThan(0);
    expect(firstIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(laterIdx);
  });

  it('renders named/set/stack badges when applicable', () => {
    const chars: SceneCharacter[] = [
      makeChar({
        cardId: 'c-blue', uid: 'badged',
        isNamed: true,
        setCards: [{ cardId: 'x', faceUp: true }, { cardId: 'y', faceUp: false }],
        stackedCards: 2,
      }),
    ];
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/named-badge[^>]*>名</);
    expect(html).toMatch(/set-badge[^>]*>\+2</);
    // stackedCards=2 → "×3" (visible top + 2 underneath)
    expect(html).toMatch(/stack-badge[^>]*>×3</);
  });

  it('respects apOverride and lpOverride', () => {
    const chars: SceneCharacter[] = [
      makeChar({ cardId: 'c-blue', uid: 'u1', apOverride: 9999, lpOverride: 0 }),
    ];
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    ));
    // BUG-110: apOverride/lpOverride も印字 base と異なる修正なので modified 表示になる。
    expect(html).toMatch(/class="ap modified"[^>]*>9999</);
    expect(html).toMatch(/class="lp modified"[^>]*>0</);
  });

  it('truncates to maxSlots when characters exceed limit', () => {
    const chars: SceneCharacter[] = Array.from({ length: 7 }).map((_, i) =>
      makeChar({ cardId: 'c-blue', uid: `u${i}`, enterOrder: i }),
    );
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} />,
    ));
    // default maxSlots=5: should render exactly 5 cards
    expect(html.match(/class="card /g)?.length).toBe(5);
    expect(html).toMatch(/5 \/ 5/);
    expect(html).not.toMatch(/data-uid="u5"/);
    expect(html).not.toMatch(/data-uid="u6"/);
  });

  it('respects custom maxSlots prop', () => {
    const chars: SceneCharacter[] = [
      makeChar({ cardId: 'c-blue', uid: 'u1', enterOrder: 0 }),
    ];
    const html = strip(renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} maxSlots={3} />,
    ));
    expect(html).toMatch(/1 \/ 3/);
    expect(html.match(/slot-empty/g)?.length).toBe(2);
  });
});
