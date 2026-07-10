# mini-wave: ① byPlayer emit 束 (leave:to-remove attribution)

対象: B03116/B05107 (自己蘇生「自分の現場にいるこのキャラが自分の能力や効果によってリムーブ
されたとき」) / B03112 (「自分の現場にいる【黒】が…」) / B04089/B04091/B04094 (「自分の能力や
効果によって相手の現場にいるキャラをリムーブしたとき」)。rules/17 §【現場リムーブ時】方法問わず
発火 + rules/13 Q&A「スイッチによるリムーブでは発動しない」。

## 根本原因 (現行code実測)

`src/engine/mutate/scene.ts:242-243` — `consultLeaveIntercept(s, char, player, cause, byUid, opts?.byPlayer)`
は `opts.byPlayer` を受け取るが、`scene.ts:330` の通常 emit
`{ uid: leavingUid, cause, side: player, byUid, removedChar: char }` には byPlayer が渡っていない。
呼出元 `effect/atom-handlers/scene.ts:338`
(`mutate.scene.removeToRemove(s, srUid, cause ?? 'effect', undefined, { byPlayer: ctx.source.player })`)
は既に効果 owner を正しく計算済 — **配線切れは1点のみ**。同一 payload object は
`listeners/triggered.ts:523-526`(`handleLeaveToRemoveSelf` + `handleHook` 両方に同一 payload) が
使うため、この1点修正で自己反応 (B03116/B05107) と他カード観測反応 (B03112/B04089/91/94) の両方が解禁。

## 変更点

1. `mutate/scene.ts:330` — `{ uid: leavingUid, cause, side: player, byUid, removedChar: char, byPlayer: opts?.byPlayer }`
2. `types/effect.ts:175` — `removedCharMatches` kind に `byPlayer?: 'self' | 'opp'` 追加 (field 追加のみ、2点同期)
3. `cond/eval.ts:698-700` inline payload型に `byPlayer?: Player` 追加、`case 'removedCharMatches'`
   (eval.ts:697) に gate 追加:
   ```
   if (cond.byPlayer !== undefined) {
     if (typeof pl.byPlayer !== 'string') return false; // cause≠'effect' or legacy caller = fail-closed
     const bySelf = pl.byPlayer === ctx.source.player;
     if (cond.byPlayer === 'self' && !bySelf) return false;
     if (cond.byPlayer === 'opp' && bySelf) return false;
   }
   ```
   既存 `by` field (contact winner uid 判定) とは別軸 — 混同禁止 (`by`=コンタクト勝者、`byPlayer`=効果 owner)。

## fail-closed 対象 (byPlayer 未設定の既存 caller)

`flow/turn.ts:88`(ターン終了時リムーブ)/`mutate/scene.ts:77`(MR②)/`:152`(switch)/`cost/pay.ts:134`(cost)
は opts.byPlayer 未指定 → payload.byPlayer=undefined → `byPlayer:'self'` gate は false 判定 (安全側)。
switch は rules/13 Q&A で明示的に非発火要件のため cause フィルタでも遮断される (二重ガード)。
ターン終了時 delayed-effect 由来の「自分の効果」removal は byPlayer 未伝播のため本 wave では未解禁
(out of scope、対象6unit はいずれも即時 sceneRemove atom 経由のため影響なし)。

## DSL 素描 (印字 ⇔ 対応)

- B03116/B05107 (自己蘇生): trigger selfOnly + `condition: {kind:'removedCharMatches', cause:'effect', byPlayer:'self'}`
  → optional[sceneEnter{from:'remove', filter:{cardId:自己}, state:'sleep'}, (B03116のみ)draw{n:1}]
- B03112 (「自分の現場にいる【黒】が…」): `removedCharMatches{side:'self', cause:'effect', byPlayer:'self', removedFilter:{color:'黒'}}`
  → charModifyLP{target:'$self', delta:1, duration:'turn'}
- B04089/91/94 (「相手の現場にいるキャラを…リムーブしたとき」): `removedCharMatches{side:'opp', cause:'effect', byPlayer:'self'}`
  → B04089: optional[sleepSelf, then: sceneRemove{filter:{levelMax:7}, n:{max:1}}] (【ターン1】gate 既存)
  → B04091: chain[draw{n:2}, 手札1枚リムーブ] (デッキ不足時 rules/26 リフレッシュ既存挙動)
  → B04094: charGrantKeyword{keyword:'突撃', duration:'turn'}

## TDD probe 計画 (RED先行、モデル: tests/engine/cond/removed-char-matches.test.ts)

新規 `tests/engine/cond/removed-char-matches-byplayer.test.ts`:
1. `byPlayer:'self'` + payload.byPlayer='self' → true
2. `byPlayer:'self'` + payload.byPlayer='opp' (相手が自分の効果で相手自身のキャラを除去) → false [過剰発火 pin]
3. `byPlayer:'self'` + payload.byPlayer 未設定 (legacy caller) → false [fail-closed pin]
4. `byPlayer:'opp'` + payload.byPlayer='opp' → true
5. `cause` 未指定 + `byPlayer` 指定のみでは switch/contact-ap 由来 payload でも byPlayer が
   偶然一致すれば true になりうる懸念 → **cause:'effect' 明示を DSL authoring 規約とする**
   (engine は独立 gate、規約側でカバー。本 spec の DSL 素描は全て cause:'effect' 明記済)
また既存 `tests/cards/hagiwara-self-remove-observer.test.ts` 等の smoke baseline 回帰0を確認
(byPlayer は additive field のため既存 consumer は無視、型変更のみで挙動不変)。

## エッジケース (rules/15,17,25準拠)

1. コスト由来離脱: `cost/pay.ts:134` removeFromScene は byPlayer未伝播 → byPlayer gate 非発火
   (rules/21 コストは「自分の」限定だが対象6unit は全て「効果」テキストのみ = 元来対象外、仕様一致)
2. スイッチ離脱: cause='switch' は cause gate で対象外 (rules/13 Q&A 明記)
3. 変装引継ぎ: 変装後の新キャラの byPlayer 判定は変装イベント自体の cause (非'effect') で独立評価
   (rules/09「カード名・色は変わる」= 新カード扱い、旧キャラの被リムーブ履歴を引き継がない)
4. 同時複数離脱 (rules/25「解決時状態参照」): leave:to-remove は離脱1体ごとに個別 emit のため
   byPlayer も各々独立判定、複合ケースなし
5. 相手が自分自身の効果で自分のキャラを除去した場合: 上記 pin 2 で明示的に非発火を保証
   (B04089/91/94 の「自分の能力や効果によって」を厳密に満たす)
