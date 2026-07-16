---
date: 2026-07-16
category: investigation
bugs:
  [
    BUG-205,
    BUG-206,
    BUG-208,
    BUG-210,
    BUG-211,
    BUG-212,
    BUG-213,
    BUG-214,
    BUG-215,
    BUG-216,
    BUG-217,
    BUG-219,
    BUG-220,
    BUG-221,
    BUG-222,
    BUG-223,
    BUG-224,
    BUG-225,
    BUG-226,
    BUG-231,
  ]
---

## YOU vs CPU 実操作バグの調査・修正作業中

- 上記BUGは全件、検証と実装commitが未確定のため`対応中`。修正済みとは扱わない。
- 作業ツリーにはsession清掃、世代token、owner/chooser分離、CARD_POOL/MVP表示、
  mobile HUD、decision-hostに関する候補実装がある。Phase 1で個別に証拠を確定する。
- YOU vs CPUの回帰条件を、完走だけでなくprovenance、side、pending消滅、
  次の合法行動まで拡張する方針を記録した。
- ミスリード関連はBUG-221〜226へ失敗契約を分離した。Phase 3でTDD修正する。
- BUG-231はログtarget/result内の既知card IDから共通拡大modalへ到達できない未close調査。
  registry解決、複数ID、未知ID/scene UID非操作化、keyboard操作を検証対象にする。
- 全gateと実ブラウザ検証後、実装commit・RCA・test pathが揃った票だけを
  `status: 修正済`へ更新し、別の`category: fixes` entryに掲載する。
