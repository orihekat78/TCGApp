// cards/ct-p03/B03010P 小嶋元太 (キャラ・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【宣言】【スリープ】：レベル6以下のキャラを1枚まで選び、スリープさせる。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
//
// B03010 の絵柄違い (CP)。能力は同一 — base を spread。

import type { CardDef } from '@/engine/types';
import { B03010 } from './B03010.js';

export const B03010P: CardDef = {
  ...B03010,
  id: 'B03010P',
  no: '0268/B03010P',
  rarity: 'CP',
  imageUrl: '1729133048293045.jpg',
};
