// cards/ct-p05/B05061 終極 (event) — deck-mill-gated-chain wave (engine: mill gate flag, 2026-06-23)
// rules: 14-refresh.md, 15-abilities-effects.md (§「〜してもよい。そうした場合」), 17-icons.md (§【パートナー(色)】),
//        20-color-and-switch.md (§色制限), 23-qa-disguise-cutin.md (§デッキ下移動はリムーブでない), 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー白】自分のデッキのカードを上から7枚リムーブしてもよい。そうした場合、相手の現場にいるキャラを1枚まで選び、デッキの下に移す。
// 公式Q&A (ct-p05 TSV): Q「デッキが6枚以下の場合、すべてリムーブしてキャラを選べるか」A「いいえ。『上から7枚リムーブする』が
//   実行できない場合、それ以降の効果は解決できません」→ mill gate:true。
//
// 句マッピング:
//   - イベント使用 => type:'triggered', scope:'on-hand', trigger:{hook:'effect:declared', selfOnly:true, matcher: kind==='event-use'}
//        (exemplar D01014 a1 / eventRemoveByAP。手札の使用/ネクストヒント両経路が同 payload)。
//   - 【パートナー白】 => condition:{kind:'partnerColor', color:'白'} (rules/17 §条件未充足=効果のないイベント扱い、exemplar D01015)。
//   - 「7枚リムーブしてもよい。そうした場合〜」 => optional{chain[mill{n:7,gate:true}, sceneToDeck{side:'opp',max:1,pos:'bottom'}]}。
//        mill gate:true で deck<7 なら chain break。step2「相手の現場にいるキャラを1枚まで選びデッキの下」=> side:'opp'、1枚まで=0可。
//        デッキ下移動はリムーブでない (rules/23、現場リムーブ時不発火)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  condition: { kind: 'partnerColor', color: '白' },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のデッキのカードを上から7枚リムーブしてもよい (gate:true=deck<7 で不成立)
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 7, gate: true } },
        // そうした場合、相手の現場にいるキャラを1枚まで選び、デッキの下に移す
        { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' } },
      ],
    },
  },
  description: '【パートナー白】自分のデッキのカードを上から7枚リムーブしてもよい。そうした場合、相手の現場にいるキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/23-qa-disguise-cutin.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05061: CardDef = {
  id: 'B05061',
  no: '0563/B05061',
  kind: 'event',
  names: ['終極'],
  colors: ['白'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628061793825.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/23-qa-disguise-cutin.md', 'rules/26-qa-deck-refresh.md'],
};
