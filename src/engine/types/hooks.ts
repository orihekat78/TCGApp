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
  // D11007 v2 Phase 3: action:pre-target — attacker 選択時、target 候補列挙の前に fire
  //   payload: { byUid }、source: { uid, cardId, player } (attacker)
  //   listener が `expandActionTargets` 等で側 channel に拡張仕様を push、candidates() が consume
  | 'action:pre-target'
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
  // engine拡張 wave#2 cluster9 (2026-06-15): 裏向き/表向きセットカードが現場から離れたとき
  // (rules/16 セット解除)。per-occurrence (1枚につき1回) emit。
  //   payload: { player(=host owner, 'self'|'opp'), hostUid, hostCardId, setCardId, faceUp, cause }
  //   source : { player, uid(=hostUid), cardId(=hostCardId) }
  // listener は triggerPlayerIs で自/相手側を判定 (host uid を持つが set card 自体に ability は無い)。
  // B07034/B07034P/PR231 a1 (side:self) + B02020/B02020P a1 (side:opp) が購読。
  | 'setcard:leave'
  // engine additive (2026-06-29): カード1枚が host キャラにセットされたとき (rules/16 セット)。
  // setcard:leave の対。mutate/char.ts setCard (=set-card-add の唯一の書込点) が push 後に per-occurrence emit。
  //   payload: { player(=host owner), hostUid, hostCardId, setCardId, faceUp, cause }
  //   source : { player, uid(=hostUid), cardId(=hostCardId) }
  // host が listener (selfOnly: source.uid===host.uid)。set card 自体に ability は無い。裏向きセット
  // (faceUp:false) は情報を持たない (rules/16) → setCardMatches 条件は faceUp!==true を弾く。
  // B02018「このキャラにカードがセットされるたび」/ B06046「〚特徴[YAIBA]〛のカードがセットされるたび」用。
  | 'setcard:enter'
  | 'mr:overwrite'
  // 効果解決関連 (rules: 15-abilities-effects.md)
  | 'effect:declared'
  | 'effect:resolve:start'
  | 'effect:resolve:end'
  // 事件編→解決編 移行 (rules: 01-victory-conditions.md)
  // 一方通行 (rules/01: 解決編→事件編なし) なのでゲーム中1回しか発火しない
  | 'case:to-resolved'
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
