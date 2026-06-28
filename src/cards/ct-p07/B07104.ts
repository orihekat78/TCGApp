// cards/ct-p07/B07104 ミステリーコースター (event) — engine変更0 wave (triage-verify+fix, 2026-06-28)
// rules: rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー黒】キャラを1枚まで選び、リムーブする。キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンから
//     すぐにアクションできる）を与える。自分と相手の現場にいるキャラ1枚につき、自分のデッキのカードを上から2枚リムーブする。
//
// 句マッピング (verified twin = B04017 sceneRemove短縮形 / charGrantKeyword短縮形(PA, ATOM_PICK_SPEC) / B02083 forEach over:all + mill):
//   - 【パートナー黒】= ability.condition partnerColor{color:'黒'} (B02083 同型)。
//   - イベント自己使用トリガ = trigger{hook:'effect:declared', selfOnly:true, matcher:(p)=>p.kind==='event-use'} (B08075/B02083 同型)。
//   - clause1「キャラを1枚まで選びリムーブ」= sceneRemove 短縮形{player:'self', max:1, side:'either', cause:'effect'} (エリア指定なし=両現場 rules/15)。
//   - clause2「キャラを1枚まで選びターン終了まで突撃付与」= charGrantKeyword 短縮形{player:'self', kw:'突撃', scope:'turn', max:1, side:'either'}。
//     ★短縮形必須 (uid:'$pick'+target 明示形は sequence 内で初期 walk push → human 経路で clause1 より先に pick surface
//      = 印字順逆転 BUG-158)。短縮形は paShortFormAwait の runtime push で clause1→clause2→clause3 の正順 surface。
//   - clause3「自分と相手の現場のキャラ1枚につきデッキ上2枚リムーブ」= forEach{over:{kind:'all', query:{area:'scene', side:'either'}},
//     do: atom mill{player:'self', n:2}} (B02083 forEach over:all 同型)。clause1 のリムーブ後の盤面を execution-time に計数 (印字順)。
//   ⚠ KNOWN-EDGE (敵対 review 検出、shipped-with-DEFER): mill は per-atom で min(n, deck) + deck0 で refresh するが、
//     forEach ループ "途中" でデッキが枯渇 → refresh された後、後続キャラ分が refresh 済デッキから追加 mill される。
//     公式Q&A「可能な限りリムーブ→リフレッシュ→残りはリムーブしない」= 合計 (キャラ数×2) を一括 mill して中途 refresh で停止、が正。
//     forEach+mill では中途 refresh 停止が表現できない (engine変更0 範囲外。faithful 化には mill-total-with-refresh-stop primitive が必要)。
//     通常域 (deck ≥ キャラ数×2) は正。divergence は late-game の deck 枯渇時のみ。→ 将来 engine additive wave で修正。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: { kind: 'partnerColor', color: '黒' },
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect' } },
      { kind: 'atom', verb: 'charGrantKeyword', args: { player: 'self', kw: '突撃', scope: 'turn', max: 1, side: 'either' } },
      { kind: 'forEach', over: { kind: 'all', query: { area: 'scene', side: 'either' } }, do: { kind: 'atom', verb: 'mill', args: { player: 'self', n: 2 } } },
    ],
  },
  description: '【パートナー黒】キャラを1枚まで選び、リムーブする。キャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。自分と相手の現場にいるキャラ1枚につき、自分のデッキのカードを上から2枚リムーブする。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const B07104: CardDef = {
  id: 'B07104',
  no: '0831/B07104',
  kind: 'event',
  names: ['ミステリーコースター'],
  colors: ['黒'],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1762414041060117.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};
