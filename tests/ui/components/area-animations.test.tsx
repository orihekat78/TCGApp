// Phase 8.10d: 各エリアの data-card-id 属性確認テスト
//
// CSS keyframe 自体は vitest で検証できないため、key= の元になる data-card-id 属性が
// 各エリアのカード要素に付与されていることを確認する。

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HandZone } from '@/ui/components/HandZone';
import { FileArea } from '@/ui/components/FileArea';
import { RemoveArea } from '@/ui/components/RemoveArea';
import type { FileCard } from '@/engine/types/game-state';

describe('Phase 8.10d: area card data-card-id attributes', () => {
  it('HandZone: each card has data-card-id (expanded mode)', () => {
    const cards = [
      { cardId: 'A1', name: 'A', color: 'blue' as const, type: 'キャラ' as const,
        cost: 1, ap: 1000, lp: 1000, lv: 1 },
      { cardId: 'B2', name: 'B', color: 'red' as const, type: 'イベント' as const,
        cost: 2, ap: null, lp: null, lv: 2 },
    ];
    const html = renderToString(<HandZone cards={cards} expanded={true} />);
    expect(html).toContain('data-card-id="A1"');
    expect(html).toContain('data-card-id="B2"');
  });

  it('FileArea: assisted partner card has data-card-id', () => {
    const fileCards: FileCard[] = [
      { type: 'assisted-partner', cardId: 'P1', color: 'blue' },
      { type: 'card-back' },
      { type: 'card-back' },
    ];
    const html = renderToString(
      <FileArea cards={fileCards} side="self" resolveCard={() => ({ name: 'X', color: 'blue', ap: 0, lp: 0, lv: 0 })} />,
    );
    expect(html).toContain('data-card-id="P1"');
  });

  it('RemoveArea: top card has data-card-id', () => {
    const html = renderToString(
      <RemoveArea cards={['removed-1', 'removed-2']} side="self"
        resolveCard={(id) => ({ name: id, color: 'red', ap: 0, lp: 0, lv: 0 })} />,
    );
    // 一番上のカード (最後にリムーブされた) が表示される
    expect(html).toContain('data-card-id="removed-2"');
  });
});
