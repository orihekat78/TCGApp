// cards/pr-01/PR237 犯人 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/14-refresh.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー黒】【自分ターン中】このキャラがキャラとコンタクトしたとき、そのキャラをリムーブする。
//   【ヒラメキ】自分のデッキのカードを上から5枚リムーブする。（発動させないことを選択できる）
// 句マッピング:
//   - 【パートナー黒】【自分ターン中】(条件アイコン) => ability.condition = and[ partnerColor{color:'黒'}, turn{player:'self'} ] [B01028.ts a3 uses exact and[partnerColor{color:'緑'},turn{player:'self'}] on a contact:start trigger (only color differs 緑→黒). cond/eval.ts: partnerColor + turn both fully evaluated; cap-map conditions list confirms both.]
//   - このキャラがキャラとコンタクトしたとき (発火条件) => trigger = { hook 'contact:start', selfOnly:true } [PR006.ts/B01028.ts a2/D11007.ts a3 all use {hook 'contact:start', selfOnly:true}. state-machine.ts:392 emits contact:start with source {uid: ax.byUid} = attacker; selfOnlyMatches (triggered.ts:160-171) matches scene card on source.uid===card.uid, so fires only when this card is the attacker. contact:start only emitted for char targets (state-machine.ts:374 case target skips), matching 'キャラとコンタクト'. The 【自分ターン中】 cond is consistent (attacks occur on own turn).]
//   - そのキャラをリムーブする (= the contacted/other char) => atom sceneRemove { uid:'$trigger.bUid', cause:'effect' } [state-machine.ts:381-392 sets bUid = ax.guardUid ?? target.uid = the OTHER char in contact ('そのキャラ'), emitted in payload {aUid,bUid}. atom-handlers.ts:175-181 resolveBindRef('$trigger.bUid') → triggerPayload['bUid'] (fallback `return tp[tfield] ?? value` for non-uid fields). sceneRemove handler atom-handlers.ts:896-901 resolves uid via resolveBindRef then mutate.scene.removeToRemove(s,srUid,'effect'); unresolved ($-prefixed) → silent no-op (safe). resolve-picks.ts:508-516: explicit-uid sceneRemove (no target, mode PA) passes through untouched (no pick surface). $trigger.<field> precedent: B09041.ts a1 ($trigger.guardUid on action:guarded payload), B05080.ts a2 ($trigger.uid on reasoning:end → operate on that char), B08048.ts ($trigger.targetUid). triggerPayload propagated to runtime via stack.ts:66 entryToCtx triggerPayload:entry.triggeredBy.payload and triggered.ts:312 event.queue(...,payload,...). cap-map: sceneRemove uid accepts bindref.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）...（発動させないことを選択できる） => ability a2: scope 'on-evidence', trigger={hook 'evidence:remove-by-action', optional:true} [B09092.ts a3 is the exact pattern: {hook 'evidence:remove-by-action', optional:true} for ヒラメキ with optional fire/skip ('発動させないことを選択できます'). cap-map hooks: evidence:remove-by-action optional:true → pendingHirameki side-channel (UI/AI fire-skip).]
//   - 自分のデッキのカードを上から5枚リムーブする => atom mill { player:'self', n:5 } [B07098.ts uses mill {player:'self', n:2}; B09092.ts a3 uses mill {player:'opp', n:4}. cap-map: mill — args {player,n} → mutate.deck.removeFromTop (mills top n). Only n/player differ. NOTE engine gap (documented in B09092 comment, shipped green): mill does NOT immediately refresh on deck-empty (refresh penalty/痕跡 flip/0-deck-out deferred to next draw) — engine BUG, unavoidable at card-DSL level (骨格凍結); does not change verdict since identical to shipped mill cards.]
//   - stats: level 3 / ap 0 / lp 0, color 黒, trait 犯人 (vanilla body) => CardDef level:3, ap:0, lp:0, colors:['黒'], traits:['犯人'], keywords:[] [TSV→CardDef AP scaling ×1000 (PR006 TSV ap '4'→4000; D11007 TSV ap '5'→5000), LP/level as-is. PR237 ap '0'→0, lp '0'→0, level '3'→3. No printed innate keyword (迅速/突撃/疾風/ブレット) → keywords:[].]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '黒'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  trigger: {
    hook: 'contact:start',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      uid: '$trigger.bUid',
      cause: 'effect'
    }
  },
  description: '【パートナー黒】【自分ターン中】このキャラがキャラとコンタクトしたとき、そのキャラをリムーブする。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/22-qa-action-contact.md',
    'rules/17-icons.md'
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
    verb: 'mill',
    args: {
      player: 'self',
      n: 5
    }
  },
  description: '【ヒラメキ】自分のデッキのカードを上から5枚リムーブする。（発動させないことを選択できる）',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const PR237: CardDef = {
  id: 'PR237',
  no: '0935/PR237',
  kind: 'character',
  names: [
    '犯人'
  ],
  colors: [
    '黒'
  ],
  level: 3,
  ap: 0,
  lp: 0,
  traits: [
    '犯人'
  ],
  rarity: 'PR',
  imageUrl: '1769159371804837.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
