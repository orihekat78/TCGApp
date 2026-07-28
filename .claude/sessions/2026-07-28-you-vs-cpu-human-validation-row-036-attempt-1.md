# Row 036 -- blue-green vs 疾風

- Setup: public `#setup`, YOU `deck-1784115417710`, CPU
  `deck-1784115431945`; no seed control is exposed.
- Result: LOSS, T11, evidence 5/6 vs 9/7. CPU's displayed MVP was 萩原千速
  (B09071, AP 8000).

## Public decisions

- Mulliganed only the L9 工藤新一&服部平次; kept lower-level early plays.
- T2 played 量子 L4, removed 工藤新一 L8 for its required public effect, then
  used 江戸川コナン for 1 evidence.
- T3 played 毛利蘭 L6 and reasoned. At the guard prompt against AP 8000 萩原
  千速, declined to sacrifice the AP 6000 蘭; 量子 was removed after passing
  cut-in.
- T4 played 江戸川コナン L8, then reasoned. T5 reasoned to reach 5/6; CPU
  reached 9/7 before the next turn.

## UI recovery finding

- A locator wait occurred after selecting a field Conan instead of the partner
  Conan. The public snapshot still showed `推理 の対象を選択してください`.
  Re-read the visible UI, selected the card with the partner candidate state,
  and continued the same row. This was not treated as a terminal interruption.
- Source and partner cards can share the same visible name; candidate-state
  text, not name alone, identifies the public target.

Status: clean-public-seed-unverifiable.
