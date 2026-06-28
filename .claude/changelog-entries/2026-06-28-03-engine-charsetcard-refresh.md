## fix(engine): charSetCard{fromDeckTop} deck0 リフレッシュ配線 (BUG-160, BUG-142 同族)

- `src/engine/effect/atom-handlers/char.ts` の `charSetCard{fromDeckTop}` が deck0 時に silent no-op
  していた latent bug (rules/14・26 + 公式Q&A B08033「残り全部セット→リフレッシュ→残り分セット」違反)
  を修正。draw/fileAdd/evidenceGain (BUG-142) と同型の **deck0→refresh→set / remove0→deck-out 敗北** に置換。
- BUG-153 の host-absent 早期 return は refresh より前に維持 (host 不在なら deck/remove 不消費)。
- 単一 site 修正で fromDeckTop 使用 36 カードを被覆 (短縮形 path も resolve 後この explicit-uid 分岐へ再 dispatch)。
- 挙動不変ゲート: tsc0 / vitest 0 fail / smoke:1000 winsA=498 exceptions=0 (deck0-during-set edge は
  11-turn MVP smoke で発生せず baseline 不変) / 8 custom lint OK / eslint clean。
  専用 test: deck>0 回帰 / deck0+remove>0 → refresh+set+相手evidence+1+痕跡 / deck0+remove0 → deck-out /
  host-absent 不変 / player:opp deck-source (opp refresh + self penalty + self 勝利)。
- opus 4-lens 敵対 review: regression/edge/ordering = ship、blocker0 (rules-faithfulness は独立検証)。
  edge-lens concern (player:opp 経路) を test 追加で解消。BUG-160 記録。
