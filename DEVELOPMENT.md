# Development workflow

## Branches

- `main`: verified stable releases only.
- `develop`: integration branch for approved work.
- `feature/*`: future focused work branched from `develop`.

Never develop directly on `main`. Merge to `develop` only after the focused change has passed its checks. Merge from `develop` to `main` only for a reviewed, verified release.

## Data safety rules

1. Before testing destructive work, create a complete backup from **Settings → Download full backup**.
2. Preserve browser-local records, concepts, drawings, estimates, recovery snapshots, and manually verified locations.
3. Data migrations must be additive, versioned, snapshot-protected, and non-destructive. Startup must not silently rewrite user property values.
4. Test against existing saved-property fixtures, including seed deletion/restore, user-created records, manual pins, and recovery snapshots.

## Required validation

Before merging, run JavaScript syntax checks and:

```powershell
node scripts/verify-baseline.js
```

The runner uses fixtures only. It covers preservation, import/location, scoring, planning, elevation, cleanup, duplicate HTML IDs, and storage-recovery behavior without reading or changing active browser storage.

Also perform a manual localhost smoke test for Map, Compare, Settings, property details, and Site Planning. Keep developer diagnostics disabled unless they are actively needed.

## Release procedure

1. Work from `develop`; do not change application behavior as part of packaging.
2. Run syntax and regression checks from a clean checkout.
3. Create a timestamped source ZIP outside the repository tree. Browser property data is excluded by design.
4. Commit the reviewed release to `main` with a clear message.
5. Tag the exact release commit (for example, `v4.0.0-stable`).
6. Create `develop` from that same baseline when starting the next integration cycle.

Before testing any new hosted origin, export a complete Settings backup from the prior origin and import it deliberately into the new one.
