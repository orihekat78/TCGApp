// cards/ct-p03/B03015P 津川秀治 (キャラ・パラレル) — catalog-reuse batch
// rules: 03-field-areas.md, 09-cutin-disguise.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【カットイン】AP5000以下のキャラを1枚まで選び、スリープさせる。（コンタクト中に手札からリムーブして使う）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）AP5000以下のキャラを1枚まで選び、スリープさせる。
//
// B03015 の絵柄違い (CP)。能力は同一 — base を spread。

import type { CardDef } from '@/engine/types';
import { B03015 } from './B03015.js';

export const B03015P: CardDef = {
  ...B03015,
  id: 'B03015P',
  no: '0273/B03015P',
  rarity: 'CP',
  imageUrl: '1729133201209121.jpg',
};
