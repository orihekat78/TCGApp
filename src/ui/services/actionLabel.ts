// Phase 8.10b: LogEntry の action 文字列 を人間可読な日本語に変換
//
// engine 側 mutate.log.append が action: string を自由文字列で push しているため、
// UI 表示には label マッピングを通す。未知 action は raw 文字列を fallback。

import type { LogEntry } from '@/engine/types/game-state';

const LABELS: Record<string, string> = {
  reasoning:         '推理',
  handUseCard:       '手札の使用',
  partnerAbility:    'パートナー能力',
  declaredAbility:   '宣言能力',
  actionAgainstChar: 'アクション(キャラ)',
  actionAgainstCase: 'アクション(事件)',
  assist:            'アシスト',
  solveCase:         '事件解決 ★',
  nextHint:          'ネクストヒント',
  endTurn:           'ターン終了',
  'setup.reveal':    'ゲーム開始',
  'contact-cutin':   'カットイン',
  'contact-disguise':'変装',
  'contact-pass':    'パス',
  'contact-judge':   '判定',
  'auto-phase':      'オートフェイズ',
};

export function actionLabel(entry: LogEntry): string {
  return LABELS[entry.action] ?? entry.action;
}
