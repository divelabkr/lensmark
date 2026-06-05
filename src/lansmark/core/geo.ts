const R = 6378137; // m
const rad = Math.PI / 180;

/** GeoJSON 폴리곤 ring [[lng,lat], ...] 의 면적(㎡). geojson-area 구면 근사. */
export function polygonAreaM2(ring: [number, number][]): number {
  if (!ring || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    area += (lng2 - lng1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((area * R * R) / 2);
}
