// cards/pr-01/PR196 ブルーサファイア (event, 絵柄違い) — PR195 と同テキスト (abilities 同一参照)
// rules: PR195.ts 参照
import { PR195 } from './PR195.js';
import type { CardDef } from '@/engine/types';

export const PR196: CardDef = {
  ...PR195,
  id: 'PR196',
  no: '0832/PR196',
  rarity: 'PR',
  imageUrl: '19aaa0572cd12f.jpg',
};
