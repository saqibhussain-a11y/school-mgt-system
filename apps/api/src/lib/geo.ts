const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

// Standard great-circle distance — plenty precise for a school-campus-scale
// geofence (tens to low hundreds of meters), no need for a more exact
// ellipsoidal model at this scale.
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
