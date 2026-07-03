// engine additive wave-18 (2026-07-03) — inContact TargetQuery 軸の挙動テスト。
//
// pick を「現コンタクトの参加者 (ctx.contact.{byUid,targetUid,guardUid})」に限定する。
// 「コンタクト中のキャラを1枚まで選び、AP±N」(B04075/PR029/PR033 白鳥任三郎 / B04092/B04093 / B03034 稲尾) 用。
//
// honor site = candidates.matchesQueryForChar (ctx 有)。matchOneFilter (ctx 無し) には置けないため
// TargetFilter ではなく TargetQuery 軸 (excludeSelf と同型の ctx 依存 char 述語)。ctx.contact は resolve 時
// (entryToCtx, BUG-104) のみ populate → コンタクト外/non-char/ctx.contact 不在は不一致=drop (安全側)。
//
// ★本 wave は engine primitive のみ出荷 (consumer 未同梱)。理由: 全 consumer が trigger 側で structural gap
//   (A1) を持つ — 白鳥系=cutin/変装の共有【ターン1】(disguise:into payload に player 無 → triggerPlayerIs 不可) /
//   キャンティ系=contact:start dual-key matcher + optional sleep / 稲尾=pick-in-cutin 解決経路が未確立。
//   本テストは primitive の候補列挙契約を回帰固定する (consumer 出荷は A1 解禁後)。
// rules: 08-contact.md, 15-abilities-effects.md (「〜まで」=0可), 22-qa-action-contact.md.

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { candidates } from '@/engine/target/candidates';
import { mutate } from '@/engine/mutate/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, ContactCtx } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 4, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

function candUids(s: GameState, query: Record<string, unknown>, contact?: ContactCtx): string[] {
  const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'probe' }, contact });
  return candidates(s, { kind: 'all', query } as never, ctx)
    .filter(c => c.kind === 'char')
    .map(c => (c as { uid: string }).uid)
    .sort();
}

beforeEach(() => {
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(ch('ATK'));
  registerCardDef(ch('DEF'));
  registerCardDef(ch('GRD'));
  registerCardDef(ch('MOB'));
});

// 盤面: self 現場に ATK + 傍観 MOB / opp 現場に DEF + GRD。
// contact = ATK(self attacker) vs DEF(opp target)、GRD は別 (ガードキャラ想定 or decoy)。
function board(): { s: GameState; atk: string; def: string; grd: string; mob: string } {
  let atk = '', def = '', grd = '', mob = '';
  const s = produce(createEmptyGameState(), (d) => {
    atk = mutate.scene.enter(d, 'self', 'ATK', {}).uid;
    mob = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
    def = mutate.scene.enter(d, 'opp', 'DEF', {}).uid;
    grd = mutate.scene.enter(d, 'opp', 'GRD', {}).uid;
  });
  return { s, atk, def, grd, mob };
}

describe('wave18 inContact honor', () => {
  it('inContact:true + side:either → コンタクト参加者 (byUid/targetUid) のみ、非参加者 MOB/GRD は除外', () => {
    const { s, atk, def } = board();
    const contact: ContactCtx = { byUid: atk, targetUid: def, attackerSide: 'self' };
    expect(candUids(s, { area: 'scene', side: 'either', inContact: true }, contact)).toEqual([atk, def].sort());
  });

  it('guardUid も参加者に含む (ガードされたコンタクト)', () => {
    const { s, atk, grd } = board();
    // ガード時: attacker(atk) vs guard(grd)。targetUid 不在。
    const contact: ContactCtx = { byUid: atk, guardUid: grd, attackerSide: 'self' };
    expect(candUids(s, { area: 'scene', side: 'either', inContact: true }, contact)).toEqual([atk, grd].sort());
  });

  it('side:opp と併用 → opp 側の参加者のみ (相手のコンタクト中キャラ、B03034/白鳥 型)', () => {
    const { s, atk, def } = board();
    const contact: ContactCtx = { byUid: atk, targetUid: def, attackerSide: 'self' };
    // side:opp は opp 現場に絞る → 参加者 def のみ (atk は self ゆえ除外)。
    expect(candUids(s, { area: 'scene', side: 'opp', inContact: true }, contact)).toEqual([def]);
  });

  it('ctx.contact 不在 (コンタクト外の誤用) → 候補0 (安全側 drop)', () => {
    const { s } = board();
    expect(candUids(s, { area: 'scene', side: 'either', inContact: true }, undefined)).toEqual([]);
  });

  it('inContact 未指定 → 従来通り全 char 候補 (回帰: baseline 不変)', () => {
    const { s, atk, def, grd, mob } = board();
    expect(candUids(s, { area: 'scene', side: 'either' }, undefined)).toEqual([atk, def, grd, mob].sort());
  });
});
