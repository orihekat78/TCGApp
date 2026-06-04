## 数値ターゲットフィルタを有効値判定に修正 (rules/15,19,22 準拠)

**Round/Phase**: 2026-06-04 ルール準拠改善 Task 2

ターゲット/条件の数値フィルタ (`apMin/apMax/lpMin/lpMax`) が `override?printed` のみで判定し、
turnEffects の ±修正 (疾風 AP-1000 / カットイン AP+ / D11012 LP+1 等) を無視していた。rules 上これらの
条件は「効果解決時点の有効値」を参照すべき (rules/15 効果解決, 19 数値は±修正で変動, 22 AP 参照)。

- **engine** (`target/candidates.ts` matchOneFilter): scene char (c≠null) は
  `(override?printed) + apMod_{permanent,turn,contact}` (LP も同様) の **有効値** で判定。非現場 candidate
  (c=null) は printed のまま。`cond/eval` も同 enumerate を使うため条件判定にも反映 (例:「AP◯以下をリムーブ」が
  debuff されたキャラを正しく含む / D11012「LP0の警察」が buff 済 (有効LP>0) を誤って含めない)。
- **card** (D11012 a1): 「LP0の」= 有効 LP ちょうど 0 → filter を `lpMax:0` → `lpMin:0, lpMax:0` に
  (有効 LP は ±修正で負にもなりうるため厳密一致が必要)。
- **残差** (BUG-113): 継続効果 (`continuousDelta` = dyn AP/LP, D08005 灰原哀) は import cycle 回避のため
  inline 集計から除外。該当は D08005 のみで稀。

裁定根拠: 「LP0の」は「LP0**以下**の」ではなく有効 LP **ちょうど 0** (rules/19 LP は 0 や負を取りうる)。
`.claude/docs/user-request-clarifications.md` に記録。

検証: 新規 effective-value-filter.test.ts 4 / vitest 1703 PASS / smoke1000 例外0・**baseline 不変** (10.86/469) /
e2e 65 PASS / tsc clean。広域 (条件含む) 変更だが既存テスト・smoke に fallout 無し。
