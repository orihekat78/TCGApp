// cards/ct-p05/B05093 榎本梓 (character) — WC2a: pick chooser 'opp-of-owner' 実配線 (2026-07-11)
// rules: rules/12-next-hint.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【登場時】自分のデッキのカードを上から3枚公開する。相手はその中からイベントか〚特徴［喫茶ポアロ］〛の
//   キャラを1枚選び、自分はそれを手札に加える。残りを自分が好きな順番でデッキの下に移す。
//   Q&A: イベントか[喫茶ポアロ]キャラが公開された場合、相手は必ず1枚選ぶ (自分は必ず手札に加える)。
//        デッキが3枚ない場合は残り全部を公開して解決 (見ている間はまだデッキ扱い、リフレッシュは加えた時点)。
//
// 句マッピング (WC2a exemplar — opp-as-chooser deck-window pick):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true} (B05013 a1 同型)。
//   - 「自分のデッキのカードを上から3枚公開する」 => deckRevealUntil {player:'self', maxN:3, bind:'$revealed'}
//     (B01022 同型 bind-only。filter/bindMatch/chooseMatch なし = window 全体を保持 + deck 位置 index 同梱)。
//   - 「相手はその中からイベントか[喫茶ポアロ]のキャラを1枚選び、自分はそれを手札に加える」 =>
//     handAddFromDeck cardId:'$pick.cardId' + query{area:'deck', side:'self', fromGroupCards:'$revealed',
//     filterAny:[{kind:'event'},{kind:'character', trait:'喫茶ポアロ'}]} n{1,1} chooser:'opp-of-owner'。
//       * chooser:'opp-of-owner' = resolve-picks の chooser chokepoint (WC2a) が owner (=自分) の相手側へ
//         pick を振る (pending.player=opp)。恩恵の hand-add は player:'self'=owner (BUG-175 pending.ownerPlayer)。
//       * filterAny = イベント OR [喫茶ポアロ]キャラ (OR。candidates.ts matchOneFilter kind/trait honor)。
//       * n{1,1} = 「選べる場合は必ず1枚」(公式Q&A)。候補0 (該当カード非公開) は no-op fallback で何も加えない。
//   - 「残りを自分が好きな順番でデッキの下に移す」 => deckToBottomBound bindKey:'$revealed'
//     (加えた1枚は deck 不在で自動 skip、残りのみ底へ。順序選択 modal は human owner に surface。
//     B01048 同型 — "好きな順番" は shuffle でなく owner 選択、engine は公開順を既定合法 choice とする)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'sequence',
    steps: [
      // 自分のデッキの上から3枚公開 → window を $revealed に bind
      { kind: 'atom', verb: 'deckRevealUntil', args: { visibility: 'public', viewer: 'all', player: 'self', maxN: 3, bind: '$revealed' } },
      // 相手が「イベント or [喫茶ポアロ]キャラ」を1枚選び、自分が手札に加える (chooser=相手 / 恩恵=自分)
      {
        kind: 'atom',
        verb: 'handAddFromDeck',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          target: {
            kind: 'pick',
            query: {
              area: 'deck',
              side: 'self',
              fromGroupCards: '$revealed',
              filterAny: [{ kind: 'event' }, { kind: 'character', trait: '喫茶ポアロ' }],
            },
            n: { min: 1, max: 1 },
            chooser: 'opp-of-owner',
          },
        },
      },
      // 残りを好きな順番でデッキの下へ (加えた分は splice 済で自動除外)
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキの上から3枚公開 → 相手がイベントか[喫茶ポアロ]キャラを1枚選び自分が手札に加える → 残りをデッキの下へ。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B05093: CardDef = {
  id: 'B05093',
  no: '0591/B05093',
  kind: 'character',
  names: ['榎本梓'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['喫茶ポアロ'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322226192440.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
