// cards/ct-p06/B06057 ゲロ田ゲロ左エ門 (character) — engine変更0 wave (triage-verify, 2026-06-28)
// rules: rules/05-turn-phases.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   【自分ターン中】【ターン1】自分が【白】の〚特徴［YAIBA］〛のイベントを使用したとき、カードを1枚引く。（イベントを解決してから引く）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング (verified twin = B07016 a1 / D08013 a2):
//   - a1 自分が【白】の〚特徴[YAIBA]〛イベント使用時 = triggered on-scene, trigger{hook:'effect:declared',
//     matcher:(p)=> p.kind==='event-use' かつ 使用イベントが【白】かつ〚特徴YAIBA〛} (B07016 a1 の matcher を色追加+trait追加)。
//     【自分ターン中】=condition turn:self / 【ターン1】=limit turn1。effect=draw1 (必ず引く、「してもよい」ではない)。
//     ※公式Q&A:【白】YAIBAイベントの【カットイン】/【ヒラメキ】では発動しない = engine が cutin を abilityId:'cutin'
//       (kind!=='event-use') で emit するため matcher false。「イベントを解決してから引く」= effect:declared 解決後 hook。
//   - a2 【ヒラメキ】カードを1枚引く = triggered on-evidence, trigger{hook:'evidence:remove-by-action', optional:true}, draw1 (D08013 a2 同型)。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { engine } from '@/engine';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'effect:declared',
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      const pp = p as { kind?: unknown; cardId?: unknown };
      if (pp.kind !== 'event-use' || typeof pp.cardId !== 'string') return false;
      const d = engine.cards.get(pp.cardId);
      return !!d && d.colors.includes('白') && d.traits.includes('YAIBA');
    },
  },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【自分ターン中】【ターン1】自分が【白】の〚特徴［YAIBA］〛のイベントを使用したとき、カードを1枚引く。（イベントを解決してから引く）',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B06057: CardDef = {
  id: 'B06057',
  no: '0678/B06057',
  kind: 'character',
  names: ['ゲロ田ゲロ左エ門'],
  colors: ['白'],
  level: 4, ap: 4000, lp: 0,
  traits: ['YAIBA'], keywords: [],
  rarity: 'C',
  imageUrl: '1754285220507007.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/25-qa-effects-resolution.md'],
};
