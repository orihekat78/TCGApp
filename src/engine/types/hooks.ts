// HookName union 型定義
// rules: 05-turn-phases.md, 07-action-flow.md, 08-contact.md, 11-reasoning.md
// rules: 14-refresh.md, 15-abilities-effects.md, 13-keywords.md

export type HookName =
  // フェイズ関連
  | 'phase:auto:start'
  | 'phase:auto:before-draw'
  | 'phase:auto:after-draw'
  | 'phase:auto:after-file'
  | 'phase:main:start'
  | 'phase:main:end'
  | 'phase:end:start'
  | 'phase:end:cleanup'
  // ターン関連
  | 'turn:start'
  | 'turn:end'
  // 推理関連 (rules: 11-reasoning.md)
  | 'reasoning:declare'
  | 'reasoning:before-add'
  | 'reasoning:end'
  // アクション関連 (rules: 07-action-flow.md)
  | 'action:declare'
  | 'action:guard-window'
  | 'action:guarded'
  | 'action:unguarded'
  | 'action:end'
  // コンタクト関連 (rules: 08-contact.md)
  | 'contact:start'
  | 'contact:order-set'
  | 'contact:before-judge'
  | 'contact:judge'
  | 'contact:end'
  // キャラ移動関連 (rules: 09-cutin-disguise.md, 18-mr.md)
  | 'enter'
  | 'disguise:into'
  | 'leave:to-remove'
  | 'leave:to-deck'
  | 'leave:to-partner-area'
  | 'mr:overwrite'
  // 効果解決関連 (rules: 15-abilities-effects.md)
  | 'effect:declared'
  | 'effect:resolve:start'
  | 'effect:resolve:end'
  // 状態変更関連 (rules: 03-field-areas.md)
  | 'state:change'
  | 'state:tryActivate'
  | 'keyword:granted'
  | 'keyword:revoked'
  // 証拠関連 (rules: 11-reasoning.md, 10-action-event.md)
  | 'evidence:gain'
  | 'evidence:lose'
  | 'evidence:remove-by-action'
  // FILE・デッキ関連 (rules: 12-next-hint.md, 14-refresh.md)
  | 'file:add'
  | 'file:pop'
  | 'deck:peek'
  | 'deck:reveal'
  | 'deck:shuffle'
  // リフレッシュ・敗北関連 (rules: 14-refresh.md)
  | 'refresh:before'
  | 'refresh:after'
  | 'lose:by-deck-out'
  // フラグ関連 (rules: 05-turn-phases.md, 13-keywords.md)
  | 'flag:assist:set'
  | 'flag:hand-use:set'
  | 'flag:next-hint:used'
  | 'flag:declared-use:incr';
