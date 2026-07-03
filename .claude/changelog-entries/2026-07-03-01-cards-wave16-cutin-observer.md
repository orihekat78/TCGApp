### card-authoring wave16 — キール B03118 出荷 (cutin:used observer 初 consumer、engine 変更 0)

- **card**: B03118 キール (キャラ・黒・Lv3・AP3000・LP1・特徴[黒ずくめの組織]、ct-p03 非MVP)。
  「このキャラのコンタクト中に自分が【カットイン】を使用したとき、そのコンタクト中、このキャラをAP＋1000する。」
  +「【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。」
- **cutin:used observer 初 consumer**: `cutin:used` hook (engine additive wave-3 で足場出荷) は matcher
  (triggerCutinMatches) 共々出荷済だが、consumer カードが 0 のまま untested だった (B02080/B09086/B04090 全 DEFER)。
  本 wave が初の実 consumer として出荷し、`contact.cutIn` emit → 第三者 observer → `$contact.byUid` AP+ の
  end-to-end 経路を実機で確立 (engine 変更 0)。
- **句マッピング** (全 primitive 出荷済):
  - a1 = triggered `cutin:used` + matcherCondition `triggerPlayerIs:self` (自分が使用) + effect
    `conditional{ if: custom(ctx.contact.byUid===source.uid), then: charModifyAP{uid:$contact.byUid, delta:1000, scope:contact} }`。
  - a2 = triggered `evidence:remove-by-action`(optional) + `draw{n:1}` (【ヒラメキ】、B03004 a2 同型)。
- **★設計注記 (contact 依存 guard は effect-conditional に置く)**: 「このキャラのコンタクト中」guard を
  ability.condition ではなく **effect の conditional{if}** で評価する (D11013 同型)。理由 = handleHook の
  condition-eval ctx は `.contact` 未設定 (`listeners/triggered.ts:300`)、ctx.contact が populate されるのは
  queue 後 runtime ctx (`resolve/stack.entryToCtx`, BUG-104) のみ。B03118 は limit を持たないため guard を
  trigger→effect に移しても発動回数の観測差ゼロ (guard 不成立時は effect no-op)。
- **B02080 は A1 送り**: 「[警察]参加者のコンタクト中」は **trigger 条件** かつ【ターン1】limit を持つため
  effect-conditional で代替不可 (rules/24: 効果不成立でも発動扱い = limit 誤消費)。修正 = handleHook の
  condition-eval ctx に ctx.contact を展開する additive 変更 (`listeners/**` = A1 lane)。DEFERRED-INDEX 記載。
- **検証**: 新 test `tests/cards/wave16-cutin-observer.test.ts` (4件) — 実 `cutIn` emit を end-to-end 駆動し
  `runAllUntilEmpty` 後の実効 AP を検証。§参加者=キール→AP 3000+1000=4000 / §DECOY 別キャラ attacker→guard 不成立で
  キール・MOB とも据置 / §相手 cutin→side:self observer 非発火。BUG-117/118 教訓を実 hook 駆動で担保。
- **gates**: tsc0 / vitest 3742 pass +1 skip (新 4件) / smoke:1000 winsA=498 exceptions=0 不変 (engine 変更 0 証跡) /
  eslint (changed files) + custom lint errors=0。playwright は非MVP (MVP デッキ非搭載) ゆえ統合 test の decoy 駆動で代替。
- tier T1 (既存 primitive のみ、cutin:used 経路は wave-3 で emit test 済。本 wave は observer consumer 配線 + AP 適用の実証)。
