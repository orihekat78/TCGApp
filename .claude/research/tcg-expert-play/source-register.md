# TCG熟練判断: source register

取得日: 2026-07-27。`validated-rule` はルール事実、`expert-source` は戦略上の参考、
`research-untrusted` は未再現の研究、`blocked` は不一致解消まで使用禁止。

| ID | 区分 | 版/状態 | claim scope | 出典 |
|---|---|---|---|---|
| CONAN-INDEX | validated-rule | Ver.2.5 / local snapshot | Conanの基準版と原典導線 | [INDEX](../../rules/INDEX.md) |
| CONAN-KEYWORDS | validated-rule | Ver.2.5 / local snapshot | 迅速・突撃・キーワード | [keywords](../../rules/13-keywords.md) |
| PTCG-RULES | validated-rule | current at access | Prize・盤面・手順の比較 | [official rulebook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/trading-card-game/rulebook/par_rulebook_en.pdf) |
| PTCG-POLICY | validated-rule | current at access | 競技形式・デッキ合法性 | [Play! Pokémon rules](https://play.pokemon.com/en-us/resources/rules/?category=tcg) |
| PTCG-ACADEMY | expert-source | official/pro presenter | デッキ計画・弱点・対戦例 | [Top Deck Academy](https://www.pokemon.com/us/news/combat-deck-weakness-with-top-deck-academy) |
| PTCG-CELIO | expert-source | secondary/pro | 練習・振り返り方法 | [Celio's Network](https://celiosnetwork.substack.com/p/how-to-improve-at-pokemon-tcg) |
| MTG-TEMPO | expert-source | official archive | tempo・initiative | [Magic: Tempo](https://magic.wizards.com/en/news/feature/tempo-2015-07-20) |
| MTG-TRADEOFF | expert-source | official/pro | tempoとcard advantage | [Reid Duke](https://magic.wizards.com/en/news/feature/tempo-card-advantage-delicate-balance-2014-11-17) |
| FAB-RULES | validated-rule | current at access | reaction window・resource支払 | [official rules](https://rules.fabtcg.com/en/) |
| FAB-MASTERCLASS | expert-source | official | value・resource curve | [Masterclass](https://fabtcg.com/articles/masterclass-deckbuilding/) |
| FAB-LSV | expert-source | secondary/pro | 手札の防御・攻撃・resource配分 | [TCGplayer](https://www.tcgplayer.com/content/article/Resource-Management-in-Flesh-and-Blood/51bb6642-80bc-4e16-b82c-0decca8615e7/) |
| PTCG-BENCH | research-untrusted | arXiv 2605.29653 / unreplicated | LLM agent評価設計 | [arXiv](https://arxiv.org/abs/2605.29653) |

## Claim map

| Claim | 内容 | 根拠 | 限界/反例 |
|---|---|---|---|
| K1 | 勝敗までの最短手数を先に比較する。 | 各validated-rule、PTCG-ACADEMY | 勝利条件と手数の単位はゲーム固有。 |
| K2 | tempo、手札、盤面、resourceは交換関係。固定加重しない。 | MTG-TEMPO、MTG-TRADEOFF、FAB-MASTERCLASS | 即勝敗がある局面では時計を優先。 |
| K3 | 反応札は今の変換価値と将来の応答窓を比べる。 | FAB-RULES、FAB-LSV、CONAN-INDEX | 応答窓がないゲームへ移植しない。 |
| K4 | 非公開情報は事実でなくrangeとして扱う。 | 競技一般の仮説 | 根拠不足。`hypothesis` のまま。 |
| K5 | AIは勝敗だけでなく合法性、情報境界、説明、再現性で評価する。 | PTCG-BENCH | Conanでの有効性は未検証。 |
| K6 | 対局後レビューを対局中の判断根拠へ逆流させない。 | PTCG-CELIO、評価設計原則 | ex ante記録がない過去ログは判定不能。 |

このregisterは「網羅的調査の完了」を意味しない。Pokémonのプロ判断を含む独立した
複数専門家検証、Conanの版不一致解消、反証例の蓄積は未完了。
