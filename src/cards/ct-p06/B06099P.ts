// cards/ct-p06/B06099P ラム (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 22-qa-action-contact.md
//
// 公式テキスト: B06099 と同一 (parallel rarity 違い)。

import { B06099 } from './B06099.js';
import type { CardDef } from '@/engine/types';

export const B06099P: CardDef = {
  ...B06099,
  id: 'B06099P',
  no: '0716/B06099P',
  imageUrl: '1755684985578196.jpg',
  rarity: 'SRP',
};
