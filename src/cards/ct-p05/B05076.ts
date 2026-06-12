// cards/ct-p05/B05076 ジョディ・スターリング (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/01-victory-conditions.md
// 公式テキスト:
//   【解決編⁆相手のターン終了時、自分の現場にいるキャラが2枚以下の場合、相手は手札を1枚リムーブする。（自分の事件が解決編になっている場合、この能力か効果を使える）
// 句マッピング:
//   - 【解決編】 => condition and-clause: {kind 'caseStatus',status:'解決編'} [caseStatus condition — capability-map L148 + src/engine/cond/eval.ts case 'caseStatus' (state.players[owner].case.status === cond.status, owner=self). Type {kind 'caseStatus',status:'事件編'|'解決編'} confirmed src/engine/types/effect.ts L21. Exemplar gate use: capability-map L606 'caseStatus(事件編/解決編) gate 可'.]
//   - 相手のターン終了時 => trigger {hook 'phase:end:start'} + condition and-clause {kind 'turn',player:'opp'} [phase:end:start hook is card-triggerable (capability-map L313/L531 TRIGGERED_HOOKS). source undefined so gate via condition on turn player (L314/L354). turn condition: src/engine/cond/eval.ts case 'turn' returns state.turn.player===resolvePlayer(cond.player); at end-phase the active turn player IS the player whose turn ends, so player:'opp' fires only on opponent's turn end. Exemplar: D08003.ts a2 uses {hook 'phase:end:start'}+{kind 'turn',player:'self'} for 自分のターン終了時; D04010.ts a1 uses {kind 'turn',player:'opp'} for 【相手ターン中】 gate. Type {kind 'turn',player:'self'|'opp'} effect.ts L16.]
//   - 自分の現場にいるキャラが2枚以下の場合 => conditional.if = {kind 'not', c:{kind 'sceneHas', query:{area:'scene',side:'self'}, nMin:3}}  (NOT(own scene >=3) == own scene <=2) [sceneHas counts candidates(area:'scene',side:'self') with NO filter = ALL own scene characters (partner is a separate state slot, not in scene — src/engine/target/candidates.ts enumerateByQuery case 'scene' iterates state.players[side].scene only). eval.ts case 'sceneHas' = cands.length >= (nMin??1); case 'not' = !evalCond(cond.c). Exemplars: B03103.ts L33 {sceneHas, side:'self', nMin:5} (counts any self char); D11015.ts L34 {sceneHas, side:'opp', nMin:3}; not+sceneHas idiom: B07021.ts a1 {kind 'not',c:{kind 'sceneHas',query:{area:'scene',side:'self',...},nMin:1}}. Conditional if/then structure copied from D08003.ts a2. Types not={kind 'not',c} L13, sceneHas L23.]
//   - 相手は手札を1枚リムーブする => conditional.then = {kind 'atom', verb 'discard', args:{player:'opp', n:1}} [discard verb args {player,n}: src/engine/effect/atom-handlers.ts case 'discard' resolves player via resolvePlayer (player:'opp' -> opponent), buildShortFormPick(defaultArea=hand) so the OPPONENT selects which hand card, then mutate.hand.discardToRemove moves it to remove area (= リムーブ). Mandatory (no optional wrapper) per rules/15 「〜する」. EXACT exemplar: D04010.ts a1 (also ジョディ・スターリング, 赤/FBI) clause 「相手は手札を1枚リムーブする」 -> {kind 'atom',verb 'discard',args:{player:'opp',n:1}}. capability-map L17/L548.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseStatus',
        status: '解決編'
      },
      {
        kind: 'turn',
        player: 'opp'
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'not',
      c: {
        kind: 'sceneHas',
        query: {
          area: 'scene',
          side: 'self'
        },
        nMin: 3
      }
    },
    then: {
      kind: 'atom',
      verb: 'discard',
      args: {
        player: 'opp',
        n: 1
      }
    }
  },
  description: '【解決編】相手のターン終了時、自分の現場にいるキャラが2枚以下の場合、相手は手札を1枚リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B05076: CardDef = {
  id: 'B05076',
  no: '0576/B05076',
  kind: 'character',
  names: [
    'ジョディ・スターリング'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'C',
  imageUrl: '1746628078718476.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/01-victory-conditions.md'
  ],
};
