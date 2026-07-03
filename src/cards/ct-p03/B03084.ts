// cards/ct-p03/B03084 降谷零 (character) — engine mega-wave W1 exemplar (sceneToEvidence + evidenceToDeckBottom, 2026-07-03)
// rules: 01-victory-conditions.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー黄】【登場時】相手の証拠を1つまで選び、デッキの下に移す。
//   相手の現場にいるレベル7以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る。
//   【宣言】【ターン1】〚捜査1〛する。レベル5以上のカードが発見された場合、
//   キャラを1枚まで選び、ターン終了時までAP＋2000する。
//
// a1: sequence (chain でない — 公式Q&A「証拠を選ばなくても後段は解決できる」):
//   step1 = evidenceToDeckBottom (W1 新 verb): 相手証拠 0..1 pick → 持ち主(相手)のデッキ下
//     (Q&A: どの位置でも選べる / 裏向きは確認できず裏向きのまま / リムーブでないためヒラメキ不発動 rules/10)。
//   step2 = sceneToEvidence 短縮形 (W1 新 verb): 相手現場 Lv7以下 0..1 pick → 所有者(相手)の証拠へ
//     表向きで (Q&A: 1番上に置かれる = evidence push)。
// a2: souza x:1 bind '$found' (0629d 出荷) → conditional boundAnyMatchesFilter{levelMin:5} →
//     charModifyAP 短縮形 (+2000 turn、キャラ無限定 = side:'either')。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  condition: { kind: 'partnerColor', color: '黄' }, // 【パートナー黄】
  effect: {
    kind: 'sequence',
    steps: [
      // 相手の証拠を1つまで選び、デッキの下に移す
      {
        kind: 'atom',
        verb: 'evidenceToDeckBottom',
        args: {
          player: 'opp', // 証拠の持ち主 = 相手 (移動先も相手のデッキ下)
          target: { kind: 'pick', query: { area: 'evidence', side: 'opp' }, n: { min: 0, max: 1 }, chooser: 'self' },
        },
      },
      // 相手の現場にいるレベル7以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る
      { kind: 'atom', verb: 'sceneToEvidence', args: { player: 'opp', max: 1, filter: { levelMax: 7 }, faceUp: true } },
    ],
  },
  description:
    '【パートナー黄】【登場時】相手の証拠を1つまで選び、デッキの下に移す。相手の現場にいるレベル7以下のキャラを1枚まで選び、相手はそのカードを表向きのまま証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'sequence',
    steps: [
      // 〚捜査1〛する (相手デッキ上1枚公開→デッキ下、「発見された」を $found に束ねる)
      { kind: 'atom', verb: 'souza', args: { player: 'opp', x: 1, bind: '$found' } },
      // レベル5以上のカードが発見された場合、キャラを1枚まで選び、ターン終了時まで AP+2000
      {
        kind: 'conditional',
        if: { kind: 'boundAnyMatchesFilter', bindKey: '$found', filter: { levelMin: 5 } },
        then: { kind: 'atom', verb: 'charModifyAP', args: { player: 'self', delta: 2000, max: 1, side: 'either', scope: 'turn' } },
      },
    ],
  },
  description: '【宣言】【ターン1】〚捜査1〛する。レベル5以上のカードが発見された場合、キャラを1枚まで選び、ターン終了時までAP+2000する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B03084: CardDef = {
  id: 'B03084',
  no: '0337/B03084',
  kind: 'character',
  names: ['降谷零'],
  colors: ['黄'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['警察', '公安'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1729133443597581.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
