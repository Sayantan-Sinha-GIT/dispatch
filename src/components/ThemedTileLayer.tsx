"use client";

import { TileLayer } from "react-leaflet";

/**
 * The basemap every map in the app uses.
 *
 * The stock OpenStreetMap tiles are bright, and in the dark theme the map was
 * a white slab in the middle of the page with the routes washing out against
 * it. Hosted dark basemaps now all require an API key (CARTO watermarks its
 * tiles without one), so the dark treatment is done in CSS instead — see
 * `.leaflet-tile-pane` in globals.css. Same tiles, same attribution, no key.
 */
export function ThemedTileLayer() {
  return (
    <TileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
    />
  );
}
