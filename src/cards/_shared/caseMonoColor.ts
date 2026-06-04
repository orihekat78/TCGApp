// cards/_shared/caseMonoColor
// rules: 17-icons.md §【事件(色)】, 20-color-and-switch.md
// spec: .claude/specs/card-condition-catalog.md
//
// 「自分の事件が【色】以外の色を持たない場合」= 事件が指定色のみで他色を1つも持たない。
// not(caseColor[他の全色]) で表現する (caseColor は combine 既定 'or' = いずれか保持)。
// 全色集合は本ゲームの 6 色 (青/赤/黄/緑/白/黒)。
// 共通クラスは破壊的変更禁止。新パターンは新クラス追加で対応。

import type { Condition } from '@/engine/types';

const ALL_COLORS = ['青', '赤', '黄', '緑', '白', '黒'];

export function caseMonoColor(color: string): Condition {
  const others = ALL_COLORS.filter((c) => c !== color);
  // 事件が他色を1つも持たない → 指定色のみ
  return { kind: 'not', c: { kind: 'caseColor', color: others } };
}
