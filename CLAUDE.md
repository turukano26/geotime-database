# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive historical atlas built with D3.js. Renders country borders from geospatial datasets on a web map with a timeline slider for navigating through history, projection switching, and click-to-inspect popups.

## Setup & Commands

```bash
npm install         # Install dependencies
npm run dev         # Start Vite dev server (opens browser)
npm run build       # Production build to dist/
```

There is no test suite or linter.

Note: This project uses a local `.npmrc` to override the system npm registry to the public registry.

## Architecture

### Web App (src/)

Single-page D3.js application. Entry point is `src/main.js`, loaded from `index.html`.

**Rendering pipeline:** Load GeoJSON -> filter features by current year (`gwsyear`/`gweyear` fields) -> D3 data join on `<svg>` path elements -> re-render on year change, projection change, or resize.

**SVG layer order:** background (ocean sphere) -> graticule -> country polygons -> outline.

**Projections:** Defined in a registry object mapping names to factory functions. Some projections come from core `d3` (Natural Earth, Equal Earth, Mercator, Orthographic), others from `d3-geo-projection` (Robinson, Winkel Tripel/`geoWinkel3`, Mollweide).

**Interactions:**
- Timeline slider filters features by year and re-renders
- Projection dropdown swaps projection and re-renders
- Scroll wheel zooms (all projections), drag pans (flat projections) or rotates globe (orthographic)
- Hover shows tooltip, click logs to console

### Data

- **CShapes 2.0** (`CShapes-2.0.geojson`): 710 features, global historical country borders 1886-2019. Key properties: `cntry_name`, `gwsyear`/`gweyear` (integer years), `gwsdate`/`gwedate` (day-first date strings), `capname`, `area`.
- **Old data and notebooks** moved to `old/` — contains CHGIS, Geonames, Japan divisions, Python notebooks from the earlier folium-based prototype.

## Tech Stack

JavaScript (ES modules) with Vite. Key libraries: d3, d3-geo-projection, topojson-client.
