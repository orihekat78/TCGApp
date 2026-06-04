## switch-on-effect-enter — 現場満杯時の効果登場でスイッチ提供 (rules/20 準拠)

**Round/Phase**: 2026-06-04 ルール準拠改善 Task 1

リムーブ等からの効果登場 (sceneEnter: D11014 a2 / D08024 / D11019) で自分の現場が満杯 (5枚) のとき、
従来は登場を skip していた。rules/20 §スイッチでは既存キャラを退けて登場できるため、human に
「どのキャラを退場させるか / 辞退」の選択を提供するよう実装 (switch-on-effect-enter、BUG-106 で DEFERRED だった項目)。

- **engine** (atom-handlers sceneEnter): `switchRemoveUid` 付きなら `mutate.scene.switchEnter` で退場+登場、
  満杯+未指定は skip。早期 guard は human を通し AI は skip 維持 (skip も rules 上「0枚選択=合法な辞退」)。
- **pick threading** (apply-pick / useEngineDispatch): `effectPickResolve` に `switchRemoveUid` を追加し
  解決済 sceneEnter atom args へ載せる (continuation の $entered 伝播はそのまま → step3 draw も発火)。
- **UI** (Playmat): reanimate 対象選択後に現場満杯を検知し `SceneSwitchPickerModal` で退場キャラを収集
  (手札使用 switch と同 modal を流用)。cancel = 辞退 (reanimate しない)。
- **fix**: `SceneSwitchPickerModal` z-index 1000→1700 (reanimate の `CardListModal` 1500 の上に出す)。
  ※ 実機 Playwright 検証で発見した stacking バグ。

AI/smoke は skip 維持で挙動不変 (baseline shift 無し)。

検証: 新規 engine 2 + integration 2 テスト / vitest 1697 PASS / smoke1000 例外0 baseline OK /
Playwright e2e 65 PASS / 実機 (full scene reanimate→switch→step3 draw) 確認。
