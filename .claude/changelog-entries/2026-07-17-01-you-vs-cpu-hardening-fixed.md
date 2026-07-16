---
date: 2026-07-17
category: fixes
bugs:
  [
    BUG-130,
    BUG-140,
    BUG-158,
    BUG-166,
    BUG-167,
    BUG-176,
    BUG-180,
    BUG-202,
    BUG-203,
    BUG-204,
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
    BUG-227,
    BUG-228,
    BUG-229,
    BUG-230,
    BUG-231,
    BUG-232,
  ]
---

## YOU vs CPU 製品経路の水平修正完了

- runtime実装commit `300353bd79ca806460c8ea74025c3f062e6528b9`へ34票、docs可搬性commit
  `46bc113748e9d15c20bfeb3c5b1a6f4f713cfef9`へBUG-232を紐づけ、計35票を修正済みにした。
- owner/chooser、非同期continuation、効果source、contact、misread、deck refresh、
  session境界、Meta画面、mobile操作、ログカード拡大を製品経路で修正した。
- Vitest 6041件、Root Playwright 293件、Meta Playwright 44件、実ブラウザの
  YOU vs CPU操作、typecheck、lint、docs、smoke、benchmarkで検証した。
- BUG-207/209/218は仕様外。修正済み件数へ含めない。
