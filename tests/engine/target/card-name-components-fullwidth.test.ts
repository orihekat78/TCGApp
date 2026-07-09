// BUG-178 回帰: 全角＆の複数名カードも rules/19 分割名を持つ (半角 & と同挙動)。
// rules: 19-special-rules.md §キャラの名前が複数あるカード名のルール
import { describe, it, expect } from 'vitest';
import { cardNameComponents } from '@/engine/target/card-def-registry';

describe('cardNameComponents — 全角＆ (BUG-178)', () => {
  it('全角＆で分割名を得る', () => {
    const c = cardNameComponents('江戸川コナン＆工藤新一');
    expect(c).toContain('江戸川コナン');
    expect(c).toContain('工藤新一');
    expect(c).toContain('江戸川コナン＆工藤新一');
  });
  it('半角 & も従来通り', () => {
    const c = cardNameComponents('工藤新一&毛利蘭');
    expect(c).toContain('工藤新一');
    expect(c).toContain('毛利蘭');
  });
  it('3名以上の全角連結も全分割', () => {
    const c = cardNameComponents('江戸川コナン＆毛利蘭＆毛利小五郎');
    expect(c).toEqual(expect.arrayContaining(['江戸川コナン', '毛利蘭', '毛利小五郎']));
  });
});
