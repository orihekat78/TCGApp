// tests/ui/components/SceneArea.activepop — アクティブカード「ぴこんポップ」(Task2)
// activeCardUid に一致する現場カードへ is-active-pop クラス + 行動チップを付与し、他カードには付かないこと。
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { SceneCharacter } from '@/engine/types/game-state.js';
import { makeChar as baseChar } from '../../helpers/fixtures';
import { SceneArea, type ResolvedCardMeta } from '@/ui/components/SceneArea';

const META: Record<string, ResolvedCardMeta> = {
  'c-blue': { name: 'テスト青', color: 'blue', ap: 5000, lp: 2, lv: 5 },
  'c-yellow': { name: 'テスト黄', color: 'yellow', ap: 4000, lp: 3, lv: 4 },
};
const resolveCard = (id: string): ResolvedCardMeta => META[id] ?? { name: '?', color: 'blue', ap: 0, lp: 0, lv: 0 };
const mk = (o: Partial<SceneCharacter> & Pick<SceneCharacter, 'cardId' | 'uid'>) => baseChar({ enterOrder: 0, ...o });
const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('SceneArea activeCardUid ぴこんポップ', () => {
  const chars: SceneCharacter[] = [
    mk({ cardId: 'c-blue', uid: 'u1', enterOrder: 0 }),
    mk({ cardId: 'c-yellow', uid: 'u2', enterOrder: 1 }),
  ];

  it('一致カードのみ is-active-pop + チップ、他カードには付かない', () => {
    const html = renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} activeCardUid="u1" activeCardLabel="効果解決" />,
    );
    expect(count(html, 'is-active-pop')).toBe(1);
    expect(html).toContain('card color-blue is-active-pop'); // u1 (青) が pop
    expect(html).toContain('効果解決'); // チップ label
  });

  it('activeCardUid 無し → pop もチップも無し', () => {
    const html = renderToString(<SceneArea characters={chars} side="self" resolveCard={resolveCard} />);
    expect(count(html, 'is-active-pop')).toBe(0);
    expect(html).not.toContain('card-activity-chip');
  });

  it('盤面に無い uid → no-op (pop 無し)', () => {
    const html = renderToString(
      <SceneArea characters={chars} side="self" resolveCard={resolveCard} activeCardUid="ghost" activeCardLabel="x" />,
    );
    expect(count(html, 'is-active-pop')).toBe(0);
  });
});
