// cards/ct-p01/B01022 「少年探偵団」 (event) — S2 deck cluster (deck-window multi-deploy, 2026-07-10)
// rules: 12-next-hint.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー青】手札を1枚リムーブする。自分のデッキのカードを上から6枚見る。
//   その中からレベル4以下の〚特徴［少年探偵団］〛のキャラを2枚まで登場させ、残りをシャッフルしてデッキの下に移す。
//
// 公式 qAndA (ct-p01 event.tsv):
//   - 手札0枚 → 手札はリムーブせず、それ以降の効果を解決する (discard n:1 は不足時 skip、後続継続)。
//   - 条件を満たすカードが2枚以上あっても 1枚のみ / 0枚 の選択可 (「まで」= rules/15)。
//   - 現場4枚以上でも 2枚登場可 — 5枚上限を超える分は既存キャラをリムーブして登場 (rules/20 スイッチ、
//     UI: SceneSwitchPickerModal / AI: scene-full-skip)。
//
// 句マッピング (S2 B01022 — grounding: specs/miniwave5-deck-reveal-grounding.md P1 節 Route B):
//   - 【パートナー青】 => condition partnerColor 青 (不成立 = 効果を持たない扱い、rules/17)。
//   - 「手札を1枚リムーブする」 => discard n:1 (D01013 同句 VERBATIM)。
//   - 「上から6枚見る」 => deckRevealUntil maxN:6 bind-only ($revealed = window 全体 + index 同梱)。
//   - 「その中から…2枚まで登場」 => sceneEnter cardIds:'$pick.cardIds' + query{area:'deck',
//     fromGroupCards:'$revealed', filter{kind:'character', trait:'少年探偵団', levelMax:4}} n{0,2}
//     (B09010 multi-enter 契約 + fromGroupCards window 制限。skipResolvesAtom: 0枚でも後続解決)。
//   - 「残りをシャッフルしてデッキの下に移す」 => deckToBottomBound{order:'shuffle'}
//     (公開した残りだけを無作為化し、未公開のデッキ本体はシャッフルしない。)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  condition: { kind: 'partnerColor', color: '青' }, // 【パートナー青】
  effect: {
    kind: 'sequence',
    steps: [
      // 手札を1枚リムーブする (必須。手札0枚なら不発で継続 — 公式Q&A)
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      // デッキ上から6枚見る — window 全体を $revealed に bind (filter/bindMatch 省略 = 全保持 + index)
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 6, bind: '$revealed' } },
      // window 内のレベル4以下[少年探偵団]キャラを2枚まで登場 (0枚可、現場満杯は switch)
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self', cardIds: '$pick.cardIds', skipResolvesAtom: true, viaEffect: true,
          target: {
            kind: 'pick',
            query: {
              area: 'deck', side: 'self',
              filter: { kind: 'character', trait: '少年探偵団', levelMax: 4 },
              fromGroupCards: '$revealed',
            },
            n: { min: 0, max: 2 }, chooser: 'self',
          },
        },
      },
      // 登場分 prune 後の残りだけをシャッフルしてデッキの下へ
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'shuffle' } },
    ],
  },
  description:
    '【パートナー青】手札を1枚リムーブ → デッキ上から6枚見て、レベル4以下の[少年探偵団]キャラを2枚まで登場 → 残りをシャッフルしてデッキの下へ。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

export const B01022: CardDef = {
  id: 'B01022',
  no: '0018/B01022',
  kind: 'event',
  names: ['少年探偵団'],
  colors: ['青'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1714012985535161.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
