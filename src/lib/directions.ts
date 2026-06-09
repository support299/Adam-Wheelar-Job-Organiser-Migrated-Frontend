export type LatLng = { lat: number; lng: number };

export type RouteMatrix = {
  distance: number[][];
  duration: number[][];
};

export function optimizeOrder(
  cost: number[][],
  distance: number[][],
  duration: number[][],
  startIndex: number,
  roundTrip: boolean,
): { order: number[]; totalDistance: number; totalDuration: number } {
  const n = cost.length;
  if (n === 0) return { order: [], totalDistance: 0, totalDuration: 0 };
  const visited = new Set<number>([startIndex]);
  const order: number[] = [startIndex];
  let current = startIndex;
  let totalDistance = 0;
  let totalDuration = 0;
  while (visited.size < n) {
    let bestIdx = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let j = 0; j < n; j++) {
      if (visited.has(j)) continue;
      const c = cost[current][j];
      if (c < bestCost) { bestCost = c; bestIdx = j; }
    }
    if (bestIdx === -1) break;
    totalDistance += distance[current][bestIdx];
    totalDuration += duration[current][bestIdx];
    order.push(bestIdx);
    visited.add(bestIdx);
    current = bestIdx;
  }
  if (roundTrip) {
    totalDistance += distance[current][startIndex];
    totalDuration += duration[current][startIndex];
    order.push(startIndex);
  }
  return { order, totalDistance, totalDuration };
}
