export function nextRandom(seed: number): { seed: number; value: number } {
  const nextSeed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0
  return { seed: nextSeed, value: nextSeed / 4_294_967_296 }
}
