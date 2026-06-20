// cards/ct-p02/B02026 綾小路文麿 (character) — Task A green候補 再author (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【ターン1】相手の現場にいるキャラがアクションしたとき、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - a1 【ターン1】 (回数制限) => ability.limit {kind:'turn', n:1} [src/cards/ct-p01/B01062.ts a1 / B01036.ts:
//     triggered action:declare + limit:{kind:'turn',n:1}。engine は triggered で kind:'turn' を declaredUseCount で enforce。
//     fire 時点で count (0-pick でも) — 本能力は無条件 draw のため常に発火 = 厳密 1/turn。]
//   - a1 相手の現場にいるキャラがアクションしたとき => triggered, trigger {hook:'action:declare'} (selfOnly 無 = 盤面観測者) +
//     condition {kind:'triggerCharMatches', side:'opp', filter:{}} [src/cards/ct-p03/B03097.ts (非ターンプレイヤー観測者
//     「相手の現場にいるキャラが…アクションしたとき」) が triggerCharMatches{side:'opp', filter:{}} を VERBATIM 使用。
//     ⚠ eval.ts:298: filter フィールドが存在するとき (空 {} も JS truthy) のみ state.players[tcmPlayer].scene.find を実行 →
//     パートナーは partner-area で scene 不在のため除外される ('現場にいるキャラ' を厳密充足、rules/03)。
//     filter フィールドを完全省略すると scene.find を skip し相手 partner のアクションでも誤発火する (旧 refuted 版の真因)。
//     'アクション' は種別無 = アクション[キャラ]/[事件] 両方 → triggerActionKind gate を付けない (B03097 は[キャラ]限定で付与)。
//     state-machine.ts:198 は action:declare を {byUid,target,uid,player,targetUid} で宣言時 (ガード判定前) emit (rules/22)。]
//   - a1 カードを1枚引く => atom draw {player:'self', n:1} [標準 draw verb。'相手のアクション' に反応する自分の draw。]
//   - a2 【ヒラメキ】カードを1枚引く => triggered, scope:'on-evidence', trigger {hook:'evidence:remove-by-action', optional:true},
//     effect draw 1 [src/cards/ct-d01/D01006.ts a3 VERBATIM。'icon-flash' は廃止されヒラメキは triggered+evidence:remove-by-action
//     (card-def.ts:18)。optional:true = 任意発動 (rules/10 ヒラメキは発動可否を選択)。アクション[事件]の証拠リムーブ時のみ発火。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 相手の現場にいるキャラがアクションしたとき (action:declare 観測者、partner は filter:{} の scene 走査で除外)
  trigger: { hook: 'action:declare' },
  condition: { kind: 'triggerCharMatches', side: 'opp', filter: {} },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ターン1】相手の現場にいるキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】（証拠からリムーブされるときに発動する）任意発動
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B02026: CardDef = {
  id: 'B02026',
  no: '0196/B02026',
  kind: 'character',
  names: ['綾小路文麿'],
  colors: ['緑'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '京都府警'],
  rarity: 'C',
  imageUrl: '1721357211008090.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
