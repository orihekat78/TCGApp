// cards/ct-p06/B06091 大江忍 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【ターン1】このキャラが指定されたアクションをガードしたとき、
//     ガードしたキャラをアクティブにし、ターン終了時までAP＋2000する。
//
// 同一 cardId 0710 の別 num (CT-D11 版 D11016 と同一カード)。logic は D11016 を spread で再利用。

import { D11016 } from '../ct-d11/D11016.js';
import type { CardDef } from '@/engine/types';

export const B06091: CardDef = {
  ...D11016,
  id: 'B06091',
  no: '0710/B06091',
  imageUrl: '1754285264333672.jpg',
  rarity: 'C',
};
