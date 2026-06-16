// cards/ct-p07/B07057P 「時価4億円！」 (event) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   自分の現場にいる〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚手札に移してもよい。そうした場合、キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与え、カードを1枚引く。
// 句マッピング:
//   - (イベント自己使用トリガ) このイベントを使用したとき本文が発動 => AbilityDef type 'triggered' scope 'on-hand' trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [src/cards/ct-p02/B02053.ts a1 / ct-p03/B03081.ts a1 / ct-p04/B04014.ts a1 はいずれも event の self-use を effect:declared+selfOnly+matcher(p)=>p.kind==='event-use', scope 'on-hand' で表現。__eventUse:true は scripts/taskA-codegen.cjs L112-120 が EVENT_USE_MATCHER closure へ変換する codegen pseudo-flag (taskA-validate-specs.cjs L136 が raw matcher closure を禁止し __eventUse を要求)。emit site = src/engine/flow/main/hand-use-card.ts payload {kind 'event-use',cardId}; on-hand selfOnly が payload.cardId+source.player を一致 (capability-map hooks §effect:declared)。JSON flag のため pure-JSON authorable → needsManual:false。]
//   - 自分の現場にいる〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚手札に移してもよい => optional { chain[ sceneToHand{player:'self', max:1, side:'self', filter:{cardName:['黒羽快斗','怪盗キッド']}}, ... ] }  (してもよい=optional ラッパ, 1枚移す=sceneToHand 自陣 max:1) [optional+chain の「してもよい。そうした場合」idiom は src/cards/ct-p04/B04049.ts a1 (optional{chain[<discard max:1 filter>, <sceneRemove rider>]}) と ct-p07/B07019.ts a1 がVERBATIM。sceneToHand 短縮形は atom-handlers.ts:926-935 (uid 不在+player string+hasNorMax → paShortFormAwait, chooser=resolvePlayer(a.player)=self, side=self; src/cards/ct-p06/B06007.ts a2 が sceneToHand{player:'self',max:1,...} 短縮形を使用)。filter/side/max は buildShortFormPick (atom-pick-spec.ts:69-84) が a.filter/a.side/a.max を pass-through (max-only → n:{min:0,max:1})。cardName ARRAY (OR membership) は matchOneFilter (src/engine/target/candidates.ts:260-263 Array.isArray→allCardNameComponentsForDef, split-name rules/19) で honor。これは POSITIVE membership であり、B01047 黒羽快斗 が yellow になった card-name EXCLUSION gate (TargetFilter.cardName は positive のみ) には該当しない。side:'self'=「自分の現場にいる」。sceneToHand は所有者(self)の手札へ戻す (atom-handlers.ts:926 comment + mutate.scene.toHand)。]
//   - そうした場合、(後続の突撃付与・ドローを行う) => chain ラッパ (no-apply break): bounce ステップが候補0なら __chainStepNoApply=true → chain break で後続 skip; 候補ありで pick enqueue されると残り step を continuation 同梱して後続実行 [resolver.ts:59-84 chain case: 各 step run 後に queue 成長(pick await)なら remainder を continuation 同梱して return、__chainStepNoApply true なら break。substituteAtomPick (src/engine/effect/resolve-picks.ts:539-540, :583-584) が cands.length===0 で __chainStepNoApply=true をセット。bounce 候補不在(黒羽快斗/怪盗キッド 不在)→chain break→突撃付与+draw skip = 「そうした場合(=移したとき)のみ後続」を正確に再現。idiom 源は B04049.ts a1 (discard 候補不在→sceneRemove skip)。]
//   - カードを1枚引く => そうした場合 chain 内 sequence の FIRST step: draw{player:'self', n:1}  (突撃付与より前に置き無条件実行) [draw 短縮形 = src/cards/ct-p06/B06007.ts a2 option3 (draw{player:'self',n:2})。REORDER 根拠: 公式文は『突撃を与え、カードを1枚引く』の順だが draw は突撃付与(max:1 で 0枚可)の選択枚数に依存せず必ず行う必要がある。順序通り [grant(pick), draw] にすると grant の human 0-pick / 候補不在で continuation が drop され draw が落ちる (B04014.ts header の BUG-111 reorder 根拠と同型)。draw と charGrantKeyword は PROVABLY commutative: mutate/deck.ts draw も mutate/char.ts grantKeyword も card-triggerable hook を emit せず (keyword:granted/deck:peek/file:add は capability-map で INTERNAL-ONLY = TRIGGERED_HOOKS 非登録、triggered.ts に grep 0 件)、draw は scene char/状態を変えず grant は deck top を変えない。よって [draw, grant] は全 pick 数(0/1)で同一 state を生み draw を無条件化する忠実実装。]
//   - キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与え => charGrantKeyword{player:'self', max:1, side:'either', kw:'突撃', scope 'turn'} (短縮形 scene pick on picked char) [src/cards/ct-p04/B04014.ts a1 option3 が同一文『キャラを1枚まで選び、ターン終了時まで突撃を与える』を charGrantKeyword{player:'self', max:1, side:'either', kw:'突撃', scope 'turn'} で実装(VERBATIM)。短縮形 pick gate=atom-handlers.ts:1089 (uid 不在+player string+hasNorMax→paShortFormAwait scene pick)。side:'either' は『自分の』prefix 無=現場どちら可 (rules/15 §対象指定; D10020/D10021 同型 either+filter)。kw '突撃' は read/keyword.ts が granted keyword を名乗り例外で honor (rules/13)。scope 'turn' は turn.ts endTurn clearTurnEffects('turn') で『ターン終了時まで』を解除。max:1 → n:{min:0,max:1} (rules/15 1枚まで=0可)。括弧書きは突撃の説明注記で別効果なし。突撃は付与 keyword(印字でない)→ keywords:[]。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneToHand',
          args: {
            player: 'self',
            max: 1,
            side: 'self',
            filter: {
              cardName: [
                '黒羽快斗',
                '怪盗キッド'
              ]
            }
          }
        },
        {
          kind: 'sequence',
          steps: [
            {
              kind: 'atom',
              verb: 'draw',
              args: {
                player: 'self',
                n: 1
              }
            },
            {
              kind: 'atom',
              verb: 'charGrantKeyword',
              args: {
                player: 'self',
                max: 1,
                side: 'either',
                kw: '突撃',
                scope: 'turn'
              }
            }
          ]
        }
      ]
    }
  },
  description: '自分の現場にいる〚カード名［黒羽快斗］〛か〚［怪盗キッド］〛を1枚手札に移してもよい。そうした場合、キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与え、カードを1枚引く。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B07057P: CardDef = {
  id: 'B07057P',
  no: '0786/B07057P',
  kind: 'event',
  names: [
    '「時価4億円！」'
  ],
  colors: [
    '白'
  ],
  level: 5,
  traits: [],
  rarity: 'CP',
  imageUrl: '1763546809976105.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ],
};
