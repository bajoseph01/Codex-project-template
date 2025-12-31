export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, smoothing: number, delta: number): number {
  const t = 1 - Math.exp(-smoothing * delta);
  return lerp(current, target, t);
}

