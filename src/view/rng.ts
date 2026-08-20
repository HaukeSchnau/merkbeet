/**
 * Deterministischer Zufall. Jede Pflanze bekommt aus ihrer id denselben Seed,
 * damit sie bei jedem Rendern und in jeder Sitzung identisch aussieht.
 */
export type Rng = {
  /** Gleichverteilt in [min, max). */
  range: (min: number, max: number) => number;
  /** Gleichverteilt in [0, 1). */
  next: () => number;
  /** Streuung um `center` mit Amplitude `spread`. */
  jitter: (center: number, spread: number) => number;
};

const hashString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const makeRng = (seed: string): Rng => {
  let state = hashString(seed) || 1;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    jitter: (center, spread) => center + (next() * 2 - 1) * spread,
  };
};
