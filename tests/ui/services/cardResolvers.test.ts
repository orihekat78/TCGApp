// Demo wiring: cardResolvers tests

import { describe, it, expect } from 'vitest';
import {
  createCardResolver,
  createCaseResolver,
  type RawCardsJson,
} from '@/ui/services/cardResolvers';

const sampleSource: RawCardsJson = {
  count: 5,
  cards: [
    {
      cardId: 'P001', cardNum: 'D08001', title: '探偵パートナー',
      type: 'パートナー', color: '青',
      cost: null, ap: null, lp: '1',
    },
    {
      cardId: 'C001', cardNum: 'D08010', title: 'キャラ青',
      type: 'キャラ', color: '青',
      cost: '5', ap: '5000', lp: '1',
    },
    {
      cardId: 'C002', cardNum: 'D11020', title: 'キャラ黄',
      type: 'キャラ', color: '黄',
      cost: '7', ap: '7000', lp: '2',
    },
    {
      cardId: 'EVT01', cardNum: 'D08026', title: 'テスト事件',
      type: '事件', color: '青',
      cost: '7', ap: null, lp: null,
      difficultyFirst: 7, difficultySecond: 6,
    },
    {
      cardId: 'EVT02', cardNum: 'D11021', title: '黄事件',
      type: '事件', color: '黄',
      cost: '6', ap: null, lp: null,
      difficultyFirst: 6, difficultySecond: 5,
    },
  ],
};

describe('createCardResolver', () => {
  it('resolves known character card with parsed AP/LP', () => {
    const resolve = createCardResolver(sampleSource);
    expect(resolve('C001')).toEqual({
      name: 'キャラ青',
      color: 'blue',
      ap: 5000,
      lp: 1,
      lv: 5,
    });
  });

  it('maps Japanese colors to English', () => {
    const resolve = createCardResolver(sampleSource);
    expect(resolve('C002').color).toBe('yellow');
  });

  it('handles null AP/LP (partner card) as 0', () => {
    const resolve = createCardResolver(sampleSource);
    const r = resolve('P001');
    expect(r.ap).toBe(0);
    expect(r.lp).toBe(1);
    expect(r.name).toBe('探偵パートナー');
  });

  it('returns placeholder for unknown cardId', () => {
    const resolve = createCardResolver(sampleSource);
    expect(resolve('UNKNOWN')).toEqual({
      name: '???', color: 'blue', ap: 0, lp: 0, lv: 0,
    });
  });

  it('merges multiple sources by cardId', () => {
    const extra: RawCardsJson = {
      count: 1,
      cards: [{
        cardId: 'X001', cardNum: 'X001', title: '別ソース',
        type: 'キャラ', color: '赤',
        cost: '3', ap: '3000', lp: '2',
      }],
    };
    const resolve = createCardResolver(sampleSource, extra);
    expect(resolve('X001').name).toBe('別ソース');
    expect(resolve('C001').name).toBe('キャラ青');
  });
});

describe('createCaseResolver', () => {
  it('resolves known case card with level', () => {
    const resolve = createCaseResolver(sampleSource);
    expect(resolve('EVT01')).toEqual({
      title: 'テスト事件',
      color: 'blue',
      level: 7,  // max(difficultyFirst=7, difficultySecond=6, cost=7) = 7
    });
  });

  it('uses cost when difficulty fields are missing', () => {
    const src: RawCardsJson = {
      count: 1,
      cards: [{
        cardId: 'EVT-X', cardNum: 'X', title: 'コストのみ事件',
        type: '事件', color: '緑',
        cost: '8', ap: null, lp: null,
      }],
    };
    const resolve = createCaseResolver(src);
    expect(resolve('EVT-X')).toEqual({
      title: 'コストのみ事件',
      color: 'green',
      level: 8,
    });
  });

  it('returns fallback (title=cardId) for unknown', () => {
    const resolve = createCaseResolver(sampleSource);
    expect(resolve('NOT-IN-DATA')).toEqual({
      title: 'NOT-IN-DATA',
      color: 'blue',
      level: 0,
    });
  });

  it('returns fallback when type is not 事件 (e.g. character)', () => {
    const resolve = createCaseResolver(sampleSource);
    expect(resolve('C001').title).toBe('C001');  // C001 is キャラ, not 事件
    expect(resolve('C001').level).toBe(0);
  });
});
