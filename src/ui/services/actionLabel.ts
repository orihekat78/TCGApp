// Phase 8.10b: LogEntry の action 文字列 を人間可読な日本語に変換
//
// engine 側 mutate.log.append が action: string を自由文字列で push しているため、
// UI 表示には label マッピングを通す。未知 action は raw 文字列を fallback。

import type { LogEntry } from '@/engine/types/game-state';

const LABELS: Record<string, string> = {
  'causal.case-status-change': '事件カードが解決編へ移行',
  reasoning:         '推理',
  handUseCard:       '手札の使用',
  partnerAbility:    'パートナー能力',
  declaredAbility:   '宣言能力',
  actionAgainstChar: 'アクション(キャラ)',
  actionAgainstCase: 'アクション(事件)',
  assist:            'アシスト',
  solveCase:         '事件解決 ★',
  nextHint:          'ネクストヒント',
  'hirameki:fire':   '【ヒラメキ】発動',
  endTurn:           'ターン終了',
  'setup.reveal':    'ゲーム開始',
  'contact-cutin':   'カットイン',
  'contact-disguise':'変装',
  'contact-pass':    'パス',
  'contact-judge':   '判定',
  'auto-phase':      'オートフェイズ',
  refresh:           'リフレッシュ',
  'causal.use': 'カードを使用',
  'causal.declare': '能力を宣言',
  'causal.select': '対象を選択',
  'causal.draw': 'カードを引く',
  'causal.discard': 'カードを捨てる',
  'causal.zone-move': 'カードを移動',
  'causal.enter': 'カードが登場',
  'causal.sleep': 'スリープ',
  'causal.stun': 'スタン',
  'causal.activate': 'アクティブにする',
  'causal.face-change': 'カードの向きを変更',
  'causal.value-change': '数値が変化',
  'causal.evidence': '証拠が変化',
  'causal.case-resolve': '事件を解決',
  'causal.negate': '効果を無効',
  'causal.fizzle': '効果が不発',
  'causal.cancel': '処理をキャンセル',
  'causal.game-result': '勝敗確定',
  'causal.summary': '処理結果',
};

export function actionLabel(entry: LogEntry): string {
  return actionLabelForAction(entry.action);
}

export function actionLabelForAction(action: string): string {
  return LABELS[action] ?? action;
}
