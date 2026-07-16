import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '@/cards';

import {
  resolveCard,
  resolveCase,
  resolveHandCard,
} from '../../meta-app/src/util/tutorialResolvers';

describe('Meta match card display resolvers', () => {
  it('resolves every shipped CardDef without fallback metadata', () => {
    const colors: Record<string, string> = {
      '青': 'blue', '黄': 'yellow', '赤': 'red', '緑': 'green',
      '紫': 'purple', '黒': 'black', '白': 'white',
      blue: 'blue', yellow: 'yellow', red: 'red', green: 'green',
      purple: 'purple', black: 'black', white: 'white',
    };

    for (const card of ALL_CARDS) {
      const expectedName = card.names[0] ?? card.id;
      const expectedColor = colors[card.colors[0] ?? ''] ?? 'blue';
      const displayed = resolveCard(card.id);
      expect(displayed.name, `${card.id}: name`).toBe(expectedName);
      expect(displayed.name, `${card.id}: fallback`).not.toBe('???');
      expect(displayed.color, `${card.id}: color`).toBe(expectedColor);
      expect(displayed.ap, `${card.id}: AP`).toBe(card.ap ?? 0);
      expect(displayed.lp, `${card.id}: LP`).toBe(card.lp ?? 0);
      expect(displayed.lv, `${card.id}: level`).toBe(
        card.kind === 'case' ? (card.caseLevel ?? card.level ?? 0) : (card.level ?? 0),
      );

      if (card.kind === 'character' || card.kind === 'event') {
        const hand = resolveHandCard(card.id);
        expect(hand.name, `${card.id}: hand name`).toBe(expectedName);
        expect(hand.color, `${card.id}: hand color`).toBe(expectedColor);
        expect(hand.type, `${card.id}: hand type`).toBe(card.kind === 'event' ? 'イベント' : 'キャラ');
        expect(hand.cost, `${card.id}: hand cost`).toBe(card.level ?? 0);
        expect(hand.ap, `${card.id}: hand AP`).toBe(card.ap ?? null);
        expect(hand.lp, `${card.id}: hand LP`).toBe(card.lp ?? null);
      }

      if (card.kind === 'case') {
        expect(resolveCase(card.id), `${card.id}: case`).toEqual({
          title: expectedName,
          color: expectedColor,
          level: card.caseLevel ?? card.level ?? 0,
          orientation: undefined,
        });
      }
    }
  });

  it('resolves a CT-D07 character from the all-card catalog', () => {
    expect(resolveCard('D07019')).toEqual({
      name: 'シェリー',
      color: 'black',
      ap: 4000,
      lp: 1,
      lv: 4,
    });
  });

  it('preserves black event and promo character metadata in hand', () => {
    expect(resolveHandCard('D07023')).toMatchObject({
      cardId: 'D07023',
      name: '烏丸蓮耶の影',
      color: 'black',
      type: 'イベント',
      cost: 1,
      lv: 1,
    });
    expect(resolveHandCard('PR164')).toEqual({
      cardId: 'PR164',
      name: '犯人',
      color: 'black',
      type: 'キャラ',
      cost: 2,
      ap: 1000,
      lp: 1,
      lv: 2,
    });
  });

  it('resolves an expansion case outside CT-D08/D11', () => {
    expect(resolveCase('B09113')).toEqual({
      title: '「愛しい愛しい…宿敵さん？」',
      color: 'red',
      level: 7,
      orientation: undefined,
    });
  });
});
