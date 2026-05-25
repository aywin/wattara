declare module "leaflet" {
  export type LatLngExpression = [number, number] | { lat: number; lng: number };

  export interface PathOptions {
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    opacity?: number;
    weight?: number;
  }

  export interface PopupCapable {
    addTo(map: LeafletMap): PopupCapable;
    bindPopup(content: string): PopupCapable;
  }

  export interface LeafletMap {
    remove(): void;
  }

  export function map(element: HTMLElement, options: { center: LatLngExpression; zoom: number; scrollWheelZoom?: boolean }): LeafletMap;
  export function tileLayer(url: string, options?: { attribution?: string }): PopupCapable;
  export function circleMarker(center: LatLngExpression, options?: PathOptions & { radius?: number }): PopupCapable;
  export function geoJSON(data: unknown, options?: { style?: PathOptions }): PopupCapable;
}
