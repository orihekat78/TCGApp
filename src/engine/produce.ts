// Immer produce wrapper
// state mutation は必ずこのモジュール経由で行う（骨格凍結原則）

export { produce, current, original, isDraft } from 'immer';
