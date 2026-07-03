# engine mega-wave W3 — observer hook 5 primitive + exemplar 5 printings

- **r10 `disguise:replaced` hook + `disguiseReplacedByMatches`** (B03052/P シャロン・ヴィンヤード
  「〚カード名［ベルモット］〛が【変装】によってこのキャラと入れ替わったとき」): flow/contact.disguise
  が leave:to-deck 後に無条件 emit (B04034 の disguiseTrigger aura は【変装時】のみ対象)。退場カードは
  既にデッキ下 → virtual-location handler `handleDisguiseReplacedSelf` (handleLeaveToRemoveSelf 同構造)。
  第三者 in-play scan は意図的に無し (observer 変種カード不在)。
- **r51 `disguise:into` payload.replacedChar + `disguiseReplacedMatches`** (B02047 工藤有希子
  「【変装時】LP2以上の【白】のキャラと入れ替わった場合、コンタクトによってリムーブされない」):
  disguiseInto 直前の toPlainDeep snapshot (uid sentinel `::disguise-replaced` — 新カード自身の
  continuous/aura 混入防止)。contactImmune は既存配線の初 live consumer。
- **r12 `invokeLeaveToRemoveOfCard` verb (engine-only)**: リムーブ中カードの【現場リムーブ時】明示発動
  (B08078 a2 用)。emit 非経由 = 対象 CardDef 直接走査 → 盤面 observer 波及なし (新 leaf
  effect/invoke-leave-to-remove.ts、import cycle 回避)。B08078 カードは a1 の remove-area
  ability-presence 計数 Condition 不在で **DEFER** (partial 禁止、DEFERRED-INDEX 記録)。
- **r17 `hand:removed` hook + `triggerByPlayerIs` + sceneEnter `sourceRequired`** (B05115 弁崎素江
  「【相手ターン中】相手の能力や効果によって手札からこのカードをリムーブしたとき、リムーブエリアから
  登場させてもよい」): discardToRemove が splice 前 emit + attribution{byPlayer, viaCost} (viaCost=
  宣言コスト emit 抑止 rules/21、call site 4 同期)。sourceRequired = 公式Q&A「解決までにリムーブエリアを
  離れていたら登場できない」の opt-in gate。
- **r18 `hand:reveal` hook + `triggerRevealMatches`** (B09004 毛利蘭 SR): mutate.hand.emitReveal
  単一ソース (atomHandReveal 効果経路 + revealFromHand コスト経路 — 印字「【宣言】能力のコストによって」
  がコスト由来を明記)。revealed[] の cardName any-match (「か」= 配列、rules/19 分割名)。
- 検証: probe 23 tests (emit 形状 / matcher on-off / 第三者非波及 / sentinel 汚染防止 / Q&A edge /
  human optional 経路 dispatch 駆動) / tsc 両0 / vitest 3871→3894 回帰0 (契約更新 1: disguise:into
  payload の additive field 対応) / smoke winsA=498 exc0 不変 / 8lint err0 / 混成 review sonnet5+opus。
- latent (DEFERRED-INDEX「megaw3」節): cross-side 短縮形 pick の side/chooser 不整合 (現出荷カード未踏、
  相手選択型 discard 出荷時に buildShortFormPick 修正要) / B08078 DEFER / cutin discard も hand:removed emit。
