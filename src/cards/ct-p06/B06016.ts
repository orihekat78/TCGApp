// cards/ct-p06/B06016 鬼丸猛 (character) — deck-mill-gated-chain wave (engine: mill gate flag, 2026-06-23)
// rules: 01-victory-conditions.md (§証拠), 06-card-types.md (§証拠化), 14-refresh.md,
//        15-abilities-effects.md (§「〜してもよい。そうした場合」), 17-icons.md (§【パートナー(色)】/【登場時】/【宣言】/【ターン1】),
//        21-declared-ability-cost.md (§コスト【スリープ】), 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー緑】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。
//   【宣言】【ターン1】【スリープ】：自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。
// 公式Q&A (ct-p06 TSV):
//   ・【登場時】「デッキ2枚以下で全リムーブしてキャラを選べるか」→「いいえ (3枚リムーブが実行できなければ以降解決不可)」→ mill gate:true。
//   ・【宣言】「証拠はどの順番のものでも選べるか」→「はい。手札から裏向きで得る証拠は1番上に置かれる」→ evidenceToHand 全証拠 pick / handToEvidence push=1番上。
//
// 句マッピング:
//   - a1 【パートナー緑】 => condition:{kind:'partnerColor', color:'緑'} (rules/17、exemplar B02003)。【登場時】 => trigger:{hook:'enter', selfOnly:true}。
//        「3枚リムーブしてもよい。そうした場合〜」 => optional{chain[mill{n:3,gate:true}, sceneRemove{apMax:8000,side:'either',max:1,cause:'effect'}]}
//        (mill gate:true=deck<3 で chain break。「AP8000以下のキャラを1枚まで選びリムーブ」=> apMax:8000 / 両現場 either / 0可 / cause:'effect'、exemplar D01004)。
//   - a2 【宣言】 => type:'declared'。【ターン1】 => limit:{kind:'turn',n:1}。【スリープ】 => cost:{kind:'sleepSelf'} (rules/21、exemplar D09014)。
//        「証拠を1つ選び手札に加えてもよい。そうした場合、手札から1枚を裏向きで証拠」 => chain[evidenceToHand{max:1}, handToEvidence{n:1}]
//        (bare chain。max:1=0可で「してもよい」を表現、0選択で chain break。exemplar B06029 a1 と同文・同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: 【パートナー緑】【登場時】デッキ上3枚 gated-mill → AP8000以下を1枚まで選びリムーブ
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '緑' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のデッキのカードを上から3枚リムーブしてもよい (gate:true=deck<3 で不成立)
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true } },
        // そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする
        { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { apMax: 8000 } } },
      ],
    },
  },
  description: '【パートナー緑】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

// a2: 【宣言】【ターン1】【スリープ】証拠1つ選び手札へ (任意)、そうした場合 手札1枚を裏向きで証拠
const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'sleepSelf' },
  effect: {
    kind: 'chain',
    steps: [
      // 自分の証拠を1つ選び、手札に加えてもよい (max:1=0可=「してもよい」、0選択で chain break)
      { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } },
      // そうした場合、手札からカードを1枚裏向きで証拠として得る (push=1番上)
      { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】：自分の証拠を1つ選び、手札に加えてもよい。そうした場合、手札からカードを1枚裏向きで証拠として得る。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B06016: CardDef = {
  id: 'B06016',
  no: '0639/B06016',
  kind: 'character',
  names: ['鬼丸猛'],
  colors: ['緑'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1754284680609049.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/06-card-types.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};
