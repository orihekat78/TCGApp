// cards/ct-p09/B09108 工藤新一&服部平次 (character/MR) — CARD PHASE step12 batch2
// (declareName family exemplar: DeclareCardNameModal 配線と同 commit で解禁、engine変更0)
// rules: rules/03-field-areas.md, rules/12-next-hint.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、デッキの下に移す。
//   相手のFILEエリアにあるカードを上から1枚表向きにする。
//   【宣言】【ターン1】カード名を1つ指定し、相手のFILEエリアにあるカードを上から1枚リムーブし、
//   相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く。この効果によって指定した
//   カード名のカードがリムーブされた場合、自分はカードを2枚引き、手札を2枚リムーブする。
//   この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - a1「相手の現場にいるキャラを1枚まで選び、デッキの下に移す」=> sceneToDeck 短縮形
//     {side:'opp', max:1, pos:'bottom'} (B02003 同型・side either→opp 差替。「〜まで」=0可 rules/15。
//     デッキ下移動はリムーブでない = 現場リムーブ時 不発動 rules/23)。
//   - a1「相手のFILEエリアにあるカードを上から1枚表向きにする」=> fileFlipTop{player:'opp'}
//     (B09021 同型。既に表向き/FILE空は no-op・chain break しない = 公式Q&A「何も起こりません」)。
//     0枚選択でも後段は実行するため plain sequence (chain 不使用)。
//   - a2「カード名を1つ指定し」=> declareName{bind:'named'} (W6 step1 verb、供給 =
//     DeclareCardNameModal → AbilityCostParams.declaredName → ctx.dyn。本 commit で UI 配線)。
//     「〜する」句 = 必須宣言 (modal に skip 無し)。AI = 未供給 → 空文字 → 後段条件 false (engine 設計)。
//   - a2「相手のFILEエリアにあるカードを上から1枚リムーブし」=> fileRemoveTop{player:'opp', n:1,
//     bind:'removed'} (アシストパートナー除外 = handler 自動 skip、B09108 Q&A 名指し実装済。
//     1枚もリムーブできなければ chain break = B09105 Q&A「以降の効果は解決できない」→ kind:'chain')。
//   - a2「相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く」=> fileAdd{player:'opp', n:1}
//     (デッキ0 は refresh 内蔵)。
//   - a2「この効果によって指定したカード名のカードがリムーブされた場合」=> conditional
//     {if: boundNameMatchesDeclared{bindKey:'removed', declareKey:'named'}} (W6 step1 probe 済。
//     bound は cardId 参照 — リフレッシュ等でリムーブエリアから消えても成立 = 公式Q&A整合)。
//     ⚠ then 内は短縮形/runtime pick のみ (pre-walk は本 cond を stable 扱いし dispatch 時 false 評価
//     → then は raw のまま runtime 実行。eager $pick は不可 — DEFERRED-INDEX step12-batch2 節)。
//   - a2「自分はカードを2枚引き、手札を2枚リムーブする」=> draw{n:2} + discard{n:2}
//     (discard = human 2枚 pick、BUG-165 修正済 multi-pick)。
//   - a2「この能力はパートナーエリアでも宣言できる」=> scope:'on-partner-area' (B09070 a3 同型。
//     本カードは MR = rules/18 PA 常駐可。engine 側 canDeclaredAbility/findCardOnBoard は partnerMR uid
//     対応済。⚠ human の PA 発 宣言 UI (source 列挙/表示) は PA宣言19 batch へ DEFER — 現場からの
//     宣言 = 本 family 主経路は本 commit の playwright で実機検証)。
//   - 【カットイン】AP＋2000 => D01011 同型 (on-hand + effect:declared + $contact.byUid + scope:'contact')。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' } },
      { kind: 'atom', verb: 'fileFlipTop', args: { player: 'opp' } },
    ],
  },
  description:
    '【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、デッキの下に移す。相手のFILEエリアにあるカードを上から1枚表向きにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'declareName', args: { bind: 'named' } },
      { kind: 'atom', verb: 'fileRemoveTop', args: { player: 'opp', n: 1, bind: 'removed' } },
      { kind: 'atom', verb: 'fileAdd', args: { player: 'opp', n: 1 } },
      {
        kind: 'conditional',
        if: { kind: 'boundNameMatchesDeclared', bindKey: 'removed', declareKey: 'named' },
        then: {
          kind: 'sequence',
          steps: [
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 2 } },
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 2 } },
          ],
        },
      },
    ],
  },
  description:
    '【宣言】【ターン1】カード名を1つ指定し、相手のFILEエリアにあるカードを上から1枚リムーブし、相手はデッキのカードを上から1枚裏向きのままFILEエリアの上に置く。この効果によって指定したカード名のカードがリムーブされた場合、自分はカードを2枚引き、手札を2枚リムーブする。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B09108: CardDef = {
  id: 'B09108',
  no: '1047/B09108',
  kind: 'character',
  names: ['工藤新一&服部平次', '工藤新一', '服部平次'],
  colors: ['青', '緑'],
  level: 9,
  ap: 8000,
  lp: 3,
  traits: ['探偵', '高校生'],
  rarity: 'MR',
  imageUrl: '1775608944025108.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
