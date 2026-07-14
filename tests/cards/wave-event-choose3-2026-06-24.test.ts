// wave event-choose3 (2026-06-24, engine変更0) — B08075 / B08075P ブライダルは女が主役 構造忠実性。
//
// 公式テキスト: 以下から3つまで選んで行う。（上から順に行う）
//   ① 〚カード名［佐藤美和子］〛を1枚まで選び、アクティブにする。
//   ② 〚カード名［高木渉］〛を1枚まで選び、ターン終了時まで〚突撃［キャラ］〛を与える。
//   ③ デッキ上4枚を見て〚佐藤美和子］か〚高木渉］を1枚まで手札に加え、残りを好きな順番でデッキの下に移す。
// 実証元 exemplar: B08029(event-use matcher) / B06060・D04010(sceneSetState+$pick) / D02013(charGrantKeyword+$pick) /
//   B08020(deckRevealUntil upTo + handAddFromDeck + deckToBottomBound) / B03016・B07020(filterAny cross-name) / B09065(optional).
// 「3つまで選んで」= 各 option を optional 包装 (③ は take-0 でも deck 並び替えの副作用 → skip 可が必須)。
// rules: 13/15/17/20/26。

import { describe, it, expect } from 'vitest';
import { B08075 } from '@/cards/ct-p08/B08075';
import { B08075P } from '@/cards/ct-p08/B08075P';
import type { CardDef } from '@/engine/types';



function checkAbility(card: CardDef) {
  const a1: any = card.abilities[0];
  // event 自己使用 trigger
  expect(card.kind).toBe('event');
  expect(a1.type).toBe('triggered');
  expect(a1.scope).toBe('on-hand');
  expect(a1.trigger.hook).toBe('effect:declared');
  expect(a1.trigger.selfOnly).toBe(true);
  // matcher: event-use のみ true
  expect(a1.trigger.matcher({ kind: 'event-use', cardId: card.id })).toBe(true);
  expect(a1.trigger.matcher({ kind: 'declared' })).toBe(false);
  expect(a1.trigger.matcher(undefined)).toBeFalsy();
  // 効果未達条件 (【パートナー】等) 無し = 無条件発火
  expect(a1.condition).toBeUndefined();

  // 上から順に3 option (各 optional)
  expect(a1.effect.kind).toBe('sequence');
  expect(a1.effect.steps).toHaveLength(3);
  const [o1, o2, o3] = a1.effect.steps;
  expect(o1.kind).toBe('optional');
  expect(o2.kind).toBe('optional');
  expect(o3.kind).toBe('optional');

  // ① 佐藤美和子 1枚まで → active
  const e1 = o1.effect;
  expect(e1.verb).toBe('sceneSetState');
  expect(e1.args).toMatchObject({ uid: '$pick', state: 'active' });
  expect(e1.args.target.query).toMatchObject({ area: 'scene', side: 'self', filter: { cardName: '佐藤美和子' } });
  expect(e1.args.target.n).toEqual({ min: 0, max: 1 });

  // ② 高木渉 1枚まで → 突撃[キャラ] turn
  const e2 = o2.effect;
  expect(e2.verb).toBe('charGrantKeyword');
  expect(e2.args).toMatchObject({ uid: '$pick', kw: '突撃[キャラ]', scope: 'turn' });
  expect(e2.args.target.query).toMatchObject({ area: 'scene', side: 'self', filter: { cardName: '高木渉' } });
  expect(e2.args.target.n).toEqual({ min: 0, max: 1 });

  // ③ deckRevealUntil(upTo, filterAny 2名, maxN4) → cond(handAdd) → deckToBottomBound
  expect(o3.effect.kind).toBe('sequence');
  const [s1, s2, s3] = o3.effect.steps;
  expect(s1.verb).toBe('deckRevealUntil');
  expect(s1.args).toMatchObject({ chooseMatch: 'upTo', player: 'self', maxN: 4, bind: '$revealed', bindMatch: '$matched' });
  expect(s1.args.filterAny).toEqual([
    { cardName: '佐藤美和子', kind: 'character' },
    { cardName: '高木渉', kind: 'character' },
  ]);
  expect(s2.kind).toBe('conditional');
  expect(s2.if).toEqual({ kind: 'bound', key: '$matched', presence: 'matched' });
  expect(s2.then).toMatchObject({ verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } });
  expect(s3).toMatchObject({ verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } });
}

describe('wave event-choose3 — B08075 ブライダルは女が主役', () => {
  it('B08075 構造忠実性 (event-use matcher + 3 optional option)', () => {
    checkAbility(B08075);
    expect(B08075).toMatchObject({ id: 'B08075', kind: 'event', colors: ['黄'], level: 5, rarity: 'C' });
    expect(B08075.no).toBe('0912/B08075');
  });
  it('B08075P パラレル = 同一 ability、metadata のみ差分', () => {
    checkAbility(B08075P);
    expect(B08075P).toMatchObject({ id: 'B08075P', kind: 'event', colors: ['黄'], level: 5, rarity: 'CP' });
    expect(B08075P.no).toBe('0912/B08075P');
    // ability 構造は rep と同一 (JSON 化で matcher 関数を除いた骨格比較)
    const strip = (c: CardDef) => JSON.stringify(c.abilities, (k, v) => (k === 'matcher' ? '[fn]' : v));
    expect(strip(B08075P)).toBe(strip(B08075));
  });
});
