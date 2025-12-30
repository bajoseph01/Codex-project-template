export const LANES = [-5, 0, 5] as const;

export type LaneIndex = 0 | 1 | 2;

export function clampLaneIndex(laneIndex: number): LaneIndex {
  if (laneIndex <= 0) return 0;
  if (laneIndex >= 2) return 2;
  return laneIndex as LaneIndex;
}

