// cards/pr-01/PR091 沖矢昴 (キャラ) — evidence-self→hand micro-cluster (2026-06-21)
// 0481 の別 cardNum (絵柄違いプロモ、テキスト byte 同一)。base PR085 を spread。
// 公式テキスト: 【登場時】キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える。
//             【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
import type { CardDef } from '@/engine/types';
import { PR085 } from './PR085.js';

export const PR091: CardDef = { ...PR085, id: 'PR091', no: '0481/PR091', imageUrl: '1737462993180564.jpg' };
