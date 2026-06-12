/**
 * Task A batch#2 — wave2 (leave→hand / reanimate / forEach-all クラスタ) specs.
 * Settled patterns only (engine変更0):
 *  - leave:to-remove(selfOnly)+turn:opp → handAddFromRemove{max,filter|filterAny}  (B02004 a2)
 *  - sceneEnter{from:'remove'|'hand',max:1,viaEffect,enterSleep?}                  (B02004 a1 / D08024 / B05112 / D01012 enterSleep)
 *  - forEach over:{kind:'all',query} → sceneSetState{uid:'$each.uid'}              (B06071, primitive-tested)
 *  - hirameki = evidence:remove-by-action(optional)                                 (B01011 a2; sleep-pick shape = D03013 a2)
 *  - action:declare selfOnly + limit turn1                                          (B02004 a1)
 * Events needing matcher closure (event-use) are NOT here (defer: B02053/D09025 等).
 */
const fs = require('fs');

const RR_LEAVE = ['rules/15-abilities-effects.md', 'rules/17-icons.md'];
const RR_HIRA = ['rules/10-action-event.md', 'rules/14-refresh.md'];
const RR_ENTER = ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/03-field-areas.md'];
const RR_ALL = ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/24-qa-naming-stun.md'];
const RR_ACTION = ['rules/07-action-flow.md', 'rules/17-icons.md', 'rules/15-abilities-effects.md'];

// 【相手ターン中】【現場リムーブ時】 → effect
const leaveOpp = (id, effect, desc, rr) => ({
  id, type: 'triggered', scope: 'on-scene',
  condition: { kind: 'turn', player: 'opp' },
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  effect, description: desc, ruleRefs: rr,
});

const hirameki = (id, effect, desc, rr) => ({
  id, type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect, description: desc, ruleRefs: rr,
});

const fromRemoveToHand = (args) => ({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, ...args } });
const reanimate = (args) => ({ kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', max: 1, viaEffect: true, ...args } });
const fromHandEnter = (args) => ({ kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, ...args } });
// 「キャラを1枚まで選び、スリープさせる」(D03013 a2 同型 — 明示 Pattern A pick)
const sleepPick = () => ({
  kind: 'atom', verb: 'sceneSetState',
  args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } },
});
// 「すべてのキャラをスリープさせる」(B06071 同型 forEach over:all)
const sleepAll = () => ({
  kind: 'forEach',
  over: { kind: 'all', query: { area: 'scene', side: 'either' } },
  do: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$each.uid', state: 'sleep' } },
});

const specs = [
  // ---- leave→hand クラスタ ----
  { rep: 'B05034', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LEAVE, ...RR_HIRA],
    clauseMap: [
      { clause: '【相手ターン中】【現場リムーブ時】リムーブの【緑】イベント1枚まで手札', mapsTo: 'turn:opp + leave:to-remove(selfOnly)→handAddFromRemove{color:緑,kind:event,max:1}', grounding: 'B02004 a2 同型' },
      { clause: '【ヒラメキ】リムーブの【緑】イベント1枚まで手札', mapsTo: 'evidence:remove-by-action(optional)→handAddFromRemove 同上', grounding: 'B01011 a2 hook + B02004 a2 verb' },
    ],
    abilities: [
      leaveOpp('a1', fromRemoveToHand({ filter: { color: '緑', kind: 'event' } }),
        '【相手ターン中】【現場リムーブ時】リムーブの【緑】のイベントを1枚まで選び、手札に加える。', RR_LEAVE),
      hirameki('a2', fromRemoveToHand({ filter: { color: '緑', kind: 'event' } }),
        '【ヒラメキ】リムーブの【緑】のイベントを1枚まで選び、手札に加える。', RR_HIRA),
    ] },
  { rep: 'B07042', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LEAVE, 'rules/19-special-rules.md'],
    clauseMap: [
      { clause: '【相手ターン中】【現場リムーブ時】リムーブの[白馬探]1枚まで手札', mapsTo: 'turn:opp + leave:to-remove(selfOnly)→handAddFromRemove{cardName:白馬探,kind:character,max:1}', grounding: 'B02004 a2 同型 (cardName filter 同形)' },
    ],
    abilities: [
      leaveOpp('a1', fromRemoveToHand({ filter: { cardName: '白馬探', kind: 'character' } }),
        '【相手ターン中】【現場リムーブ時】リムーブの〚カード名［白馬探］〛を1枚まで選び、手札に加える。', [...RR_LEAVE, 'rules/19-special-rules.md']),
    ] },
  { rep: 'B09015', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LEAVE, 'rules/19-special-rules.md'],
    clauseMap: [
      { clause: '【相手ターン中】【現場リムーブ時】リムーブの[円谷光彦]かレベル4[少年探偵団]キャラ1枚まで手札', mapsTo: 'turn:opp + leave(selfOnly)→handAddFromRemove{filterAny:[{cardName:円谷光彦},{trait:少年探偵団,level=4}],max:1}', grounding: 'B02004 a2 + filterAny passthrough (atom-pick-spec buildShortFormPick L75)' },
    ],
    abilities: [
      leaveOpp('a1', fromRemoveToHand({ filterAny: [
          { cardName: '円谷光彦', kind: 'character' },
          { trait: '少年探偵団', levelMin: 4, levelMax: 4, kind: 'character' },
        ] }),
        '【相手ターン中】【現場リムーブ時】リムーブの〚カード名［円谷光彦］〛かレベル4の〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。', [...RR_LEAVE, 'rules/19-special-rules.md']),
    ] },

  // ---- reanimate クラスタ (from:remove) ----
  { rep: 'B04007', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LEAVE, ...RR_ENTER, ...RR_HIRA],
    clauseMap: [
      { clause: '【相手ターン中】【現場リムーブ時】リムーブのLv6以下[白鳥任三郎]1枚までスリープ状態で登場', mapsTo: 'turn:opp + leave(selfOnly)→sceneEnter{from:remove,enterSleep:true,cardName+levelMax6,max:1}', grounding: 'B02004 a1 (from:remove) + D01012 (enterSleep:true)' },
      { clause: '【ヒラメキ】キャラを1枚まで選びスリープ', mapsTo: 'evidence:remove-by-action(optional)→sceneSetState pick(D03013 a2 同型)', grounding: 'D03013 a2' },
    ],
    abilities: [
      leaveOpp('a1', reanimate({ enterSleep: true, filter: { cardName: '白鳥任三郎', levelMax: 6, kind: 'character' } }),
        '【相手ターン中】【現場リムーブ時】リムーブのレベル6以下の〚カード名［白鳥任三郎］〛を1枚まで選び、スリープ状態で登場させる。', [...RR_LEAVE, ...RR_ENTER]),
      hirameki('a2', sleepPick(), '【ヒラメキ】キャラを1枚まで選び、スリープさせる。', [...RR_HIRA, 'rules/03-field-areas.md']),
    ] },
  { rep: 'B03099', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_ACTION, ...RR_ENTER],
    clauseMap: [
      { clause: '【ターン1】このキャラがアクションしたとき、リムーブのLv6以下[長野県警]キャラ1枚までスリープ状態で登場', mapsTo: 'action:declare(selfOnly)+limit{turn,1}→sceneEnter{from:remove,enterSleep:true,trait+levelMax6,max:1}', grounding: 'B02004 a1 (action:declare selfOnly + 【ターン1】 + from:remove) + D01012 enterSleep' },
    ],
    abilities: [
      { id: 'a1', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
        trigger: { hook: 'action:declare', selfOnly: true },
        effect: reanimate({ enterSleep: true, filter: { trait: '長野県警', levelMax: 6, kind: 'character' } }),
        description: '【ターン1】このキャラがアクションしたとき、リムーブのレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
        ruleRefs: [...RR_ACTION, ...RR_ENTER] },
    ] },

  // ---- reanimate クラスタ (from:hand) ----
  { rep: 'B03012', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LEAVE, ...RR_ENTER, ...RR_HIRA, 'rules/19-special-rules.md'],
    clauseMap: [
      { clause: '【相手ターン中】【現場リムーブ時】手札からLv6以下[工藤新一]キャラ1枚まで登場', mapsTo: 'turn:opp + leave(selfOnly)→sceneEnter{from:hand,cardName+levelMax6,max:1}', grounding: 'B05112 (from:hand) + B02004 a2 (leave+turn:opp)' },
      { clause: '【ヒラメキ】リムーブの[工藤新一]1枚まで手札', mapsTo: 'evidence:remove-by-action(optional)→handAddFromRemove{cardName,max:1}', grounding: 'B02004 a2 verb + B01011 a2 hook' },
    ],
    abilities: [
      leaveOpp('a1', fromHandEnter({ filter: { cardName: '工藤新一', levelMax: 6, kind: 'character' } }),
        '【相手ターン中】【現場リムーブ時】手札からレベル6以下の〚カード名［工藤新一］〛のキャラを1枚まで登場させる。', [...RR_LEAVE, ...RR_ENTER, 'rules/19-special-rules.md']),
      hirameki('a2', fromRemoveToHand({ filter: { cardName: '工藤新一', kind: 'character' } }),
        '【ヒラメキ】リムーブの〚カード名［工藤新一］〛を1枚まで選び、手札に加える。', [...RR_HIRA, 'rules/19-special-rules.md']),
    ] },
  ...['PR155', 'PR161'].map((rep) => ({ rep, verdict: 'green', tier: 2, keywords: [], isMR: false,
    ruleRefs: [...RR_ENTER, ...RR_HIRA, 'rules/19-special-rules.md', 'rules/17-icons.md'],
    clauseMap: [
      { clause: '【登場時】手札からLv6以下[灰原哀]キャラ1枚までスリープ状態で登場させ、カードを1枚引く', mapsTo: 'enter(selfOnly)→sequence[sceneEnter{from:hand,enterSleep:true,max:1}, draw1] (draw は「〜し、〜引く」で無条件、rules/15 必須効果)', grounding: 'B05112 from:hand + D01012 enterSleep + sequence pause-on-pick (resolver)' },
      { clause: '【ヒラメキ】リムーブの[灰原哀]1枚まで手札', mapsTo: 'evidence:remove-by-action(optional)→handAddFromRemove{cardName,max:1}', grounding: 'B02004 a2 verb' },
    ],
    abilities: [
      { id: 'a1', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
        effect: { kind: 'sequence', steps: [
          fromHandEnter({ enterSleep: true, filter: { cardName: '灰原哀', levelMax: 6, kind: 'character' } }),
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        ] },
        description: '【登場時】手札からレベル6以下の〚カード名［灰原哀］〛のキャラを1枚までスリープ状態で登場させ、カードを1枚引く。',
        ruleRefs: [...RR_ENTER, 'rules/19-special-rules.md', 'rules/17-icons.md'] },
      hirameki('a2', fromRemoveToHand({ filter: { cardName: '灰原哀', kind: 'character' } }),
        '【ヒラメキ】リムーブの〚カード名［灰原哀］〛を1枚まで選び、手札に加える。', [...RR_HIRA, 'rules/19-special-rules.md']),
    ] })),

  // ---- forEach-all クラスタ ----
  { rep: 'PR230', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_ALL, ...RR_HIRA, ...RR_LEAVE],
    clauseMap: [
      { clause: '【パートナー黒】【登場時】すべてのキャラをスリープ', mapsTo: 'partnerColor黒 + enter(selfOnly)→forEach over:all(scene,either)→sceneSetState{$each.uid,sleep}', grounding: 'B06071 (forEach over:all primitive-tested) + B01011 a1 hook' },
      { clause: '【相手ターン中】【現場リムーブ時】すべてのキャラをスリープ', mapsTo: 'turn:opp + leave:to-remove(selfOnly)→同 forEach', grounding: 'B02004 a2 hook + B06071' },
      { clause: '【ヒラメキ】キャラを1枚まで選びスリープ', mapsTo: 'evidence:remove-by-action(optional)→sceneSetState pick', grounding: 'D03013 a2 同型' },
    ],
    abilities: [
      { id: 'a1', type: 'triggered', scope: 'on-scene',
        condition: { kind: 'partnerColor', color: '黒' },
        trigger: { hook: 'enter', selfOnly: true },
        effect: sleepAll(),
        description: '【パートナー黒】【登場時】すべてのキャラをスリープさせる。',
        ruleRefs: RR_ALL },
      leaveOpp('a2', sleepAll(), '【相手ターン中】【現場リムーブ時】すべてのキャラをスリープさせる。', RR_ALL),
      hirameki('a3', sleepPick(), '【ヒラメキ】キャラを1枚まで選び、スリープさせる。', [...RR_HIRA, 'rules/03-field-areas.md']),
    ] },
];

fs.writeFileSync('.tmp/taskA/wave2-specs.json', JSON.stringify(specs, null, 1));
console.log('wrote', specs.length, 'specs:', specs.map((s) => s.rep).join(', '));
