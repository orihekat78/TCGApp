# 01. 法務調査サマリ

## 結論

**完全ローカル限定 + 公式画像は同梱せず都度フェッチ** の運用なら法的リスクは極めて低い。
**GitHub等への公開・配布** を行うと著作権侵害（複製権・公衆送信権）に該当し、
権利者からC&D（停止要請）を受けた場合は即時対応が必要となる。

## 関連権利者

名探偵コナンTCGの著作権・商標権は以下の3者が保有：

| 権利者 | 主な権利 |
|--------|---------|
| **株式会社タカラトミー (TOMY)** | TCG商品自体の権利・商標 |
| **小学館** | 原作出版権 |
| **青山剛昌** | 原作著作権 |

公式表記: `© 青山剛昌／小学館 © TOMY`

## 判断分岐ポイント

```
[本プロジェクトを公開するか?]
       │
       ├── 完全ローカル限定（個人PC内のみ） ─→ 私的使用 (著作権法 第30条) で適法
       │
       ├── GitHub公開（コードのみ・画像なし） ─→ グレー（コード自体は自作なら問題なし、ただしカードテキスト再利用に懸念）
       │
       ├── GitHub公開（カード画像同梱） ─→ ❌ 明確な著作権侵害
       │
       └── Webサイト公開（誰でも遊べる） ─→ ❌ YGOPro事例と同類（C&Dリスク高）
```

## 各ファイルへの誘導

| # | ファイル | 内容 |
|---|----------|------|
| 02 | [02-takaratomy-policy.md](02-takaratomy-policy.md) | タカラトミー/コナンTCG 固有の規約 |
| 03 | [03-precedents.md](03-precedents.md) | 類似プロジェクト事例（YGOPro / MTG Forge等） |
| 04 | [04-recommendation.md](04-recommendation.md) | 本プロジェクトへの推奨スタンス |

## 出典

- [タカラトミー サイトポリシー](http://www.takaratomy.co.jp/utility/sitepolicy/)
- [名探偵コナンTCG公式](https://www.takaratomy.co.jp/products/conan-cardgame/)
- [文化庁 著作権講座](https://www.bunka.go.jp/seisaku/chosakuken/taisetsu/point/index.html)
- [著作権法第30条 私的使用 解説](https://chosakukenhou.jp/reproduction_for_private_use/)
