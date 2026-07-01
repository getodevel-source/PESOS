// TS re-export wrapper around the root-level pure-Node bridge
// (../../updater-bridge.js).
//
// Why this wrapper exists: `updater.js` (Electron main) and
// `src/app/api/update/route.ts` (Next.js) both need the bridge, but they
// live in different module systems. Electron main is plain Node CJS with
// no TS compile step (see package.json:18 — no `tsc` for the main), so
// it `require()`s the root `.js` file. The Next.js route uses ESM +
// `tsconfig.json` `"@/*": ["./src/*"]` path alias, so it imports a
// `.ts` module. We keep the real implementation at the root and re-export
// the four read+request functions the route uses from this thin shim.
//
// Why only these four: the route never reads or writes the state file
// directly — `electron-updater` (via `updater.js`) owns `readState` /
// `writeState`. The route only consumes `getState` and dispatches the
// three sentinel-file triggers.
//
// Where the merge fix lives: in `updater-bridge.js` `writeState`, NOT
// here. This file is a re-export only.
export { getState, requestCheck, requestDownload, requestInstall } from '../../updater-bridge'
