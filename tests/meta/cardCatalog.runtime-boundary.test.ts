import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const workspace = resolve(import.meta.dirname, '../..');
const catalogEntrypoints = [
  'meta-app/src/data/cardPool.ts',
  'meta-app/src/stubs/engineStub.ts',
  'meta-app/src/hooks/useCatalogCardImage.ts',
  'meta-app/src/components/CatalogCardArt.tsx',
  'meta-app/src/components/CatalogCardExpandModal.tsx',
  'meta-app/src/shared/MetaCard.tsx',
  'meta-app/src/screens/CardsScreen.tsx',
  'meta-app/src/screens/DeckEditor.tsx',
] as const;

describe('meta static card catalog runtime boundary', () => {
  it('keeps DECK and CARDS catalog entrypoints outside engine card modules', async () => {
    for (const entrypoint of catalogEntrypoints) {
      const source = await readFile(resolve(workspace, entrypoint), 'utf8');
      expect(source).not.toMatch(/from\s+['"]@\/cards(?:\/index)?['"]/);
      expect(source).not.toMatch(/from\s+['"]@\/engine(?:\/|['"])/);
      expect(source).not.toMatch(/from\s+['"]@\/ui\/components\/(?:CardArt|CardExpandModal)['"]/);
      expect(source).not.toMatch(/from\s+['"]@\/ui\/hooks\/useCardOrientation['"]/);
    }
  });

  it('imports the static catalog without registering engine cards', async () => {
    vi.resetModules();
    const { engine } = await import('@/engine');
    engine.cards._resetRegistry();

    await import('../../meta-app/src/data/cardPool');
    await import('../../meta-app/src/stubs/engineStub');

    expect(engine.cards.all()).toEqual([]);
  });

  it('retains the exact shipped catalog count and representative metadata', async () => {
    const { CARD_POOL } = await import('../../meta-app/src/data/cardPool');

    expect(CARD_POOL).toHaveLength(2256);
    expect(CARD_POOL.find((card) => card.num === 'D08001')).toMatchObject({
      id: 'P001', name: '江戸川コナン', type: 'partner', color: 'blue',
      colors: ['blue'], lp: 1, rarity: 'D', keywords: ['アシスト'],
      imagePath: '1743743093420786.jpg',
    });
    expect(CARD_POOL.find((card) => card.num === 'D08026')).toMatchObject({
      id: '0499', name: '青の古城探索事件', type: 'case', level: 7,
      difficultyFirst: 7, difficultySecond: 6, features: ['古城'],
    });
    expect(CARD_POOL.find((card) => card.num === 'B09100')).toMatchObject({
      id: '1039', name: '犯人', type: 'character', cost: 8, ap: 7000,
      deckLimit: 'unlimited',
    });
  });
});
