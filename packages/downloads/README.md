# @libraryofages/downloads

The offline engine: text bundles that make the reader network-free, and Audible-style
audiobook downloads.

## Owns
A manifest-driven queue (at most two transfers in flight, chapter order within an item),
pause/resume/cancel/retry that keep completed files, integrity by byte size always and sha256
when both sides have one, Wi-Fi-only for audio (text ignores it), update detection by manifest
hash, validity and lock state through the host's `ValidityPolicy` (on boot, on foreground, on
demand), storage accounting, `resolveLocal(source)` for the reader and player, `readText(id)`,
`<DownloadsList />` and `useDownloads()`.

## How it is built
Bytes stream into a `BundleStorage`: `IndexedDbStorage` (web; 4 MB slices, `blob:` URLs
assembled on demand) or `FileSystemStorage` (Android; expo-file-system 57 files under the
app's document directory, expo-crypto sha256 up to 16 MB). Connectivity comes from
`@react-native-community/netinfo` on Android and `navigator.onLine` plus the Network
Information API on web. `transfer.ts` is the one file in the kit that calls `fetch`: the URL
always comes from the host's manifest. Records: `item:{key}` with keys `text:{id}` and
`audio:{id}:{voice}`; files `{key}:content`, `{key}:cover`, `{key}:ch{n}`; settings under
`settings`.

## Public surface
`<DownloadsProvider validityPolicy fetchManifest(id, kind) theme storage? connectivity? concurrency? now? />` (`kind` lets the host set `gated` for a book's text and audio differently),
`useDownloads()` → `list`, `settings`, `ready`, `usedBytes`, `freeBytes`, `connection` and
`downloadText(id)`, `downloadAudio(id, voice)`, `pause/resume/cancel/retry/remove(key)`,
`deleteAll(kind?)`, `resolveLocal(source)`, `readText(id)`, `refreshValidity()`,
`checkForUpdates(key)`, `setOfflineValidUntil(key, iso)` (a renewed offline window), `setSettings({ wifiOnly, autoDownloadNext })`, `items()`, `totals()`;
`<DownloadsList theme />`; `createStorage()`, `IndexedDbStorage`, `createConnectivity()`.

## Must never contain
Auth headers, entitlement calls, what "gated" means. The host's `fetchManifest` and
`validityPolicy` decide; the engine locks only on the policy's verdict. A package may import
React, React Native, Expo modules and `@libraryofages/kit-core` only.

Device-only, not driven in CI: the file-system storage and netinfo connectivity.
