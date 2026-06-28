// cards/ct-p04/B04037 鈴木園子 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/14-refresh.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【相手ターン中】【ターン1】自分の現場にいる〚カード名［京極真］〛がコンタクトしたとき、手札から〚カード名［鈴木園子］〛を1枚リムーブしてもよい。そうした場合、そのキャラはこのコンタクトによってはリムーブされない。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［京極真］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【相手ターン中】 => a1.condition = {kind 'turn', player:'opp'} [src/engine/cond/eval.ts:35-36 case 'turn' => state.turn.player === resolvePlayer(cond.player,ctx). Exemplar src/cards/ct-d01/D01012.ts:24 / ct-d04/D04010.ts:18 use {kind 'turn',player:'opp'} for identical 【相手ターン中】 prefix.]
//   - 【ターン1】 => a1.limit = {kind 'turn', n:1} [triggered.ts:235-237 enforce / :309-311 incr declaredUseCount at fire/queue time. rules/24 + D04007.ts a2: decline (max:0 discard) still consumes 【ターン1】 (fire-time count).]
//   - 自分の現場にいる〚カード名［京極真］〛がコンタクトしたとき (発火条件; 京極真=非self参加者) => a1.trigger = {hook 'contact:start', matcherCondition:{kind 'triggerCharMatches', payloadKey:'bUid', side:'self', filter:{cardName:'京極真'}}} [state-machine.ts:392 emits contact:start {aUid,bUid}, source=attacker(ax.byUid). aUid=ax.byUid(attacker=turn-player); bUid=ax.guardUid??target.uid(defender/guard). On 【相手ターン中】 the opponent is attacker so 自分(self) の京極真 is always the defender bUid. Non-selfOnly => triggered.ts:228-260 scans all in-play cards (B04037 鈴木園子 is the owner, NOT a participant) and gates via matcherCondition. eval.ts:334-366 triggerCharMatches with payloadKey:'bUid' reads payload.bUid, derives side by scene scan, requires side==='self' (tcmPlayer===ctx.source.player), and matchOneFilter cardName:'京極真'. Exemplar D04007.ts a2 (non-selfOnly third-party triggerCharMatches reaction) + D07018.ts a1 (payloadKey:'bUid' on contact:start) + B02079.ts.]
//   - 手札から〚カード名［鈴木園子］〛を1枚リムーブしてもよい => a1.effect chain step1 = atom discard {player:'self', max:1, filter:{kind 'character', cardName:'鈴木園子'}} [core.ts:atomDiscard => mutate.hand.discardToRemove (手札->リムーブ). Short-form {player,max,filter} => buildShortFormPick (atom-pick-spec.ts) area='hand', forwards filter, n:{min:0,max:1} (max:1 => '1枚まで/してもよい' surface within the pick). cardName filter honored at matchOneFilter (canonical pick eval). EXACT shape precedent src/cards/ct-d08/D08003.ts a1 step1 (discard {player:'self', max:1, filter:{kind 'character', trait:'少年探偵団'}}).]
//   - そうした場合、そのキャラはこのコンタクトによってはリムーブされない => a1.effect chain step2 = atom charSetTurnEffect {uid:'$trigger.bUid', key:'contactImmune_action', val:true} [chain semantics: step2 runs only if step1 applied (discard removed 鈴木園子). '$trigger.bUid' resolves via _shared.ts:194-196 resolveBindRef => ctx.triggerPayload['bUid'] (=京極真). char.ts:176 atomCharSetTurnEffect sets turnEffect; unresolved $-ref = silent no-op (safe). contactImmune honored at state-machine.ts:293 ax.contactImmune = readChar.hasTextAbility(state, bUid, 'contactImmune') at snapshotAP (judge-prep, AFTER contact:start reaction resolves at action-1/2 phases). read/char.ts:274 hasTextAbility checks token + suffixes ['','_oppTurn','_action'] so 'contactImmune_action' is read; contact.ts:261 judge skips defender removal when ax.contactImmune. '_action' clears at action-end (state-machine.ts:443) = この単一コンタクトのみ有効. EXACT pattern precedent B09041.ts a1 (charSetTurnEffect contactImmune_action for 'コンタクトによってリムーブされない'). rules/22: AP判定リムーブのみ免疫.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => a2 = {type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}} [Canonical ヒラメキ encoding (capability-map hooks §evidence:remove-by-action / §Hirameki): triggered + on-evidence + optional:true => pendingHirameki side-channel (UI/AI fire-or-skip). EXACT exemplar src/cards/ct-p09/B09042.ts a2.]
//   - 自分のリムーブエリアにある〚カード名［京極真］〛を1枚まで選び、手札に加える => a2.effect = atom handAddFromRemove {player:'self', max:1, filter:{cardName:'京極真'}} [handAddFromRemove splices remove->hand (short-form defaultArea='remove'). cardName filter honored on remove candidates via matchOneFilter. max:1 => n:{min:0,max:1} = '1枚まで' (0 allowed). EXACT exemplar src/cards/ct-p09/B09042.ts a2 / ct-d10/D10020.ts a2 (same verb+max+cardName filter).]
//   - stats / vanilla body: 鈴木園子 / 白 / level5 / ap5000 / lp1 / traits 高校生,鈴木財閥 / no innate keyword => CardDef {kind 'character', colors:['白'], level:5, ap:5000, lp:1, traits:['高校生','鈴木財閥'], keywords:[]} [From rec B04037.json. No printed innate keyword (迅速/突撃/疾風/ブレット) in text => keywords:[]. Modeled on shipped character CardDef shape (B01007 / B09041).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      kind: 'triggerCharMatches',
      payloadKey: 'bUid',
      side: 'self',
      filter: {
        cardName: '京極真'
      }
    }
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          max: 1,
          filter: {
            kind: 'character',
            cardName: '鈴木園子'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charSetTurnEffect',
        args: {
          uid: '$trigger.bUid',
          key: 'contactImmune_action',
          val: true
        }
      }
    ]
  },
  description: '【相手ターン中】【ターン1】自分の現場にいる〚カード名［京極真］〛がコンタクトしたとき、手札から〚カード名［鈴木園子］〛を1枚リムーブしてもよい。そうした場合、そのキャラはこのコンタクトによってはリムーブされない。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        cardName: '京極真'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［京極真］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const B04037: CardDef = {
  id: 'B04037',
  no: '0435/B04037',
  kind: 'character',
  names: [
    '鈴木園子'
  ],
  colors: [
    '白'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '高校生',
    '鈴木財閥'
  ],
  rarity: 'C',
  imageUrl: '1735287759499536.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ],
};
