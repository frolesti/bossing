// Configuració per als icones de Leaflet amb Next.js/Webpack
import L from 'leaflet';

// Fix per als icones de Leaflet que no es carreguen correctament amb webpack
export function fixLeafletIcons() {
  // Eliminar la icona per defecte
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;

  // Configurar les icones amb URLs de CDN
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

// Icones personalitzades per cada supermercat
export const supermarketIcons = {
  mercadona: new L.Icon({
    iconUrl: '/icons/mercadona-marker.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  consum: new L.Icon({
    iconUrl: '/icons/consum-marker.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  carrefour: new L.Icon({
    iconUrl: '/icons/carrefour-marker.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  dia: new L.Icon({
    iconUrl: '/icons/dia-marker.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  lidl: new L.Icon({
    iconUrl: '/icons/lidl-marker.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  }),
  user: new L.Icon({
    iconUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -41],
  }),
};
