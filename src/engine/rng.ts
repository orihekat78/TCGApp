// rules: 決定的RNG (mulberry32 + Fisher-Yates)
// seed 文字列から再現可能な疑似乱数生成器を返す

export interface Rng {
  next(): number;               // [0, 1)
  shuffle<T>(arr: T[]): T[];    // 非破壊
  choice<T>(arr: T[]): T;
}

export function createRng(seed: string): Rng {
  // seed → 32bit unsigned int via xfnv1a
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let s = h >>> 0;

  const next = (): number => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    shuffle<T>(arr: T[]): T[] {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    choice<T>(arr: T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },
  };
}
