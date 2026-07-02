// Track B compiler — production rule 集 (whitelist 文法)。
// B0 = 空。B1 で句形→DSL 断片の rule を登録する。
//
// rule 形状 (B1 契約):
//   { name: string,                          // 一意名 (レポート/レビュー用)
//     match: (seg) => bool,                  // 句が本 rule に一致するか (seg = {col, text})
//     emit:  (seg, entry) => {abilities?: AbilityDef[], keywords?: string[]} }
//
// 登録原則:
//   - 1 rule = 出荷済 primitive の文言パターン 1 つ (exemplar カードを根拠に持つこと)
//   - 裁定テーブル (「〜まで」=0可 rules/15 / colorNot some説 B08079 / deck-look 型別 rules/26)
//     は rule 内にエンコードし、rule コメントに出典を明記する
//   - 未知句を部分推測で埋める rule は禁止 (compile 側が card 全体 refuse で止める前提を壊さない)

function loadProductions() {
  return [];
}

module.exports = { loadProductions };
