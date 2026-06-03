// cards/_shared barrel — 共通クラスの公開 API
// spec: .claude/specs/shared-classes/INDEX.md
//
// 共通クラスは破壊的変更禁止。新パターンは新クラス追加で対応。

export { partnerColorKeyword } from './partnerColorKeyword.js';
// cutinFixedAP は廃止 (2026-06-02): カットインは各カードに inline atom で記述する (D08007 同型)。
// hiramekiDraw / hiramekiCharStun は廃止 (2026-06-03): ヒラメキは各カードに inline atom で記述 (D08013 a2 同型)。
export { misreadX } from './misreadX.js';
export { souzaX } from './souzaX.js';
export { caseTraitConditioned } from './caseTraitConditioned.js';
export { caseResolvedHandRemove } from './caseResolvedHandRemove.js';
export { caseDeclaredEvidenceFlip } from './caseDeclaredEvidenceFlip.js';
export { eventRemoveByAP } from './eventRemoveByAP.js';
