import type { Coordinates } from './types.js';

/**
 * Calcula la distància entre dues coordenades usant la fórmula de Haversine
 * @returns Distància en quilòmetres
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371; // Radi de la Terra en km
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  const lat1 = toRad(point1.lat);
  const lat2 = toRad(point2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Comprova si un punt està dins d'un radi donat
 */
export function isWithinRadius(
  center: Coordinates,
  point: Coordinates,
  radiusKm: number
): boolean {
  return calculateDistance(center, point) <= radiusKm;
}

/**
 * Ordena punts per distància des d'un punt central
 */
export function sortByDistance<T extends { lat: number; lng: number }>(
  center: Coordinates,
  points: T[]
): T[] {
  return [...points].sort((a, b) => {
    const distA = calculateDistance(center, { lat: a.lat, lng: a.lng });
    const distB = calculateDistance(center, { lat: b.lat, lng: b.lng });
    return distA - distB;
  });
}
