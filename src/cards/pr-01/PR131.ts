// cards/pr-01/PR131 江戸川コナン (キャラ・プロモ) — catalog-reuse batch
// rules: 03-field-areas.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md
//
// 公式テキスト:
//   【解決編】【登場時】手札を1枚リムーブしてもよい。そうした場合、自分の現場にいるLP0の〚カード名［毛利蘭］〛を1枚まで選び、アクティブにする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［工藤新一］〛を1枚まで選び、手札に加える。
//
// B03004 のプロモ違い (PR)。能力は同一 — base を spread。

import type { CardDef } from '@/engine/types';
import { B03004 } from '../ct-p03/B03004.js';

export const PR131: CardDef = {
  ...B03004,
  id: 'PR131',
  no: '0262/PR131',
  rarity: 'PR',
  imageUrl: '196d259ff0b195.jpg',
};
