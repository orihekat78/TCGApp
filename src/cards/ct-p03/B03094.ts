// cards/ct-p03/B03094 萩原千速 (character) — deck-mill-gated-chain wave (engine: mill gate flag, 2026-06-23)
// rules: 07-action-flow.md, 13-keywords.md (§突撃), 14-refresh.md, 15-abilities-effects.md (§「〜してもよい。そうした場合」),
//        17-icons.md (§【パートナー(色)】), 22-qa-action-contact.md (§アクション宣言時発動), 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー黄】〚突撃〛（登場したターンからすぐにアクションできる）
//   このキャラがアクションしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。そうした場合、アクション終了時までこのキャラをAP＋1000する。
// 公式Q&A (ct-p03 TSV):
//   ・「【パートナー黄】未充足でも2つ目の能力は使えるか」→「使える。黄で有効になるのは突撃のみ」→ a2 は無条件。
//   ・「アクションしたとき能力はいつ発動するか」→「宣言・対象指定・スリープした時点 (ガード判定より前)」→ hook:'action:declare'。
//   ・「デッキ1枚なら全リムーブしてAP+1000できるか」→「いいえ (実行できなければ以降解決不可)」→ mill gate:true。
//   ・「再アクションで毎回発動するか」→「はい。【ターン1】がないので条件を満たすたび発動。ただし効果はアクション終了時まで」→ limit なし / scope:'action'。
//
// 句マッピング:
//   - 【パートナー黄】〚突撃〛 => a1 = partnerColorKeyword({color:'黄', kw:'突撃'}) (条件付与の常時有効型、exemplar D01005)。Q&A により黄が効くのは突撃のみ。
//   - このキャラがアクションしたとき => a2 trigger:{hook:'action:declare', selfOnly:true} (exemplar D02004/D06010/D08021、Q&A「ガード判定より前」と rules/22 一致)。
//   - 「2枚リムーブしてもよい。そうした場合〜」 => optional{chain[mill{n:2,gate:true}, charModifyAP{uid:'$self',delta:1000,scope:'action'}]}。
//     mill gate:true で deck<2 なら chain break (AP+1000 不成立)。charModifyAP uid:'$self' = 「このキャラ」(ctx.source、exemplar D02004)。
//     scope:'action' = 「アクション終了時まで」(char.ts modifyAP scope union、exemplar B03097/B08048)。【ターン1】無し=limit 省略で再発動可。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

// a1: 【パートナー黄】〚突撃〛 (条件付き突撃付与)
const a1 = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a1' });

// a2: このキャラがアクションしたとき、デッキ上2枚 gated-mill → アクション終了時まで AP+1000 (無条件)
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のデッキのカードを上から2枚リムーブしてもよい (gate:true=deck<2 で不成立)
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 2, gate: true } },
        // そうした場合、アクション終了時までこのキャラをAP＋1000する
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'action' } },
      ],
    },
  },
  description: 'このキャラがアクションしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。そうした場合、アクション終了時までこのキャラをAP＋1000する。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};

export const B03094: CardDef = {
  id: 'B03094',
  no: '0347/B03094',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133443700695.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/22-qa-action-contact.md', 'rules/26-qa-deck-refresh.md'],
};
