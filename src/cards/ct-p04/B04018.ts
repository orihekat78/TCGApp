// cards/ct-p04/B04018 遠山和葉 (キャラ)
// rules: 15-abilities-effects.md, 17-icons.md, 19-special-rules.md,
//        20-color-and-switch.md, 21-declared-ability-cost.md,
//        24-qa-naming-stun.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   このキャラか〚カード名［服部平次］〛が自分の現場に登場したとき、相手の現場にいるキャラを
//     1枚まで選び、ターン終了時まで元の能力を無効にする。
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//   【パートナー緑】【解決編】【宣言】【スリープ】〚手札を1枚リムーブする〛：
//     自分のリムーブエリアにあるレベル5以下の〚カード名［服部平次］〛を1枚まで選び、登場させる。
import { buildB04018Variant } from './B04018.shared.js';
import type { CardDef } from '@/engine/types';

export const B04018: CardDef = buildB04018Variant({
  id: 'B04018',
  no: '0419/B04018',
  rarity: 'R',
  imageUrl: '1735287737377960.jpg',
});
