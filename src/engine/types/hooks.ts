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
  // engine additive wave-3 (2026-06-30): ミスリードが実行されたとき (rules/13 §ミスリード)。
  // listeners/misread の AI defender 経路 + UI useEngineDispatch.misreadResolve(人間 defender) が、
  // misread した各キャラごとに per-trigger emit (公式Q&A=1枚ごとに発動)。観測 = B05015「相手がミスリード
  // したとき」/ B09016「このキャラがミスリードしたとき」。
  //   payload: { player(=misread 実行側) }   source: { player, uid(=misread キャラ uid、selfOnly 用) }
  | 'misread:performed'
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
  // engine additive wave-3 (2026-06-30): カットインを使用したとき (rules/09 §カットイン)。
  // flow/contact.cutIn が effect:declared(自効果) の直後に per-use emit。第三者キャラ (在場 observer) が
  // 「(自分/相手が)カットインを使用したとき」を観測する用 (B02080/B09086/B04090)。
  //   payload: { player(=cutin 使用側), cardId(=使用カットイン) }
  //   source : { player, cardId, bindings(=contact bindings、$contact.byUid 用) }
  // 既存 effect:declared(optional=cutin 自効果ゲート) とは別 hook = 自効果と第三者観測を分離。
  | 'cutin:used'
  // engine mega-wave W2 (2026-07-03): 宣言能力使用の第三者観測 hook (B03057「〚特徴[探偵]〛のキャラが
  //   【宣言】能力を使用したとき」)。emit = flow/main/declared-ability.useDeclaredAbility (宣言成立時 =
  //   コスト支払後・effect queue 前)。payload: { uid(=宣言キャラ), cardId, abilityId, player(=宣言側) }。
  //   matcher = triggerCharMatches (payload.uid + player 既定経路) / triggerPlayerIs。
  //   既存 effect:declared(kind:'declaredAbility') は cutin 自効果ゲート併用のため観測に不適 → 分離 (cutin:used と同論拠)。
  | 'ability:declared'
  // キャラ移動関連 (rules: 09-cutin-disguise.md, 18-mr.md)
  | 'enter'
  // engine mega-wave W4 (2026-07-03, r83 G34): 効果/能力による登場 batch 単位の集約 emit
  // (per-card 'enter' の後に atomSceneEnter/atomSceneSwitch 呼出 1回につき1回、viaEffect=true のみ)。
  // source.bindings.enterGroup = 同一解決で登場した全キャラ。「その中から1枚」(B01012) の母集合。
  | 'enter:group'
  | 'disguise:into'
  | 'leave:to-remove'
  // mega-wave W6 step10 (2026-07-04, row9): 現場離脱の pre-splice consult (B01092/B01039)。
  // emit されない consult 専用 hook 名 — mutate/scene.removeToRemove が effect/consult-leave-intercept.ts
  // 経由で trigger.hook==='leave:intercept' の ability def を直接走査する (in-play scan の第三者
  // observer 誤発火を避けるため event registry を通さない。post-hoc の leave:to-remove とは別物)。
  | 'leave:intercept'
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
  // engine additive wave-3 (2026-06-30): 証拠がリムーブエリアへ移ったとき (原因非依存、rules/10/14)。
  // mutate/evidence の removeTop/removeAt/toRemove (=証拠→remove の全出口) が remove へ push 後に emit。
  // 既存 evidence:remove-by-action(ヒラメキ、remove 前・原因限定) とは別タイミング・別原因範囲。
  // 観測 = B02062「相手の証拠がリムーブされたとき、1枚引く」(公式Q&A: 原因問わず)。
  //   payload: { player(=リムーブされた証拠の持ち主) }
  | 'evidence:removed'
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
  // engine additive wave-4 (2026-07-01): カードがリムーブエリアから離れたとき (離脱カード毎、**原因非依存**
  // = rules/17 【現場リムーブ時】類推「リムーブ方法問わず」)。emit は mutate.remove.emitExit (payload 単一ソース)
  // 経由で全離脱経路を網羅: ① deck.refresh (リフレッシュ=remove→deck、公式Q&A 発動確認) ②
  // remove.removeFromHere (removeAreaToDeckBottom コスト経路) ③ handAddFromRemove (remove→手札、B05087 第2能力)
  // ④ removeAreaAllToDeckBottom (B08027、remove→deck下) ⑤ evidence.gainCard fromArea=remove (remove→証拠)
  // ⑥ charSetCard fromSelf (使用イベント自身を remove→set-card) ⑦ sceneEnter sourceArea=remove (remove→登場)。
  // 除外 = scene.ts MR→PA redirect pop (在場→PA 転送中の transient、leave:to-remove 既 emit、rules/18①)。
  // 観測 = B05087 諸伏高明 / B05088 大和敢助「自分のリムーブエリアにある〚特徴[長野県警]〛のキャラが
  // リムーブエリアから離れたとき〜」。⚠ コスト由来 (②) 発火を card 側が拾うべきか (rules/21) は card-wave 時 Q&A 確定。
  //   payload: { player(=リムーブエリア所有者), cardId(=離脱したカード) }
  | 'remove:exit'
  // engine mega-wave W3 (2026-07-03, r10): 変装で退場した「元キャラ」側の被置換反応 (B03052)。
  // payload={uid(現場slot), fromCardId(退場カード), newCardId(変装カード), player} /
  // source={player, uid, cardId(=fromCardId)}。emit は flow/contact.disguise (leave:to-deck の後、無条件 —
  // B04034 の disguiseTrigger aura は【変装時】アイコンのみ対象で本 hook は抑止されない)。
  | 'disguise:replaced'
  // engine mega-wave W3 (2026-07-03, r17): 手札からリムーブエリアへ移動 (B05115)。emit は
  // mutate/hand.discardToRemove (splice 前 = on-hand scan がカードを見つけられる、cutIn の順序原則)。
  // payload={player(手札所有者), cardId, byPlayer(起動側)}。viaCost (宣言コスト) は emit しない (rules/21)。
  | 'hand:removed'
  // engine mega-wave W3 (2026-07-03, r18): 手札公開 (B09004)。emit は mutate/hand.emitReveal 単一ソース
  // (atomHandReveal + cost revealFromHand の両経路、コスト由来も無条件 emit — B09004 印字が明記)。
  // payload={player(手札所有者), revealed: CardId[]}。zone 不変。
  | 'hand:reveal'
  // フラグ関連 (rules: 05-turn-phases.md, 13-keywords.md)
  | 'flag:assist:set'
  | 'flag:hand-use:set'
  | 'flag:next-hint:used'
  | 'flag:declared-use:incr';
