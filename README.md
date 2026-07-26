# Operation Turtle

Operation Turtle is a private East Tennessee property, relocation, and site-planning evaluation application. It stores property records in the browser, verifies locations, compares routes and destinations, scores properties, and keeps planning concepts, drawings, costs, and recovery snapshots with each record.

## Run locally

This is a vanilla HTML, CSS, and JavaScript application. It has no package install or build step, but it should be served from a local web server rather than opened with `file://`. A server gives the app a stable origin for browser storage and lets service-worker and network behavior match deployment more closely.

Recommended command when Node.js LTS is installed:

```powershell
npx --yes serve . -l 4173
```

Then open `http://localhost:4173`. A Python alternative is `python -m http.server 4173`.

The browser storage origin includes the protocol, host, and port. `file://`, `localhost:4173`, GitHub Pages, Cloudflare Pages, and each preview domain have separate storage.

## Protect property data

Property records, concepts, drawings, estimates, scout pins, and recovery snapshots live in browser `localStorage` for the current origin. They are **not** stored in the source files or release ZIPs.

Before testing a new host or GitHub Pages deployment, use **Settings → Download full backup**. Use **Settings → Import backup** to restore that complete state on the new origin. Recovery snapshots can be reviewed and restored from Settings; every restore first protects current state with a new snapshot.

## Maps and external services

- Leaflet renders the map.
- OpenStreetMap supplies the street base map and Nominatim supports nearby search/fallback lookup.
- Esri supplies aerial imagery and reference labels.
- USGS supplies topographic, hillshade, and contour layers.
- U.S. Census and OpenStreetMap geocoding support address location where available.

These services are external and can be limited by connectivity, CORS, rate limits, or availability. No secret API keys are embedded in this repository.

## Current limitations

- Browser-local storage is origin-specific and has normal browser quota limitations.
- Listing sites may block automated retrieval; import retains reliable URL-derived facts and labels unavailable fields rather than inventing them.
- Parcel, imagery, route, and elevation sources require user review for planning decisions and are not engineering, legal, survey, or tax advice.

## Development workflow

- `main` contains verified stable releases only.
- `develop` is the integration branch for approved work.
- Future work starts from `develop` on `feature/*` branches; never develop directly on `main`.

See [DEVELOPMENT.md](DEVELOPMENT.md) for required backup, regression, migration, and release steps. Stable source baselines are tagged (starting with `v4.0.0-stable`); release ZIPs are kept outside the repository working tree.
