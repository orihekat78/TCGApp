---
row: "015"
status: blocked
you_deck: sample-d11
cpu_deck: deck-1784115431945
viewport: desktop
---

# Row 015 attempt 4: 警察・標準 vs 疾風

## Setup

- Attempt 3 の CPU AP 選択停止後、公開 Meta UI を新規表示して同じ組合せを最初から開始。
- UI に seed の表示・入力欄はないため、seed は観測不能かつ設定不能。値は主張しない。
- P1 は `警察・標準`（sample-d11）、CPU は `疾風`（deck-1784115431945）、先攻は P1。
- デスクトップ表示で実 UI 操作のみ。内部 state、dispatch、非公開情報は使用しない。

## Progress

- T1: 初期手札を公開 UI で確認し、引き直しなしを選択。
- T1–T2: 推理を各1回。公開UIで配置可能な表示・対象が出なかったため終了。
- T3: パートナー萩原千速で相手の三池苗子を対象にアクション。任意カットインは
  有効性を公開情報で確認できなかったためパス。
- CPU T6: 公開ログは `effect:sceneEnter:awaiting-pick`、続いて
  `effect:charModifyAP:awaiting-pick` と AP `+1000/turn` の解決を表示。
  それでも選択UIなしで `相手のターン処理中` が7秒超継続した。

## Result

- BUG-270 を再現。015 は blocked のまま。016へ進まない。
